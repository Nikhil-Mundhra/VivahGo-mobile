import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { Caption } from "@remotion/captions";
import * as dotenv from "dotenv";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  defaultVendorTutorialAudioManifest,
  getVendorTutorialNarration,
  vendorTutorialScenes,
  VENDOR_TUTORIAL_AUDIO_MANIFEST,
  VENDOR_TUTORIAL_BACKGROUND_AUDIO,
  VENDOR_TUTORIAL_END_HOLD_FRAMES,
  VENDOR_TUTORIAL_FPS,
  type VendorTutorialAudioManifest,
} from "../src/lib/vendorTutorial";

dotenv.config({ quiet: true });

type Provider = "sarvam" | "elevenlabs" | "say";

const args = process.argv.slice(2);
const providerArg = args.find((arg) => arg.startsWith("--provider="));
const provider = (providerArg?.split("=")[1] as Provider | undefined) ??
  (process.env.SARVAM_API_KEY
    ? "sarvam"
    : process.env.ELEVENLABS_API_KEY
      ? "elevenlabs"
      : "say");
const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const sayVoice = process.env.MACOS_VENDOR_TUTORIAL_VOICE || "Aman";
const sayRate = Number(process.env.MACOS_VENDOR_TUTORIAL_RATE || 205);
const sarvamApiKey = process.env.SARVAM_API_KEY || "";
const sarvamSpeaker = process.env.SARVAM_VENDOR_SPEAKER || "rahul";
const sarvamLanguageCode = process.env.SARVAM_VENDOR_LANGUAGE_CODE || "hi-IN";
const sarvamPace = Number(process.env.SARVAM_VENDOR_PACE || 1.04);
const sarvamModel = process.env.SARVAM_VENDOR_MODEL || "bulbul:v3";
const sarvamApiBase =
  process.env.SARVAM_API_BASE || "https://api.sarvam.ai";

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, "public");
const vendorRoot = path.join(publicRoot, "tutorial", "vendor");
const audioRoot = path.join(vendorRoot, "audio");
const manifestPath = path.join(publicRoot, VENDOR_TUTORIAL_AUDIO_MANIFEST);
const backgroundBedPath = path.join(publicRoot, VENDOR_TUTORIAL_BACKGROUND_AUDIO);
const preferredLicensedTrackRelative = "tutorial/vendor/audio/happy-home.mp3";
const preferredLicensedTrackPath = path.join(
  publicRoot,
  preferredLicensedTrackRelative,
);

mkdirSync(audioRoot, { recursive: true });

const ensureParentDirectory = (targetPath: string) => {
  mkdirSync(path.dirname(targetPath), { recursive: true });
};

const splitCaptionText = (text: string): string[] => {
  const segments = text
    .split(/(?<=[.!?।])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length > 1) {
    return segments;
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 9) {
    return [text.trim()];
  }

  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
};

const createCaptions = (text: string, durationMs: number): Caption[] => {
  const segments = splitCaptionText(text);
  const segmentDuration = durationMs / segments.length;

  return segments.map((segment, index) => {
    const startMs = Math.round(index * segmentDuration);
    const endMs = Math.round((index + 1) * segmentDuration);

    return {
      text: segment,
      startMs,
      endMs,
      timestampMs: startMs,
      confidence: null,
    };
  });
};

const getAudioDurationMs = (audioPath: string) => {
  const output = execFileSync("/usr/bin/afinfo", [audioPath], {
    encoding: "utf8",
  });
  const estimatedDurationMatch = output.match(
    /estimated duration:\s*([0-9.]+)\s*sec/i,
  );

  if (estimatedDurationMatch) {
    return Math.round(Number(estimatedDurationMatch[1]) * 1000);
  }

  const sampleFramesMatch = output.match(/audio\s+([0-9]+)\s+sample frames/i);
  const sampleRateMatch = output.match(/,\s*([0-9.]+)\s*Hz,/i);

  if (sampleFramesMatch && sampleRateMatch) {
    return Math.round(
      (Number(sampleFramesMatch[1]) / Number(sampleRateMatch[1])) * 1000,
    );
  }

  throw new Error(`Could not determine duration for ${audioPath}`);
};

const writeAmbientBed = (outputPath: string, durationSeconds: number) => {
  const sampleRate = 22050;
  const channelCount = 2;
  const totalFrames = Math.floor(sampleRate * durationSeconds);
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = channelCount * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = totalFrames * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const masterGain = 0.19;
  const chordProgression = [
    [220.0, 277.18, 329.63],
    [246.94, 311.13, 369.99],
    [261.63, 329.63, 392.0],
    [293.66, 369.99, 440.0],
  ];

  for (let i = 0; i < totalFrames; i++) {
    const time = i / sampleRate;
    const fadeIn = Math.min(time / 2.8, 1);
    const fadeOut = Math.min((durationSeconds - time) / 4.8, 1);
    const envelope = Math.max(0, Math.min(fadeIn, fadeOut));
    const pulse = 0.66 + 0.34 * Math.sin(2 * Math.PI * 2.2 * time);
    const chordIndex = Math.floor(time / 3.4) % chordProgression.length;
    const [root, third, fifth] = chordProgression[chordIndex];
    const padRoot = Math.sin(2 * Math.PI * root * time) * 0.26;
    const padThird = Math.sin(2 * Math.PI * third * time) * 0.22;
    const padFifth = Math.sin(2 * Math.PI * fifth * time) * 0.16;
    const lift = Math.sin(2 * Math.PI * (third * 2) * time) * 0.06;
    const shimmer = Math.sin(2 * Math.PI * (fifth * 2) * time) * 0.04 * pulse;
    const warmth = Math.sin(2 * Math.PI * (root / 2) * time) * 0.08;
    const sample =
      (padRoot + padThird + padFifth + lift + shimmer + warmth) *
      envelope *
      masterGain;
    const clamped = Math.max(-1, Math.min(1, sample));
    const value = Math.round(clamped * 32767);
    const offset = 44 + i * blockAlign;

    buffer.writeInt16LE(value, offset);
    buffer.writeInt16LE(value, offset + bytesPerSample);
  }

  ensureParentDirectory(outputPath);
  writeFileSync(outputPath, buffer);
};

const readStreamToBuffer = async (
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (value) {
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
};

const generateWithSay = (text: string, outputPath: string) => {
  const tempAiff = path.join(tmpdir(), `vendor-tutorial-${randomUUID()}.aiff`);

  try {
    execFileSync(
      "/usr/bin/say",
      ["-v", sayVoice, "-r", String(sayRate), "-o", tempAiff, text],
      { stdio: "inherit" },
    );
    execFileSync(
      "/usr/bin/afconvert",
      ["-f", "WAVE", "-d", "LEI16@22050", tempAiff, outputPath],
      { stdio: "inherit" },
    );
  } finally {
    rmSync(tempAiff, { force: true });
  }
};

const generateWithElevenLabs = async (text: string, outputPath: string) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is required for --provider=elevenlabs");
  }

  const client = new ElevenLabsClient({
    environment: "https://api.elevenlabs.io",
    apiKey,
  });

  const response = await client.textToSpeech.convert(voiceId, {
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
    text,
    voiceSettings: {
      stability: 0.45,
      similarityBoost: 0.77,
      style: 0.18,
      useSpeakerBoost: true,
    },
  });

  const audioBuffer = await readStreamToBuffer(response);
  writeFileSync(outputPath, audioBuffer);
};

const generateWithSarvam = async (text: string, outputPath: string) => {
  if (!sarvamApiKey) {
    throw new Error("SARVAM_API_KEY is required for --provider=sarvam");
  }

  const response = await fetch(`${sarvamApiBase}/text-to-speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": sarvamApiKey,
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: sarvamLanguageCode,
      speaker: sarvamSpeaker,
      model: sarvamModel,
      pace: sarvamPace,
      speech_sample_rate: 22050,
      enable_preprocessing: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Sarvam TTS request failed (${response.status}): ${errorText}`,
    );
  }

  const payload = (await response.json()) as {
    audios?: string[];
    audio?: string;
  };

  const base64Audio = payload.audios?.[0] || payload.audio;
  if (!base64Audio) {
    throw new Error("Sarvam TTS response did not include base64 audio");
  }

  writeFileSync(outputPath, Buffer.from(base64Audio, "base64"));
};

const main = async () => {
  const manifest: VendorTutorialAudioManifest = {
    ...defaultVendorTutorialAudioManifest,
    generatedWith: provider,
    backgroundMusicFile: existsSync(preferredLicensedTrackPath)
      ? preferredLicensedTrackRelative
      : VENDOR_TUTORIAL_BACKGROUND_AUDIO,
    scenes: [],
  };

  const estimatedDurationSeconds =
    vendorTutorialScenes.reduce(
      (sum, scene) => sum + scene.fallbackDurationInFrames,
      0,
    ) /
      VENDOR_TUTORIAL_FPS +
    VENDOR_TUTORIAL_END_HOLD_FRAMES / VENDOR_TUTORIAL_FPS +
    6;

  if (!existsSync(preferredLicensedTrackPath)) {
    writeAmbientBed(backgroundBedPath, estimatedDurationSeconds);
  }

  for (const scene of vendorTutorialScenes) {
    const narrationText = getVendorTutorialNarration(scene, provider);
    const extension = provider === "elevenlabs" ? "mp3" : "wav";
    const outputPath = path.join(audioRoot, `${scene.id}.${extension}`);
    const audioFile = `tutorial/vendor/audio/${scene.id}.${extension}`;

    ensureParentDirectory(outputPath);

    if (provider === "sarvam") {
      await generateWithSarvam(narrationText, outputPath);
    } else if (provider === "elevenlabs") {
      await generateWithElevenLabs(narrationText, outputPath);
    } else {
      generateWithSay(narrationText, outputPath);
    }

    const durationMs = getAudioDurationMs(outputPath);
    const durationInFrames = Math.max(
      scene.fallbackDurationInFrames,
      Math.ceil((durationMs / 1000) * VENDOR_TUTORIAL_FPS),
    );

    manifest.scenes.push({
      sceneId: scene.id,
      audioFile,
      durationInFrames,
      captions: createCaptions(narrationText, durationMs),
    });
  }

  manifest.totalDurationInFrames =
    manifest.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0) +
    VENDOR_TUTORIAL_END_HOLD_FRAMES;

  ensureParentDirectory(manifestPath);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(
    `Generated vendor tutorial audio with ${provider}. Total duration: ${(
      manifest.totalDurationInFrames / VENDOR_TUTORIAL_FPS
    ).toFixed(1)}s`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
