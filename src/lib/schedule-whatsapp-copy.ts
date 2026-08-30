export type ScheduleWhatsAppSong = {
  performanceKey: string | null;
  youtubeUrlOverride: string | null;
  song: { title: string; youtubeUrl: string | null };
  leadMember: { name: string } | null;
};

export type ClipboardRuntime = {
  writeText?: (text: string) => Promise<void>;
  fallbackCopy: (text: string) => boolean;
};

export function buildScheduleWhatsAppMessage(scheduleTitle: string, songs: ScheduleWhatsAppSong[]) {
  return [
    `Escala de ${scheduleTitle}`,
    "",
    ...songs.map((item, index) =>
      `${index + 1}. ${item.song.title}${item.performanceKey ? ` - ${item.performanceKey}` : ""}${item.leadMember ? `\n   Ministro: ${item.leadMember.name}` : ""}${item.youtubeUrlOverride || item.song.youtubeUrl ? `\n   Referencia: ${item.youtubeUrlOverride || item.song.youtubeUrl}` : ""}`
    )
  ].join("\n");
}

function fallbackCopyText(text: string) {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;

  const previouslyFocused = document.activeElement as HTMLElement | null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.style.position = "fixed";
  textarea.style.inset = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    previouslyFocused?.focus({ preventScroll: true });
  }
}

function browserClipboardRuntime(): ClipboardRuntime {
  return {
    writeText: typeof navigator !== "undefined" && navigator.clipboard?.writeText
      ? (text) => navigator.clipboard.writeText(text)
      : undefined,
    fallbackCopy: fallbackCopyText
  };
}

export async function copyScheduleWhatsAppText(text: string, runtime = browserClipboardRuntime()) {
  if (!text.trim()) return false;

  if (runtime.writeText) {
    try {
      await runtime.writeText(text);
      return true;
    } catch {
      // Browsers can reject Clipboard API access even in a secure context.
    }
  }

  try {
    return runtime.fallbackCopy(text);
  } catch {
    return false;
  }
}
