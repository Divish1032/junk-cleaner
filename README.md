# 🧹 Junk Cleaner

<p align="center">
  <em>An elegant, AI-powered system cleaner built entirely on local Large Language Models (LLMs). No cloud needed.</em>
</p>

## ✨ Features

- **AI-Generated System Reports:** Get a readable health summary of your entire system volume directly from an LLM.
- **Model Deduplication:** Find and isolate heavy `.gguf` weights duplicated across Ollama and LM Studio.
- **Smart App Uninstaller:** Not just `.app` deletions. The uninstaller parses `.plist` files and deeply scans your Application Support and Preferences to root out lingering data.
- **Copilot Chat:** Type natural language commands like "find all Xcode Derived Data" to automatically filter your disk without needing complex Regex logic.
- **Glassmorphism UI:** Stunning aesthetic powered by Tauri and React.

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
