// Voiceover: one 48 kHz mono WAV per shot plus <prefix>durations.json for the edit.
// The profile's narration.mode picks the voice:
//   system    the operating system's voice (macOS `say`), for timing or as final
//   command   your own text-to-speech command: it reads $VO_TEXT_FILE and writes audio to $VO_OUT
//   recorded  a person supplies vo/<prefix><shot>.wav; this only measures them
//   silent    nothing to do (the hype cut has no narration)
//
//   node gen-vo.mjs                       every shot
//   node gen-vo.mjs --shots 01-1,02-1     just those shots, after a script change
//   node gen-vo.mjs --prefix test-        audition under another prefix
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadProfile, PROJECT_DIR } from "../lib/profile.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const PREFIX = option("--prefix", "vo-");
const ONLY = option("--shots", "") ? option("--shots", "").split(",") : null;

const { narration } = loadProfile();
if (narration.mode === "silent") {
  console.log("narration.mode is silent: nothing to generate");
  process.exit(0);
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
  if (narration.mode === "system") {
    const voice = narration.voice ? ["-v", narration.voice] : [];
    const rate = String(narration.wordsPerMinute ?? 150);
    execFileSync("say", [...voice, "-r", rate, "-o", wav, "--data-format=LEI16@48000", spoken(line.text)]);
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
