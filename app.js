import fs from "fs";
import record from "node-record-lpcm16";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
// ^ Loads variables from a .env file into process.env (e.g., OPENAI_API_KEY)

const cases = [
  "Hey Snapp",
  "Hei Snapp",
  "He Snapp",
  "Hey, Snap!",
  "Hey Snap!",
  "it's Snap.",
  "Hey, Snap.",
  "Hey, it's Snap.",
  "Hey You Snap",
  "Hey, you snap.",
];
// ^ List of exact activation phrases that count as "wake words"

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// ^ Creates an OpenAI client.

const AUDIO_FILE_ACTIVATION = "./.tmp-voice/activation-recording.wav";
// ^ Temporary file path that stores the short "activation" recording
const AUDIO_FILE = "./.temp-recording.wav";
// ^ Temporary file path that stores the main user command recording

// This is mock activation like, "Hey Siri"
function recordVoiceActivation() {
  // Records a short audio clip to detect the wake phrase (e.g., “Hey Snap”).
  // Auto-stops on brief silence or after a hard timeout.
  return new Promise((resolve, reject) => {
    console.log("🎙️ Say Hey Snapp to activate");

    const file = fs.createWriteStream(AUDIO_FILE_ACTIVATION, {
      encoding: "binary",
    });
    file.on("error", (e) =>
      reject(new Error("File write error: " + e.message))
    );

    const rec = record.record({
      recordProgram: "sox", // 👈 force use of SoX on macOS
      sampleRateHertz: 16000,
      threshold: 0.5, // sensitivity
      silence: "0.2", // auto-stop after 2ms silence
      verbose: false,
    });

    rec
      .stream()
      .on("error", (e) => {
        // Handles missing SoX or microphone stream errors
        reject(
          new Error(
            e.code === "ENOENT"
              ? "SoX not found. Install with `brew install sox` and ensure it’s on PATH."
              : "Mic stream error: " + e.message
          )
        );
      })
      .pipe(file)
      .on("finish", () => {
        // Called when the recording file is closed (silence detected)
        console.log("🛑 Recording stopped (silence detected).");
        resolve(AUDIO_FILE_ACTIVATION);
      });

    // Fallback timeout in case silence isn’t detected
    setTimeout(() => {
      try {
        record.stop();
      } catch {}
      resolve(AUDIO_FILE_ACTIVATION);
    }, 15000);
  });
}

function recordVoice() {
  // Records the user's actual request after activation.
  // Auto-stops after ~3 seconds of silence or a hard timeout.
  return new Promise((resolve, reject) => {
    console.log("🎙️ Hi, what can we do for you today?");

    const file = fs.createWriteStream(AUDIO_FILE, { encoding: "binary" });
    file.on("error", (e) =>
      reject(new Error("File write error: " + e.message))
    );

    const rec = record.record({
      recordProgram: "sox", // 👈 force use of SoX on macOS
      sampleRateHertz: 16000,
      threshold: 0.5, // sensitivity
      silence: "3.0", // auto-stop after 3s silence
      verbose: false,
    });

    rec
      .stream()
      .on("error", (e) => {
        // Handles missing SoX or microphone stream errors
        reject(
          new Error(
            e.code === "ENOENT"
              ? "SoX not found. Install with `brew install sox` and ensure it’s on PATH."
              : "Mic stream error: " + e.message
          )
        );
      })
      .pipe(file)
      .on("finish", () => {
        // Called when the recording file is closed (silence detected)
        console.log("🛑 Recording stopped (silence detected).");
        resolve(AUDIO_FILE);
      });

    // Fallback timeout in case silence isn’t detected
    setTimeout(() => {
      try {
        record.stop();
      } catch {}
      resolve(AUDIO_FILE);
    }, 15000);
  });
}

async function voiceToTextActivation(audioFilePath) {
  // Sends the activation audio to OpenAI Whisper for transcription (wake phrase).
  const transcription = await client.audio.transcriptions.create({
    file: fs.createReadStream(audioFilePath),
    model: "whisper-1",
  });
  console.log("🗣️ Activated!");
  return transcription.text;
}

async function voiceToText(audioFilePath) {
  // Sends the main command audio to OpenAI Whisper for transcription (free-form text).
  const transcription = await client.audio.transcriptions.create({
    file: fs.createReadStream(audioFilePath),
    model: "whisper-1",
  });
  console.log("🗣️ Transcribed Text:", transcription.text);
  return transcription.text;
}

async function analyzeIntent(text) {
  // Calls a chat model to turn the user's text into a simple intent JSON.
  // Expected output example:
  // {"intent":"book_ride","destination":"Sydney","date":"2025-01-02","time":"09:30"}
  const r = await client.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content:
          'You are an intent parser for a ride app. Return ONLY valid JSON: {"intent":..., "destination"?:..., "date"?..., "time"?...}.',
      },
      { role: "user", content: text },
    ],
  });
  const raw = r.choices[0].message.content?.trim() || "";
  console.log("🧩 Intent JSON:", raw);
  try {
    return JSON.parse(raw);
  } catch {
    // If the model output isn’t valid JSON, return null and handle gracefully.
    return null;
  }
}

async function executeCommand(cmd) {
  // Simulates handling intents. In a real app you’d call your backend here.
  if (!cmd?.intent) return console.log("❌ No valid command.");
  switch (cmd.intent) {
    case "book_ride":
      return console.log(
        `📆 Booking ride to: ${cmd.destination || "(no destination provided)"}`,
        cmd.date && cmd.time ? `for ${cmd.date} at ${cmd.time}` : null
      );
    case "request_ride":
      return console.log(
        `🚗 Request ride to: ${
          cmd.destination || "(no destination provided) at"
        }`
      );
    case "cancel_ride":
      return console.log("❌ Ride cancelled.");
    case "get_price_estimate":
      return console.log(
        `💰 Getting price estimate to: ${
          cmd.destination || "(no destination provided)"
        }`
      );
    default:
      return console.log("🤷 Unknown intent:", cmd.intent);
  }
}

async function main() {
  // Orchestrates the whole flow:
  // 1) Record activation
  // 2) Transcribe and check if it matches one of the allowed activation phrases
  // 3) If matched, record the main command
  // 4) Transcribe, parse intent, and "execute"
  // 5) Clean up temp audio files
  const activationAudio = await recordVoiceActivation();
  const activationText = await voiceToTextActivation(activationAudio);
  if (!cases.includes(activationText)) {
    console.log("Please add the text to the cases array: =>", activationText);
  }

  if (cases.includes(activationText)) {
    const audio = await recordVoice();
    const text = await voiceToText(audio);
    const cmd = await analyzeIntent(text);
    await executeCommand(cmd);
    try {
      fs.unlinkSync(AUDIO_FILE);
      fs.unlinkSync(AUDIO_FILE_ACTIVATION);
    } catch {}
  }
}

main().catch((e) => {
  // Global error handler for the whole app
  console.error("App error:", e.message);
  console.error(
    "If this mentions `sox ENOENT`, install SoX and ensure PATH is set."
  );
});
