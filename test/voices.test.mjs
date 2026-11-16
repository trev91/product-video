import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isEspeakVoice,
  noVoiceMessage,
  pickSystemVoice,
  placeholderSeconds,
  systemVoiceCommand,
} from "../skills/product-video/assets/template/vo/voices.mjs";

const has = (...commands) => (name) => (commands.includes(name) ? `/usr/bin/${name}` : null);

describe("pickSystemVoice", () => {
  it("uses say on macOS", () => {
    assert.equal(pickSystemVoice({ platform: "darwin", which: has("say", "espeak-ng") }), "say");
  });

  it("never uses say off macOS, and prefers espeak-ng to espeak", () => {
    assert.equal(pickSystemVoice({ platform: "linux", which: has("say", "espeak-ng", "espeak") }), "espeak-ng");
    assert.equal(pickSystemVoice({ platform: "linux", which: has("espeak") }), "espeak");
  });

  it("returns null when there is no local voice", () => {
    assert.equal(pickSystemVoice({ platform: "linux", which: has() }), null);
  });
});

describe("systemVoiceCommand", () => {
  it("keeps the macOS say arguments", () => {
    assert.deepEqual(systemVoiceCommand("say", { text: "Hello there.", out: "/tmp/a.wav", voice: "Samantha", wordsPerMinute: 160 }),
      ["say", ["-v", "Samantha", "-r", "160", "-o", "/tmp/a.wav", "--data-format=LEI16@48000", "Hello there."]]);
  });

  it("passes espeak a language voice, and ignores a macOS voice name", () => {
    assert.deepEqual(systemVoiceCommand("espeak-ng", { text: "Hi.", out: "/tmp/a.wav", voice: "en-gb" }), ["espeak-ng", ["-v", "en-gb", "-s", "150", "-w", "/tmp/a.wav", "Hi."]]);
    assert.deepEqual(systemVoiceCommand("espeak-ng", { text: "Hi.", out: "/tmp/a.wav", voice: "Samantha" })[1].slice(0, 2), ["-v", "en-us"]);
    assert.equal(isEspeakVoice("en-us"), true);
    assert.equal(isEspeakVoice("Samantha"), false);
  });
});

describe("captions-only fallback", () => {
  it("times a placeholder from the words at the profile's pace", () => {
    assert.equal(placeholderSeconds("one two three four five six seven eight nine ten", 150), 4);
    assert.equal(placeholderSeconds("Hi.", 150), 1);
  });

  it("explains the choices when there is no voice", () => {
    const message = noVoiceMessage("linux");
    assert.match(message, /espeak-ng/);
    assert.match(message, /--captions-only/);
    assert.match(message, /recorded/);
  });
});
