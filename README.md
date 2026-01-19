# Kiro Voice Pro 🎤

Voice-to-text for VS Code, Cursor, and Kiro with local AI optimization.

Speak naturally, and your words are transcribed and cleaned up by a local AI before being pasted wherever your cursor is.

## ✨ Features

- **Voice Recording** - Click the mic button and speak
- **Auto-stop** - Automatically stops after configurable silence duration
- **Local AI Cleanup** - Removes filler words ("um", "like"), fixes grammar using Ollama
- **Smart Paste** - Pastes wherever your cursor is (editor, chat, terminal)
- **Privacy First** - All processing happens locally on your machine

## 📦 Installation

### From Marketplace
1. Search "Kiro Voice Pro" in Extensions
2. Click Install
3. The voice engine downloads automatically on first use

### From VSIX
1. Download the `.vsix` file from [Releases](https://github.com/abhayshekhawat1428/kiro-voice-pro/releases)
2. In VS Code/Kiro: Extensions → ⋯ → Install from VSIX

## 🚀 Quick Start

1. Click **🎤 Voice** in the status bar
2. Speak your text
3. Wait for silence (3 seconds) or click again to stop
4. Text is cleaned by AI and pasted automatically

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `kiroVoice.aiProvider` | `ollama` | AI provider (`ollama` or `openai`) |
| `kiroVoice.modelName` | `mistral` | LLM model for text cleanup |
| `kiroVoice.silenceDuration` | `3.0` | Seconds of silence before auto-stop |
| `kiroVoice.silenceThreshold` | `0.01` | Mic sensitivity (lower = more sensitive) |
| `kiroVoice.outputFormat` | `both` | Output format: `optimized_only`, `raw_only`, or `both` |
| `kiroVoice.useLocalPython` | `false` | Development mode: use local Python instead of binary |

## 🔧 Requirements

- **Ollama** - For AI text cleanup (auto-installed on first use)
- **Microphone** - For voice input
- **macOS**: Accessibility permissions for auto-paste

## 🛠️ Development

### Prerequisites
- Node.js 20+
- Python 3.11+ with: `pip install openai-whisper sounddevice scipy numpy`
- Ollama with a model: `ollama pull mistral`

### Setup
```bash
git clone https://github.com/abhayshekhawat1428/kiro-voice-pro.git
cd kiro-voice-pro
npm install
```

### Build Extension
```bash
npm run compile
```

### Package VSIX
```bash
npx @vscode/vsce package --allow-missing-repository
```

### Build Voice Engine Binary
```bash
pip install pyinstaller
pyinstaller --onefile --name kiro_voice_engine python/voice_engine.py
```

### Development Mode
Set `kiroVoice.useLocalPython: true` in settings to use local Python instead of the bundled binary.

## 🏗️ Architecture

```
User clicks Voice → Python records audio → Whisper transcribes → 
Ollama cleans text → Paste to cursor
```

| File | Purpose |
|------|---------|
| `extension.ts` | Main extension entry point |
| `voice_engine.py` | Audio recording + Whisper transcription |
| `llmManager.ts` | AI text cleanup via Ollama/OpenAI |
| `setupManager.ts` | Auto-download binaries and dependencies |

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.
