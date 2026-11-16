/**
 * Which local voice `narration.mode: system` uses, and the silent fallback. No downloads, no
 * paid or network services: macOS `say`, else espeak-ng (or espeak) when it is installed.
 * A better local voice such as piper fits `narration.mode: command` (see the pipeline reference).
 */

/** The engines tried, in order. */
export const SYSTEM_ENGINES = ["say", "espeak-ng", "espeak"];

/** The first engine available here, or null. `which(name)` returns a path or null. */
export function pickSystemVoice({ platform = process.platform, which }) {
  for (const engine of SYSTEM_ENGINES) {
    if (engine === "say" && platform !== "darwin") continue;
    if (which(engine)) return engine;
  }
  return null;
}

/** An espeak voice is a language code such as "en", "en-us" or "en-gb-x-rp"; macOS names like "Samantha" are not. */
export function isEspeakVoice(voice) {
  return typeof voice === "string" && /^[a-z]{2,3}(?:[-_][a-z0-9-]+)?$/.test(voice);
}

/**
 * The command line that speaks `text` into `out` (a WAV file).
 * `say` writes 48 kHz 16-bit directly; espeak writes its own rate, which gen-vo converts.
 */
export function systemVoiceCommand(engine, { text, out, voice, wordsPerMinute = 150 }) {
  const rate = String(wordsPerMinute);
  if (engine === "say") return ["say", [...(voice ? ["-v", voice] : []), "-r", rate, "-o", out, "--data-format=LEI16@48000", text]];
  const language = isEspeakVoice(voice) ? voice : "en-us";
  return [engine, ["-v", language, "-s", rate, "-w", out, text]];
}

/** How long `text` takes to say at `wordsPerMinute`, in seconds (at least 1), for a silent placeholder. */
export function placeholderSeconds(text, wordsPerMinute = 150) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / wordsPerMinute) * 60 * 1000) / 1000);
}

/** The message when system mode has no voice on this computer. */
export function noVoiceMessage(platform = process.platform) {
  return [
    `narration.mode is "system", but this computer has no system voice (${platform === "darwin" ? "macOS say is missing" : "macOS say is macOS only, and espeak-ng is not installed"}).`,
    "Choose one:",
    "  - install a local voice: espeak-ng (for example `sudo apt install espeak-ng`), then run this again;",
    "  - set narration.mode to \"command\" with your own text-to-speech command (piper works offline),",
    "    or to \"recorded\" and supply vo/<prefix><shot>.wav files;",
    "  - or run `node vo/gen-vo.mjs --captions-only` for silent placeholders timed from the words, so",
    "    the edit and its captions can be built now and the voice added later.",
  ].join("\n");
}
