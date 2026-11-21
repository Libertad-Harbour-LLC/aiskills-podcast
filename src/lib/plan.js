import "server-only";
import { SCRIPT_MODEL, VOICE_MODEL, VOICES, FORMATS, MAX_TURNS, MAX_LINE } from "@/lib/app.config";
import { PlanError, text } from "@/lib/plan-helpers";
import { langName } from "@/lib/text-presets";

const voiceOk = (id) => VOICES.some((v) => v.id === id);

// action "script" → the text model writes a dialogue (JSON); action "voice" → the dialogue model voices it.
export function plan(body) {
  const hosts = (Array.isArray(body.hosts) ? body.hosts : []).slice(0, 2).map((h, i) => ({
    name: text(h?.name, 30) || `Host ${i + 1}`,
    voice: voiceOk(h?.voice) ? h.voice : VOICES[i === 0 ? 4 : 0].id,
  }));
  if (!hosts.length) throw new PlanError("Add a host", "missing_input");
  const format = FORMATS.find((f) => f.id === body.format) || FORMATS[0];
  const solo = format.id === "solo";

  if (body.action === "voice") {
    const turns = (Array.isArray(body.turns) ? body.turns : []).slice(0, MAX_TURNS)
      .map((t) => ({ speaker: t?.speaker === 2 && !solo ? 2 : 1, text: String(t?.text || "").replace(/\s+/g, " ").trim().slice(0, MAX_LINE) }))
      .filter((t) => t.text);
    if (!turns.length) throw new PlanError("The script is empty", "missing_dialogue");
    return [{
      model: VOICE_MODEL,
      prompt: "",
      params: { dialogue: { turns: turns.map((t) => ({ voice: (hosts[t.speaker - 1] || hosts[0]).voice, text: t.text })) } },
    }];
  }

  const topic = String(body.topic || "").trim().slice(0, 2500);
  if (topic.length < 5) throw new PlanError("Describe the topic of the episode", "missing_input");
  const lines = Math.min(MAX_TURNS, Math.max(4, Number(body.lines) || 10));
  const system =
    "You are a podcast scriptwriter. Write a natural, spoken-style episode: short sentences, contractions, reactions " +
    "(\"Wait, really?\"), concrete examples, no lists read aloud, no stage directions in brackets except rare audio tags " +
    "the voice engine understands: [laughs], [sighs], [whispers], [excited] (at most one tag per line). Start with a hook, " +
    "end with a short takeaway and goodbye. Do not invent statistics or quotes; if the brief gives facts, use only those.\n\n" +
    'Respond with ONLY a JSON object, no markdown fences: {"title":"…","turns":[{"speaker":1,"text":"…"}]} — speaker is 1 or 2.';
  const prompt =
    `Episode topic and notes:\n${topic}\n\nFormat: ${format.brief}.\n` +
    `Hosts: host 1 is ${hosts[0].name}${!solo && hosts[1] ? `, host 2 is ${hosts[1].name}` : ""}. They may call each other by name.\n` +
    `Exactly ${lines} lines${solo ? ", all by speaker 1" : ", alternating speakers"}; each line 1–4 sentences, at most 600 characters.\n` +
    `Language: write in ${langName(body.language)}.`;
  return [{ model: SCRIPT_MODEL, prompt, fields: { system_prompt: system } }];
}
