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

To get started quickly, download the latest installer from our [Releases page](#). We build installers for **macOS**, **Windows**, and **Linux**.

### Prerequisites for local AI Features

Junk Cleaner utilizes your local processing power. To use the AI features (Chat, Smart Classification, Health Reports), you must have **[Ollama](https://ollama.com/)** installed and running on your system with at least one model downloaded.

```bash
# Start Ollama API
ollama serve

# Download a fast reasoning model
ollama run llama3.2:1b
```

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
