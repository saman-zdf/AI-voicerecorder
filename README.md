## 🛠 Requirements

- **Node.js** (LTS version recommended)
- **SoX** (audio recorder backend)
- **Microphone access**
- **OpenAI API key** (Whisper + GPT)

---

## 1) Install Node.js

Download and install from:  
https://nodejs.org

Verify installation:

```bash
node -v
npm -v
```

---

## 2) Install SoX (required for microphone recording)

### macOS (Homebrew)

```bash
brew install sox
```

### Windows (Chocolatey)

```powershell
choco install sox
```

### Linux (Debian/Ubuntu)

```bash
sudo apt-get update
sudo apt-get install sox
```

Check installation:

```bash
sox --version
```

---

## 3) Get Your OpenAI API Key

1. Log into your OpenAI account
2. Go to API keys and create a key
3. Create a `.env` file in the project folder:

```
OPENAI_API_KEY=your_key_here
```

---

## 4) Install Dependencies

In your project folder, run:

```bash
npm install openai dotenv node-record-lpcm16
```

---

## 5) Run the App

```bash
node index.js
```

You will see:

```
🎙️ Say Hey Snapp to activate
```

Say your wake phrase (must match exactly one entry in the `cases` list in the code).  
Then you'll hear:

```
🎙️ Hi, what can we do for you today?
```

Speak your request (e.g., "Book a ride to the city tomorrow at 9am").  
The app will convert, interpret, and simulate an action.

---

## 6) Troubleshooting

| Issue                      | Solution                                                             |
| -------------------------- | -------------------------------------------------------------------- |
| `SoX ENOENT`               | SoX is not installed or not in PATH. Reinstall and restart terminal. |
| Microphone does not record | Check OS microphone permissions.                                     |
| No wake word detected      | Add exact phrase to `cases` array in code.                           |
| OpenAI API errors          | Ensure your `.env` file contains a valid API key.                    |

---

## 🧠 How It Works (Simple Flow)

1. Record short audio → detect wake word
2. If matched: record full voice command
3. Convert voice to text (Whisper)
4. Analyze intent (GPT)
5. Print simulated result
6. Cleanup temporary audio files

---

## 📄 Notes

- Make sure your environment is not too noisy
- Silence stops recording automatically
- You can customize wake words in the `cases` array
