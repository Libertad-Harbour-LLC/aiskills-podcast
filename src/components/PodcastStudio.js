"use client";
// Two-step podcast studio: (1) the script — written by AI or by you, editable line by line;
// (2) the voice-over — the whole dialogue in one MP3.
import { useEffect, useMemo, useRef, useState } from "react";
import { FiZap, FiLoader, FiPlus, FiTrash2, FiMic, FiDownload, FiLock, FiAlertTriangle, FiFileText } from "react-icons/fi";
import { APP, VOICES, FORMATS, MAX_TURNS, MAX_LINE, SCRIPT_MODEL, VOICE_MODEL } from "@/lib/app.config";
import { useKit, parseJson } from "@/lib/kit-i18n";
import { Chips, Field, downloadFile, priceLabel } from "./Studio";
import LangSelect from "./LangSelect";

const CODE_KEY = `${APP.id}:access-code`;
const STATE_KEY = `${APP.id}:state`;
const EPS_KEY = `${APP.id}:episodes`;
const TERMINAL = new Set(["completed", "failed", "refunded"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function PodcastStudio() {
  const { t, tx, k, err: errText, lang } = useKit();
  const ru = lang === "ru";
  const [cfg, setCfg] = useState(null);
  const [code, setCode] = useState("");
  const [codeDraft, setCodeDraft] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [s, setS] = useState(() => APP.initialState());
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(null); // "script" | "voice" | null
  const [err, setErr] = useState("");
  const [episodes, setEpisodes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    fetch("/api/config").then((r) => r.json()).then(setCfg).catch(() => setCfg({ configured: false }));
    try {
      setCode(localStorage.getItem(CODE_KEY) || "");
      const saved = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
      if (saved) { setS((x) => ({ ...x, ...saved.s })); setTitle(saved.title || ""); }
      setEpisodes(JSON.parse(localStorage.getItem(EPS_KEY) || "[]"));
    } catch {}
    setLoaded(true);
    return () => { alive.current = false; };
  }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(STATE_KEY, JSON.stringify({ s, title })); } catch {} }, [s, title, loaded]);
  useEffect(() => { if (cfg?.accessCode && !code) setNeedCode(true); }, [cfg, code]);

  const headers = useMemo(() => ({ "Content-Type": "application/json", ...(code ? { "x-access-code": code } : {}) }), [code]);
  const set = (p) => setS((x) => ({ ...x, ...p }));
  const solo = s.format === "solo";
  const scriptPrice = priceLabel(cfg?.prices?.[SCRIPT_MODEL], t);
  const voicePrice = priceLabel(cfg?.prices?.[VOICE_MODEL], t);
  const filled = s.turns.filter((x) => x.text.trim());

  async function run(body) {
    const r = await fetch("/api/generate", { method: "POST", headers, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (d.error === "access_code_required") { setNeedCode(true); setCode(""); }
      throw new Error(d.error === "missing_input" ? "needText" : d.error || "generic");
    }
    const id = d.items[0].id;
    for (let i = 0; i < 400 && alive.current; i++) {
      await sleep(i < 3 ? 2500 : 4000);
      const g = await fetch(`/api/generations/${id}`, { headers, cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
      if (g && TERMINAL.has(g.status)) {
        if (g.status !== "completed") throw new Error("failed");
        return g;
      }
    }
    throw new Error("generic");
  }
  const showErr = (e) => setErr(e.message === "failed" ? t("failed") : e.message === "needText" ? k("needText") : errText(e.message));

  const writeScript = async () => {
    setErr("");
    if (s.topic.trim().length < 5) { setErr(k("needText")); return; }
    setBusy("script");
    try {
      const g = await run({ ...s, action: "script" });
      const d = parseJson(g.text);
      const turns = (d?.turns || []).filter((x) => x && typeof x.text === "string").slice(0, MAX_TURNS)
        .map((x) => ({ speaker: x.speaker === 2 && !solo ? 2 : 1, text: x.text.slice(0, MAX_LINE) }));
      if (!turns.length) throw new Error("generic");
      set({ turns });
      setTitle(typeof d.title === "string" ? d.title.slice(0, 120) : "");
    } catch (e) { showErr(e); } finally { setBusy(null); }
  };

  const voice = async () => {
    setErr("");
    if (!filled.length) { setErr(errText("missing_dialogue")); return; }
    setBusy("voice");
    try {
      const g = await run({ ...s, action: "voice" });
      const url = g.result_urls?.[0];
      if (!url) throw new Error("failed");
      const ep = { at: Date.now(), id: g.id, url, title: title || s.topic.slice(0, 60) || (ru ? "Выпуск" : "Episode") };
      const list = [ep, ...episodes].slice(0, 20);
      setEpisodes(list);
      try { localStorage.setItem(EPS_KEY, JSON.stringify(list)); } catch {}
    } catch (e) { showErr(e); } finally { setBusy(null); }
  };

  const setTurn = (i, patch) => set({ turns: s.turns.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const hostName = (n) => s.hosts[n - 1]?.name || `${ru ? "Ведущий" : "Host"} ${n}`;
  const btn = "inline-flex items-center justify-center gap-2 rounded-2xl font-bold bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed";
  const latest = episodes[0];

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <section className="mb-8 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-glass-border bg-glass-bg text-[11px] font-bold uppercase tracking-widest text-secondary-text mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" /> {tx(APP.kicker)}
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-primary-text leading-[1.05]">{tx(APP.headline)}</h1>
        <p className="mt-3 text-base sm:text-lg text-secondary-text">{tx(APP.description)}</p>
      </section>
      {cfg && !cfg.configured && <div className="mb-6 rounded-2xl border border-secondary-500/50 bg-secondary-500/10 p-4 text-sm text-primary-text">{t("notConfigured")}</div>}

      <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6 items-start">
        <div className="rounded-3xl border border-glass-border bg-bg-card p-5 sm:p-6 space-y-6 min-w-0">
          <div className="text-xs font-bold uppercase tracking-widest text-secondary-text">{ru ? "1 · Сценарий" : "1 · Script"}</div>
          <Field label={ru ? "Тема выпуска" : "Episode topic"} rows={4} max={2500} value={s.topic} onChange={(v) => set({ topic: v })}
            hint={ru ? "Тема, тезисы, факты — ИИ возьмёт конкретику только отсюда." : "Topic, key points, facts — the AI takes specific facts only from here."}
            placeholder={ru ? "Почему все говорят об ИИ-агентах и как использовать их в малом бизнесе" : "Why everyone talks about AI agents and how small businesses can use them"} />
          <Chips label={ru ? "Формат" : "Format"} options={FORMATS.map((f) => f.id)} value={s.format} onChange={(v) => set({ format: v })} render={(id) => tx(FORMATS.find((f) => f.id === id).label)} />
          <div className="space-y-3">
            <div className="text-sm font-semibold text-primary-text">{ru ? "Ведущие и голоса" : "Hosts and voices"}</div>
            {s.hosts.slice(0, solo ? 1 : 2).map((h, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <input value={h.name} onChange={(e) => set({ hosts: s.hosts.map((x, j) => (j === i ? { ...x, name: e.target.value.slice(0, 30) } : x)) })}
                  aria-label={`${ru ? "Имя ведущего" : "Host name"} ${i + 1}`}
                  className="min-w-0 rounded-xl bg-bg-elevated border border-glass-border px-3 py-2.5 text-sm text-primary-text focus:outline-none focus:ring-1 focus:ring-primary-500" />
                <select value={h.voice} onChange={(e) => set({ hosts: s.hosts.map((x, j) => (j === i ? { ...x, voice: e.target.value } : x)) })}
                  aria-label={`${ru ? "Голос" : "Voice"} ${i + 1}`}
                  className="min-w-0 rounded-xl bg-bg-elevated border border-glass-border px-3 py-2.5 text-sm text-primary-text focus:outline-none focus:ring-1 focus:ring-primary-500">
                  {VOICES.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.gender === "f" ? (ru ? "жен." : "female") : (ru ? "муж." : "male")}</option>)}
                </select>
              </div>
            ))}
          </div>
          <Chips label={ru ? "Реплик" : "Lines"} options={[6, 10, 15]} value={s.lines} onChange={(v) => set({ lines: v })} render={String} />
          <LangSelect value={s.language} onChange={(v) => set({ language: v })} />
          <div className="space-y-2 pt-2 border-t border-divider/40">
            <button type="button" onClick={writeScript} disabled={Boolean(busy) || (cfg && !cfg.configured)} className={`${btn} w-full py-3`}>
              {busy === "script" ? <FiLoader className="w-5 h-5 animate-spin" /> : <FiFileText className="w-5 h-5" />}
              {busy === "script" ? k("writing") : ru ? "Написать сценарий" : "Write the script"}
              {scriptPrice && busy !== "script" ? <span className="font-normal opacity-80">· {scriptPrice}</span> : null}
            </button>
            <p className="text-[11px] text-secondary-text">{ru ? "Или напишите реплики сами справа — это бесплатно." : "Or type the lines yourself on the right — that is free."}</p>
          </div>
        </div>

        <div className="space-y-6 min-w-0">
          <div className="rounded-3xl border border-glass-border bg-bg-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-bold uppercase tracking-widest text-secondary-text">{ru ? "2 · Реплики" : "2 · Lines"}</div>
              <span className="text-[11px] text-secondary-text">{s.turns.length}/{MAX_TURNS}</span>
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder={ru ? "Название выпуска" : "Episode title"}
              className="w-full bg-transparent border-b border-glass-border pb-2 text-lg font-bold text-primary-text placeholder:text-secondary-text/60 focus:outline-none focus:border-primary-500" />
            {busy === "script" && <div className="h-32 rounded-2xl border border-glass-border grid place-items-center text-sm text-secondary-text animate-pulse-glow"><span className="inline-flex items-center gap-2"><FiLoader className="animate-spin" /> {k("writing")}</span></div>}
            {!s.turns.length && busy !== "script" && (
              <div className="rounded-2xl border border-dashed border-divider p-6 text-center text-sm text-secondary-text">
                {ru ? "Нажмите «Написать сценарий» или добавьте первую реплику." : "Press “Write the script” or add the first line."}
              </div>
            )}
            <div className="space-y-3">
              {s.turns.map((x, i) => (
                <div key={i} className="rounded-2xl border border-glass-border bg-bg-elevated/50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {[1, 2].filter((n) => n === 1 || !solo).map((n) => (
                      <button key={n} type="button" onClick={() => setTurn(i, { speaker: n })} aria-pressed={x.speaker === n}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${x.speaker === n ? "bg-primary-500/20 border-primary-500 text-primary-text" : "border-glass-border text-secondary-text"}`}>
                        {hostName(n)}
                      </button>
                    ))}
                    <span className={`ml-auto text-[11px] ${x.text.length > MAX_LINE ? "text-secondary-500" : "text-secondary-text"}`}>{x.text.length}/{MAX_LINE}</span>
                    <button type="button" aria-label={t("remove")} onClick={() => set({ turns: s.turns.filter((_, j) => j !== i) })} className="text-secondary-text hover:text-primary-text"><FiTrash2 /></button>
                  </div>
                  <textarea value={x.text} rows={2} onChange={(e) => setTurn(i, { text: e.target.value.slice(0, MAX_LINE) })}
                    className="w-full resize-y rounded-xl bg-bg-elevated border border-glass-border px-3 py-2 text-sm text-primary-text focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={s.turns.length >= MAX_TURNS}
                onClick={() => set({ turns: [...s.turns, { speaker: solo ? 1 : (s.turns[s.turns.length - 1]?.speaker === 1 ? 2 : 1), text: "" }] })}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold bg-bg-elevated border border-glass-border text-primary-text disabled:opacity-40">
                <FiPlus /> {ru ? "Реплика" : "Add line"}
              </button>
              <span className="text-[11px] text-secondary-text">{ru ? "Теги эмоций: [laughs] [sighs] [whispers] [excited]" : "Emotion tags: [laughs] [sighs] [whispers] [excited]"}</span>
            </div>
            <div className="pt-3 border-t border-divider/40 space-y-2">
              <button type="button" onClick={voice} disabled={Boolean(busy) || !filled.length || (cfg && !cfg.configured)} className={`${btn} w-full py-3.5 text-base`}>
                {busy === "voice" ? <FiLoader className="w-5 h-5 animate-spin" /> : <FiMic className="w-5 h-5" />}
                {busy === "voice" ? t("processing") : ru ? "Озвучить выпуск" : "Voice the episode"}
                {voicePrice && busy !== "voice" ? <span className="font-normal opacity-80">· {voicePrice}</span> : null}
              </button>
              {err && <p role="alert" className="text-sm text-secondary-500 inline-flex items-center gap-2"><FiAlertTriangle /> {err}</p>}
              <p className="text-[11px] leading-relaxed text-secondary-text">{t("charged")}</p>
            </div>
          </div>

          {latest && (
            <div className="rounded-3xl border border-glass-border bg-bg-card p-5 sm:p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-secondary-text">{t("result")}</h2>
              {episodes.slice(0, 6).map((e) => (
                <div key={e.at} className="rounded-2xl border border-glass-border bg-bg-elevated/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-primary-text"><FiMic className="text-primary-500 shrink-0" /> <span className="truncate">{e.title}</span></div>
                  <audio src={e.url} controls className="w-full" />
                  <button type="button" onClick={() => downloadFile(e.url, `${APP.id}-${String(e.id).slice(0, 8)}.mp3`)}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-primary hover:bg-primary-hover">
                    <FiDownload className="w-4 h-4" /> {t("download")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {needCode && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-sm rounded-3xl border border-glass-border bg-bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-primary-text"><FiLock /> {t("accessTitle")}</div>
            <p className="text-sm text-secondary-text">{t("accessText")}</p>
            <input value={codeDraft} onChange={(e) => setCodeDraft(e.target.value)} type="password" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && codeDraft.trim()) { setCode(codeDraft.trim()); try { localStorage.setItem(CODE_KEY, codeDraft.trim()); } catch {} setNeedCode(false); } }}
              className="w-full rounded-xl bg-bg-elevated border border-glass-border px-3 py-2.5 text-sm text-primary-text focus:outline-none focus:ring-1 focus:ring-primary-500" />
            <button type="button" onClick={() => { if (!codeDraft.trim()) return; setCode(codeDraft.trim()); try { localStorage.setItem(CODE_KEY, codeDraft.trim()); } catch {} setNeedCode(false); }}
              className="w-full rounded-xl py-2.5 font-bold bg-primary hover:bg-primary-hover">{t("accessSave")}</button>
          </div>
        </div>
      )}
    </main>
  );
}
