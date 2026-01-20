# Contributing to Kiro Voice Pro

Thanks for your interest in contributing! Here's how you can help.

## Ways to Contribute

- 🐛 **Report bugs** — Open an issue with steps to reproduce
- 💡 **Suggest features** — Open an issue describing your idea
- 🔧 **Submit PRs** — Fix bugs or implement features
- 📖 **Improve docs** — Fix typos, clarify instructions

## Development Setup

1. Fork and clone the repo
2. Install dependencies:
   ```bash
   npm install
   pip install openai-whisper sounddevice scipy numpy
   ```
3. Enable dev mode in VS Code settings:
   ```json
   "kiroVoice.useLocalPython": true
   ```
4. Run `npm run compile` and press F5 to launch Extension Development Host

## Pull Request Guidelines

- Keep PRs focused on a single change
- Update documentation if needed
- Test your changes on your platform
- Follow existing code style

## Code Style

- TypeScript: Follow existing patterns in the codebase
- Python: PEP 8 style
- Use meaningful variable names
- Add comments for complex logic

## Questions?

Open an issue — we're happy to help!
