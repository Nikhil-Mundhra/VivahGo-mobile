import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import * as dotenv from "dotenv";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Caption } from "@remotion/captions";
import {
  defaultPlannerTutorialAudioManifest,
  getPlannerTutorialNarration,
  plannerTutorialScenes,
  PLANNER_TUTORIAL_AUDIO_MANIFEST,
  PLANNER_TUTORIAL_BACKGROUND_AUDIO,
  PLANNER_TUTORIAL_FPS,
  type PlannerTutorialAudioManifest,
} from "../src/lib/plannerTutorial";

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
const sayVoice = process.env.MACOS_TUTORIAL_VOICE || "Aman";
const sayRate = Number(process.env.MACOS_TUTORIAL_RATE || 216);
const sarvamApiKey = process.env.SARVAM_API_KEY || "";
const sarvamSpeaker = process.env.SARVAM_SPEAKER || "priya";
const sarvamLanguageCode = process.env.SARVAM_LANGUAGE_CODE || "hi-IN";
const sarvamPace = Number(process.env.SARVAM_PACE || 1);
const sarvamModel = process.env.SARVAM_MODEL || "bulbul:v3";
const sarvamApiBase =
  process.env.SARVAM_API_BASE || "https://api.sarvam.ai";

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, "public");
const tutorialRoot = path.join(publicRoot, "tutorial");
const audioRoot = path.join(tutorialRoot, "audio");
const manifestPath = path.join(publicRoot, PLANNER_TUTORIAL_AUDIO_MANIFEST);
const backgroundBedPath = path.join(publicRoot, PLANNER_TUTORIAL_BACKGROUND_AUDIO);

mkdirSync(audioRoot, { recursive: true });

const ensureParentDirectory = (targetPath: string) => {
  mkdirSync(path.dirname(targetPath), { recursive: true });
};

const splitCaptionText = (text: string): string[] => {
  const segments = text
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length > 1) {
    return segments;
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 10) {
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

  const masterGain = 0.22;
  const chordProgression = [
    [261.63, 329.63, 392.0],
    [293.66, 369.99, 440.0],
    [329.63, 415.3, 493.88],
    [392.0, 493.88, 587.33],
  ];

  for (let i = 0; i < totalFrames; i++) {
    const time = i / sampleRate;
    const fadeIn = Math.min(time / 3, 1);
    const fadeOut = Math.min((durationSeconds - time) / 4, 1);
    const envelope = Math.max(0, Math.min(fadeIn, fadeOut));
    const pulse = 0.62 + 0.38 * Math.sin(2 * Math.PI * 1.9 * time);
    const chordIndex = Math.floor(time / 3.2) % chordProgression.length;
    const [root, third, fifth] = chordProgression[chordIndex];
    const padRoot = Math.sin(2 * Math.PI * root * time) * 0.28;
    const padThird = Math.sin(2 * Math.PI * third * time) * 0.22;
    const padFifth = Math.sin(2 * Math.PI * fifth * time) * 0.18;
    const octaveLift = Math.sin(2 * Math.PI * root * 2 * time) * 0.08;
    const sparkle = Math.sin(2 * Math.PI * (fifth * 2) * time) * 0.05 * pulse;
    const lowWarmth = Math.sin(2 * Math.PI * (root / 2) * time) * 0.1;
    const sample =
      (padRoot + padThird + padFifth + octaveLift + sparkle + lowWarmth) *
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
  const tempAiff = path.join(tmpdir(), `planner-tutorial-${randomUUID()}.aiff`);

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
      stability: 0.44,
      similarityBoost: 0.76,
      style: 0.28,
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
  const manifest: PlannerTutorialAudioManifest = {
    ...defaultPlannerTutorialAudioManifest,
    generatedWith: provider,
    backgroundMusicFile: PLANNER_TUTORIAL_BACKGROUND_AUDIO,
    scenes: [],
  };

  const estimatedDurationSeconds =
    plannerTutorialScenes.reduce(
      (sum, scene) => sum + scene.fallbackDurationInFrames,
      0,
    ) /
      PLANNER_TUTORIAL_FPS +
    6;

  writeAmbientBed(backgroundBedPath, estimatedDurationSeconds);

  for (const scene of plannerTutorialScenes) {
    const narrationText = getPlannerTutorialNarration(scene, provider);
    const extension = provider === "elevenlabs" ? "mp3" : "wav";
    const outputPath = path.join(audioRoot, `${scene.id}.${extension}`);
    const audioFile = `tutorial/audio/${scene.id}.${extension}`;

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
      Math.ceil((durationMs / 1000) * PLANNER_TUTORIAL_FPS),
    );

    manifest.scenes.push({
      sceneId: scene.id,
      audioFile,
      durationInFrames,
      captions: createCaptions(narrationText, durationMs),
    });
  }

  manifest.totalDurationInFrames = manifest.scenes.reduce(
    (sum, scene) => sum + scene.durationInFrames,
    0,
  );

  ensureParentDirectory(manifestPath);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(
    `Generated planner tutorial audio with ${provider}. Total duration: ${(
      manifest.totalDurationInFrames / PLANNER_TUTORIAL_FPS
    ).toFixed(1)}s`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
