# Kiro Voice Pro

Voice-to-text for VS Code, Cursor, and Kiro with local AI optimization.

## Features

- 🎤 **Voice Recording** - Click the mic button and speak
- 🤫 **Auto-stop** - Automatically stops after silence
- 🧠 **AI Cleanup** - Removes filler words, fixes grammar using local Ollama
- 📋 **Smart Paste** - Pastes wherever your cursor is

## Installation

### From Marketplace
1. Search "Kiro Voice Pro" in Extensions
2. Click Install
3. The voice engine downloads automatically on first use

### From GitHub
1. Download the `.vsix` file from Releases
2. In VS Code: Extensions → ⋯ → Install from VSIX

## Requirements

- **Ollama** - For AI text cleanup (auto-prompted to install)
- **Microphone** - For voice input
- **macOS**: Accessibility permissions for auto-paste

## Usage

1. Click **🎤 Voice** in the status bar (or run command `Start Voice Dictation`)
2. Speak your text
3. Wait for silence (3 seconds) or click again to stop
4. Text is cleaned by AI and pasted

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `kiroVoice.aiProvider` | `ollama` | `ollama` or `openai` |
| `kiroVoice.modelName` | `mistral` | LLM model for cleanup |
| `kiroVoice.silenceDuration` | `3.0` | Seconds of silence before auto-stop |
| `kiroVoice.silenceThreshold` | `0.01` | Mic sensitivity (lower = more sensitive) |
| `kiroVoice.outputFormat` | `both` | `optimized_only`, `raw_only`, or `both` |

## Development

### Prerequisites
- Node.js 20+
- Python 3.11+ with: `pip install openai-whisper sounddevice scipy numpy`

### Build
```bash
npm install
npm run compile
```

### Package
```bash
npx @vscode/vsce package --allow-missing-repository
```

### Build Voice Engine Binary
```bash
pip install pyinstaller
pyinstaller --onefile --name kiro_voice_engine python/voice_engine.py
```

## License

MIT
