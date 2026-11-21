// Podcast Studio — an AI podcast episode with one or two hosts.
//   1) (optional) claude-sonnet-5-5 writes the script from a topic — or you write / paste it yourself;
//   2) elevenlabs-dialogue-v3 voices the whole dialogue in one MP3 (up to 15 lines, each up to 1,000 characters).

export const SCRIPT_MODEL = "claude-sonnet-5-5";
export const VOICE_MODEL = "elevenlabs-dialogue-v3";
export const MAX_TURNS = 15;
export const MAX_LINE = 1000;
// Voices accepted by elevenlabs-dialogue-v3 on AI SKILLS (params.dialogue.voices of the model).
export const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "f" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", gender: "f" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", gender: "f" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", gender: "f" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "m" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", gender: "m" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", gender: "m" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", gender: "m" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", gender: "m" },
];
export const FORMATS = [
  { id: "interview", label: { en: "Interview", ru: "Интервью" }, brief: "an interview: host 1 asks, host 2 is the expert" },
  { id: "chat", label: { en: "Two friends chat", ru: "Беседа друзей" }, brief: "a lively conversation between two friends who both know the topic" },
  { id: "debate", label: { en: "Debate", ru: "Спор" }, brief: "a friendly debate: the hosts take opposite sides, then find common ground" },
  { id: "solo", label: { en: "Solo episode", ru: "Монолог" }, brief: "a solo episode by host 1 only" },
];

export const APP = {
  id: "podcast-studio",
  name: "Podcast Studio",
  theme: "cyberpunk",
  tagline: { en: "Topic → podcast episode", ru: "Тема → выпуск подкаста" },
  kicker: { en: "AI podcast studio", ru: "ИИ-студия подкастов" },
  headline: { en: "Turn any topic into a podcast with two voices", ru: "Любая тема — выпуск подкаста на два голоса" },
  description: {
    en: "AI writes a natural dialogue for one or two hosts — or paste your own script — then voices it with lifelike voices, laughs and pauses. Download the MP3.",
    ru: "ИИ пишет живой диалог для одного или двух ведущих — или вставьте свой сценарий — и озвучивает его живыми голосами, со смехом и паузами. Скачайте MP3.",
  },
  models: [SCRIPT_MODEL, VOICE_MODEL],
  upload: { types: ["audio/mpeg"], maxBytes: 1 },
  slots: [],
  initialState: () => ({
    topic: "", format: "interview", language: "auto", lines: 10,
    hosts: [{ name: "Alex", voice: "pNInz6obpgDQGcFmaJgB" }, { name: "Mia", voice: "21m00Tcm4TlvDq8ikWAM" }],
    turns: [],
  }),
  priceModel: () => VOICE_MODEL,
};
