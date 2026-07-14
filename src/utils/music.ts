const supportedKeys = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
  "Cm", "C#m", "Dbm", "Dm", "D#m", "Ebm", "Em", "Fm", "F#m", "Gbm", "Gm", "G#m", "Abm", "Am", "A#m", "Bbm", "Bm"
] as const;

const chromatic: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11
};

export type SupportedMusicKey = (typeof supportedKeys)[number];

export function normalizeMusicKey(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, "") || null;

  if (!normalized) return null;
  const minor = normalized.endsWith("m");
  const root = minor ? normalized.slice(0, -1) : normalized;
  const match = supportedKeys.find((key) => key === normalized) ?? supportedKeys.find((key) => key === root);

  if (!match) return normalized;
  return minor && !match.endsWith("m") ? `${match}m` : match;
}

export function isSupportedMusicKey(value: string) {
  return supportedKeys.includes(value as SupportedMusicKey);
}

export function musicKeySemitones(referenceKey: string | null | undefined, performanceKey: string | null | undefined) {
  if (!referenceKey || !performanceKey) return null;
  const reference = chromatic[referenceKey.replace(/m$/, "")];
  const performance = chromatic[performanceKey.replace(/m$/, "")];
  if (reference === undefined || performance === undefined) return null;
  return (performance - reference + 12) % 12;
}

export function normalizeYouTubeUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const input = value.trim();
  let url: URL;
  try { url = new URL(input); } catch { return input; }
  if (!/^https?:$/.test(url.protocol)) return input;
  let videoId = url.searchParams.get("v");
  if (url.hostname === "youtu.be") videoId = url.pathname.slice(1).split("/")[0];
  if (url.hostname.endsWith("youtube.com") && url.pathname.startsWith("/shorts/")) videoId = url.pathname.split("/")[2];
  return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : input;
}

export function isYouTubeUrl(value: string | null | undefined) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname.toLowerCase()) && Boolean(url.searchParams.get("v") || url.hostname === "youtu.be" || url.pathname.startsWith("/shorts/"));
  } catch {
    return false;
  }
}

export function isSafeExternalUrl(value: string | null | undefined) {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

export const musicKeys = supportedKeys;
