# 🧹 Junk Cleaner

<p align="center">
  <em>An elegant, AI-powered system cleaner built entirely on local Large Language Models (LLMs). No cloud needed.</em>
</p>

## ✨ Features

- **AI-Generated System Reports:** Get a readable health summary of your entire system volume directly from a local LLM.
- **Model Deduplication:** Find and isolate heavy `.gguf` / `.safetensors` weights duplicated across Ollama and LM Studio — using SHA-256 checksums.
- **Smart App Uninstaller:** Not just `.app` deletions — parses `.plist` files and deep-scans Application Support and Preferences for lingering data.
- **Developer Cleanup:** Discovers regeneratable build artefacts (`node_modules`, `target`, `.venv`, `.next`, `__pycache__`, `DerivedData`, and 100+ more) across 15 ecosystems. Shows the exact command to regenerate each folder so you can delete safely.
- **Copilot Chat:** Type natural language commands ("scan for junk", "find large files") — or just chat freely with the local AI. Non-scan queries get real conversational replies.
- **Glassmorphism UI:** Polished dark interface with animated micro-interactions, a custom model picker with ⭐ Recommended badges, and consistent component sizing.
- **Strictly Read-Only & Secure:** Multiple layers of write-protection — Tauri capability whitelist, Rust-side action whitelist, frontend whitelist, hardened AI system prompts, and localhost-only Ollama enforcement.

## 🚀 Getting Started

To get started quickly, download the latest installer from our [Releases page](https://github.com/Divish1032/junk-cleaner/releases/latest). We build native installers for **macOS**, **Windows**, and **Linux**.

<p align="center">
  <a href="https://github.com/Divish1032/junk-cleaner/releases/latest">
    <img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download for macOS" />
  </a>
  <a href="https://github.com/Divish1032/junk-cleaner/releases/latest">
    <img src="https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Download for Windows" />
  </a>
  <a href="https://github.com/Divish1032/junk-cleaner/releases/latest">
    <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Download for Linux" />
  </a>
</p>

_Note: Clicking the buttons above will take you to our latest GitHub release. Download the appropriate `.dmg` (Mac), `.exe` (Windows), or `.AppImage` (Linux) file for your machine._

### ⚡ Automated CLI Install

For a lightning-fast install that automatically bypasses warnings, open your terminal (or PowerShell) and paste the command for your OS:

**macOS & Linux (Terminal):**

```bash
curl -fsSL https://raw.githubusercontent.com/Divish1032/junk-cleaner/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/Divish1032/junk-cleaner/main/install.ps1 | iex
```

### 🍏 macOS Installation Note

Because this app is currently open-source and not yet digitally signed with a paid Apple Developer account, macOS Gatekeeper may show a warning saying _"Apple could not verify JunkCleaner is free of malware"_.

**To open it:**

1. Open your **Applications** folder in Finder.
2. **Right-click** (or Control-click) the JunkCleaner app icon.
3. Select **Open** from the context menu.
4. Click **Open** again on the pop-up warning. (You only need to do this _once_!)

### Local AI Features

Junk Cleaner utilizes your local processing power for its AI features (Chat, Smart Classification, Health Reports).
The application includes a built-in onboarding experience that will guide you through installing and connecting to [Ollama](https://ollama.com/) seamlessly if you don't already have it!

## 🛠 Building from Source

If you want to contribute or build the application from source, make sure you have **Node.js 18+** and the **Rust tooling** installed.

```bash
# Clone the repository
git clone https://github.com/<your-username>/junk-cleaner.git

# Navigate into the project
cd junk-cleaner

# Install Frontend dependencies
npm install

# Run the Tauri Developer Environment
npm run dev
```

To build a production bundle manually:

```bash
npm run tauri build
```

## 🤝 Contributing

We welcome all contributions! Whether it's porting to a new platform, fixing a UI bug, or writing a better Rust implementation for the backend - we'd love to have you.

To get started, please check out our [Contributing Guide](CONTRIBUTING.md) and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
