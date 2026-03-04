# JunkCleaner 🗑️

A smart, cross-platform desktop disk cleaner with AI-powered junk detection — built with Rust + Tauri + React.

## Features

- 🔍 **Fast disk scanning** — Parallel directory walker shows size usage per folder
- 🏷️ **OS-aware junk catalog** — Knows macOS Caches, Xcode DerivedData, Windows Temp, Linux APT cache, node_modules, Python `__pycache__`, Rust `target/`, etc.
- 🤖 **AI junk detection** — Sends only file _metadata_ (name, size, path, extension, modified date) to a local Ollama LLM for smart classification. No file content is ever read.
- 📂 **Open in Finder/Explorer** — Every item has a "reveal" button to open the parent folder for manual review
- ❌ **No auto-delete** — Nothing is ever deleted without your explicit action in Finder
- 🖥️ **Cross-platform** — macOS, Windows, Linux

## Tech Stack

| Layer           | Technology                                    |
| --------------- | --------------------------------------------- |
| GUI             | React + TypeScript                            |
| Desktop Runtime | Tauri v2                                      |
| File System     | Rust (`walkdir`)                              |
| AI              | Ollama (local LLM, metadata-only)             |
| Packaging       | DMG (macOS), NSIS (Windows), AppImage (Linux) |

## Prerequisites

- [Rust](https://rustup.rs/) 1.70+
- [Node.js](https://nodejs.org) 18+
- [Ollama](https://ollama.com) (optional, for AI analysis)

## Getting Started

```bash
# Install dependencies
npm install

# Run in development
npm run tauri dev

# Build installable package
npm run tauri build
```

## AI Analysis Setup

1. Install [Ollama](https://ollama.ai)
2. Pull a model: `ollama pull llama3.2` or `ollama pull mistral`
3. Launch: `ollama serve`
4. In the app, click **Analyze with AI** — the app auto-detects available models

> **Privacy:** The AI only sees file names, sizes, paths, and modification dates. File content is **never read or sent** anywhere.

## Junk Detected by Rule (No AI Needed)

| Category           | Examples                                                       |
| ------------------ | -------------------------------------------------------------- |
| macOS Caches       | `~/Library/Caches`, `/Library/Caches`                          |
| macOS Dev          | Xcode DerivedData, CoreSimulator, Archives                     |
| Cross-platform Dev | `node_modules`, `__pycache__`, `target/`, `.next/`, `.gradle/` |
| Windows            | `%TEMP%`, Windows Update cache, browser caches                 |
| Linux              | `~/.cache`, `/var/cache/apt`, `/tmp`                           |
| All                | Trash / Recycle Bin                                            |

## License

MIT
