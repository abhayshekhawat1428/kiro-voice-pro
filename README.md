<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-Extension-blue?logo=visualstudiocode" alt="VS Code Extension">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/AI-Local%20First-purple" alt="Local AI">
</p>

<h1 align="center">Kiro Voice Pro</h1>

<p align="center">
  <strong>Voice-to-text for VS Code, Cursor, and Kiro with local AI optimization.</strong>
  <br>
  Speak naturally. Get clean, polished text. Pasted wherever your cursor is.
</p>

---

## Why Kiro Voice Pro?

Most voice-to-text tools give you raw transcription full of "um", "like", and broken grammar. Kiro Voice Pro runs your speech through a local LLM to clean it up before pasting — all without sending data to the cloud.

Everything runs on your machine.

## Features

| Feature | Description |
|---------|-------------|
| One-Click Recording | Click the mic button in the status bar and start talking |
| Smart Auto-Stop | Automatically stops after configurable silence duration |
| AI Text Cleanup | Removes filler words, fixes grammar using local Ollama |
| Universal Paste | Works in editor, chat panels, terminal — anywhere |
| 100% Local | No cloud APIs required (OpenAI optional) |

## Quick Start

1. Install from the VS Code Marketplace (search "Kiro Voice Pro")
2. Click **Voice** in the status bar
3. Speak your text
4. Wait for silence (3s) or click again to stop
5. Text is cleaned and pasted automatically

## Requirements

| Requirement | Purpose | Auto-Setup |
|-------------|---------|------------|
| [Ollama](https://ollama.com) | Local AI text cleanup | Prompted on first use |
| Microphone | Voice input | — |
| Accessibility Permission (macOS) | Auto-paste functionality | Guided setup |

## Configuration

Access via `Settings > Extensions > Kiro Voice`

| Setting | Default | Description |
|---------|---------|-------------|
| `kiroVoice.aiProvider` | `ollama` | AI provider (`ollama` or `openai`) |
| `kiroVoice.modelName` | `mistral` | LLM model for text cleanup |
| `kiroVoice.silenceDuration` | `3.0` | Seconds of silence before auto-stop |
| `kiroVoice.silenceThreshold` | `0.01` | Mic sensitivity (lower = more sensitive) |
| `kiroVoice.outputFormat` | `both` | `optimized_only`, `raw_only`, or `both` |

<details>
<summary><strong>Advanced Settings</strong></summary>

| Setting | Default | Description |
|---------|---------|-------------|
| `kiroVoice.useLocalPython` | `false` | Dev mode: use Python instead of binary |
| `kiroVoice.pythonPath` | `python` | Path to Python executable |
| `kiroVoice.apiEndpoint` | `http://localhost:11434/v1/chat/completions` | LLM API endpoint |
| `kiroVoice.apiKey` | `` | API key (for OpenAI only) |

</details>

## How It Works

```
Click Mic  →  Record Audio  →  Whisper Transcribe  →  Ollama Cleanup  →  Paste
```

**Example transformation:**
- Input: *"Um, can you like, write a python script to scan ports or whatever"*
- Output: *"Write a Python script to scan network ports."*

## Development

### Prerequisites

- Node.js 20+
- Python 3.11+ with dependencies:
  ```bash
  pip install openai-whisper sounddevice scipy numpy
  ```
- Ollama with a model:
  ```bash
  ollama pull mistral
  ```

### Setup

```bash
git clone https://github.com/abhayshekhawat1428/kiro-voice-pro.git
cd kiro-voice-pro
npm install
npm run compile
```

### Development Mode

Set `kiroVoice.useLocalPython: true` to use the Python script directly instead of the bundled binary.

### Build Voice Engine Binary

```bash
pip install pyinstaller
pyinstaller --onefile --name kiro_voice_engine python/voice_engine.py
```

### Package Extension

```bash
npx @vscode/vsce package --allow-missing-repository
```

## Project Structure

```
kiro-voice-pro/
├── src/
│   ├── extension.ts      # Main entry point, UI, voice toggle
│   ├── llmManager.ts     # AI text cleanup (Ollama/OpenAI)
│   └── setupManager.ts   # Auto-download binaries, setup
├── python/
│   └── voice_engine.py   # Audio recording + Whisper transcription
├── package.json
└── README.md
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License — see [LICENSE](LICENSE) for details.
