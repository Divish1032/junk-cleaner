# Changelog

All notable changes to JunkCleaner are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.2.0] – 2026-03-05

### 🆕 Added

#### Developer Cleanup

- **Dev Artifact Scanner** — scans your home folder for regeneratable build directories (`node_modules`, `target`, `.venv`, `__pycache__`, `.next`, `.nuxt`, `DerivedData`, etc.) across 15+ ecosystems (Node, Rust, Python, Go, Flutter, Swift, Xcode, Java, and more).
- Grouped accordion view by ecosystem with size totals and per-artifact regeneration commands.
- "Ask AI" integration — pre-fills Copilot Chat with metadata about any artifact for safe deletion advice.

#### Copilot Chat Improvements

- Chat now supports **real free-form conversation** — non-scan messages (e.g. "what is a node_modules folder?") receive genuine AI replies instead of a static fallback.
- Scan commands ("find junk", "show large files", etc.) continue to route to the appropriate scan automatically.
- Accurate error messages: network errors show the specific Ollama endpoint; other failures surface the actual Rust error string for easier debugging.
- `parse_intent` gracefully handles non-JSON model responses (common with small models) instead of crashing.

#### UI Polish

- **Custom Model Dropdown** — replaced the plain `<select>` with a glassmorphic dropdown featuring:
  - ⭐ Recommended badge for `qwen3.5` / `llama3.2` family models
  - `JetBrains Mono` model names with `:latest` suffix hidden
  - Animated chevron and smooth slide-in panel
  - Click-outside dismiss
- **Consistent button heights** — all sidebar buttons normalised to a `34px` CSS token (`--btn-h`).
- Tab empty-state screens for Explore, Junk, Duplicates, and Chat tabs.
- AI-busy indicator badge in the main toolbar while classification is running.
- Disabled tab styling while a long operation is in progress.

### 🔒 Security

- **Ollama URL validation** (`NET-03`) — backend now rejects non-localhost Ollama URLs, preventing SSRF.
- **Sensitive path scanning guard** (`FS-02`) — `/etc`, `/System`, `/private`, `/proc`, `/dev`, etc. are blocked from being used as scan roots.
- **Hardened `chat_with_model` system prompt** (`AI-06`) — explicit read-only mandate injected into every AI call; model is forbidden from suggesting destructive operations.
- **Error sanitisation** (`PRIV-03`) — raw Rust filesystem paths are stripped from error strings shown to the user.
- **CI Security Audit** (`DEP-08/09`) — new GitHub Actions workflow runs `cargo audit` and `npm audit` on every push and PR.

### 🐛 Fixed

- Fixed chat showing "Sorry, I had trouble reaching the local AI model" for valid conversational messages — was caused by Ollama returning plain text instead of JSON for non-scan queries.
- Fixed Dev Cleanup accordion groups collapsing to a 1px strip — caused by the `icon-btn` height token being applied to nested action icons inside `overflow: hidden` groups.
- Fixed `dev_scanner` returning empty results on some paths due to a missing `jwalk` depth filter.

---

## [0.1.0] – 2026-03-04

### 🆕 Added

- **Disk Tree Explorer** — recursive directory scanner with size, type, and modification date.
- **AI Junk Classifier** — uses a local Ollama model to tag files as junk/important.
- **Known Junk Scanner** — fast scan of well-known macOS cache, log, and temp locations.
- **App Uninstaller** — deep scan for lingering `.plist`, Application Support, and Preferences data.
- **Model Duplicates Scanner** — SHA-256 deduplication of `.gguf` / `.safetensors` AI weight files.
- **AI System Report** — LLM-generated disk health summary.
- **Copilot Chat** (intent routing) — natural language scan commands.
- Glassmorphism dark UI with Tauri 2 + React 18.
- macOS, Windows, and Linux installers via GitHub Actions + `tauri-action`.
