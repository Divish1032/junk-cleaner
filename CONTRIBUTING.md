# Contributing to Junk Cleaner

First off, thanks for taking the time to contribute! 🎉
Junk Cleaner is an AI-powered system cleaner utilizing local LLMs to intelligently categorize and remove junk files.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Running tests](#running-tests)
- [Pull Request Process](#pull-request-process)
- [Coding Guidelines](#coding-guidelines)

## Development Setup

To run the application locally, you will need the following tools installed:

1. **Node.js** (v18+)
2. **Rust & Cargo** (latest stable)
3. **Ollama** App (for AI features to function locally)

### Steps

1. Fork and clone the repository.
   ```bash
   git clone https://github.com/<your-username>/junk-cleaner.git
   cd junk-cleaner
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Run the development server (which compiles the Tauri backend as well):
   ```bash
   npm run dev
   ```

## Project Architecture

Junk Cleaner utilizes the **Tauri Core** to build lightweight, performant desktop apps:

- **Frontend (`src/`)**: A React (TypeScript) application utilizing `lucide-react` for icons and standard CSS variables for our Glassmorphism aesthetic.
- **Backend (`src-tauri/src/`)**: Written in Rust. It exposes endpoints via `#[tauri::command]` which the frontend interacts with.
  - `scanner.rs`: Multi-threaded disk scanning.
  - `ollama.rs`: LLM and Chat intent parsing through the local Ollama API.
  - `junk_catalog.rs`: Pre-defined static path lookups.
  - `model_dedup.rs`: Duplicate `.gguf` file detection.

## Pull Request Process

1. Create a descriptive branch name from `main` (e.g., `fix/chat-scrolling` or `feat/linux-support`).
2. Implement your changes.
3. If applicable, add docs explaining your feature in the `README.md`.
4. Ensure standard linters pass (`cargo clippy` for Rust, `npm run lint` for TypeScript).
5. Open a Pull Request! We maintain standard PR/Issue templates, so please fill them out when prompted.

## Coding Guidelines

- **Frontend**: Follow React hooks best practices. Prefer functional components. Try to use our existing Glassmorphism CSS variables (`var(--bg-glass)`, etc.) whenever adding new panels.
- **Rust Backend**: Avoid `unwrap()` unless absolutely certain; gracefully map errors to strings so the Frontend can catch them and display Toast warnings. Keep all intensive blocking tasks wrapped inside `tokio::task::spawn_blocking` to prevent the UI thread from hanging.

Again, thank you for contributing! Your help in making local AI powerful and accessible is greatly appreciated.
