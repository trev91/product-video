// Voiceover: one 48 kHz mono WAV per shot plus <prefix>durations.json for the edit.
// The profile's narration.mode picks the voice:
//   system    the computer's own voice, for timing or as final: macOS `say`, or espeak-ng
//             (or espeak) on Linux when installed. With neither, it stops and says what to do.
//   command   your own text-to-speech command: it reads $VO_TEXT_FILE and writes audio to $VO_OUT
//   recorded  a person supplies vo/<prefix><shot>.wav; this only measures them
//   silent    nothing to do (the hype cut has no narration)
//
//   node gen-vo.mjs                       every shot
//   node gen-vo.mjs --shots 01-1,02-1     just those shots, after a script change
//   node gen-vo.mjs --prefix test-        audition under another prefix
//   node gen-vo.mjs --captions-only       silent placeholder WAVs timed from the words (at
//                                         narration.wordsPerMinute), when there is no voice yet:
//                                         the edit and its captions build, with no voice
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadProfile, PROJECT_DIR } from "../lib/profile.mjs";
import { which } from "../lib/tools.mjs";
import { isEspeakVoice, noVoiceMessage, pickSystemVoice, placeholderSeconds, systemVoiceCommand } from "./voices.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const PREFIX = option("--prefix", "vo-");
const ONLY = option("--shots", "") ? option("--shots", "").split(",") : null;
const CAPTIONS_ONLY = args.includes("--captions-only");

const { narration } = loadProfile();
if (narration.mode === "silent") {
  console.log("narration.mode is silent: nothing to generate");
  process.exit(0);
}
const engine = narration.mode === "system" && !CAPTIONS_ONLY ? pickSystemVoice({ which }) : null;
if (narration.mode === "system" && !CAPTIONS_ONLY && !engine) {
  console.error(noVoiceMessage());
  process.exit(1);
}
if (CAPTIONS_ONLY) {
  console.warn("WARNING: --captions-only writes SILENT placeholder voice files timed from the words.");
  console.warn("The video will have captions and no voice until real voice files replace them.");
}
if (engine && engine !== "say" && narration.voice && !isEspeakVoice(narration.voice)) {
  console.warn(`narration.voice "${narration.voice}" is not an ${engine} voice; using en-us.`);
}
const dir = path.join(PROJECT_DIR, "vo");
const lines = JSON.parse(readFileSync(path.join(dir, "lines.json"), "utf8"));
const durationsPath = path.join(dir, `${PREFIX}durations.json`);
const durations = existsSync(durationsPath) ? JSON.parse(readFileSync(durationsPath, "utf8")) : {};

/** Applies the profile's pronunciations, longest spelling first. */
function spoken(text) {
  const entries = Object.entries(narration.pronunciations ?? {}).sort((a, b) => b[0].length - a[0].length);
  return entries.reduce((result, [written, said]) => result.split(written).join(said), text);
}

const seconds = (file) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

for (const line of lines) {
  if (ONLY && !ONLY.includes(line.shot)) continue;
  const wav = path.join(dir, `${PREFIX}${line.shot}.wav`);
  if (CAPTIONS_ONLY) {
    const length = placeholderSeconds(spoken(line.text), narration.wordsPerMinute ?? 150);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", String(length),
      "-c:a", "pcm_s16le", wav]);
  } else if (engine === "say") {
    const [command, commandArgs] = systemVoiceCommand("say", { text: spoken(line.text), out: wav, voice: narration.voice, wordsPerMinute: narration.wordsPerMinute });
    execFileSync(command, commandArgs);
  } else if (engine) {
    // espeak writes its own sample rate: convert to 48 kHz mono 16-bit, trimming lead and tail silence.
    const raw = path.join(dir, `${PREFIX}${line.shot}.raw.wav`);
    const [command, commandArgs] = systemVoiceCommand(engine, { text: spoken(line.text), out: raw, voice: narration.voice, wordsPerMinute: narration.wordsPerMinute });
    execFileSync(command, commandArgs);
    const trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15";
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", `${trim},areverse,${trim},areverse`,
      "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
    rmSync(raw, { force: true });
  } else if (narration.mode === "command") {
    const textFile = path.join(dir, `${PREFIX}${line.shot}.txt`);
    const raw = path.join(dir, `${PREFIX}${line.shot}.raw.wav`);
    writeFileSync(textFile, spoken(line.text));
    execSync(narration.command, {
      stdio: "inherit",
      env: { ...process.env, VO_TEXT_FILE: textFile, VO_OUT: raw, VO_VOICE: narration.voice ?? "" },
    });
    // 48 kHz mono 16-bit, with the lead and tail silence trimmed.
    const trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15";
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", `${trim},areverse,${trim},areverse`,
      "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
  } else if (!existsSync(wav)) {
    throw new Error(`narration.mode is recorded but ${wav} is missing`);
  }
  durations[line.shot] = Math.round(seconds(wav) * 1000) / 1000;
  console.log(`${line.shot}: ${durations[line.shot]}s`);
  writeFileSync(durationsPath, `${JSON.stringify(durations, null, 2)}\n`);
}
const total = Object.values(durations).reduce((sum, value) => sum + value, 0);
console.log(`total ${total.toFixed(1)}s across ${Object.keys(durations).length} shots`);
