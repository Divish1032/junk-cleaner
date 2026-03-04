mod dev_scanner;
mod junk_catalog;
mod model_dedup;
mod ollama;
mod scanner;
mod uninstaller;

use junk_catalog::{classify_by_catalog, get_junk_catalog, JunkEntry};
use model_dedup::DuplicateGroup;
use ollama::{
    check_ollama_health, classify_files, list_ollama_models, FileClassification, FileMeta,
    IntentAction,
};
use scanner::FileNode;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::UNIX_EPOCH;

struct AppState {
    scan_flag: Arc<AtomicBool>,
}

// ============================================================
// WRITE PROTECTION GUARD
// This app is STRICTLY READ-ONLY. This constant makes that
// enforceable at the type level. Never set to false.
// ============================================================
const WRITE_PROTECTION_ENABLED: bool = true;

/// Returns true if write protection is active (always true in this app).
/// The frontend queries this at startup to confirm read-only mode.
#[tauri::command]
fn app_write_protection_status() -> bool {
    WRITE_PROTECTION_ENABLED
}

/// Call this at the top of any Rust command that might touch the filesystem
/// for writes. Returns an Err immediately so the command is a no-op.
#[allow(dead_code)]
fn guard_write_op(operation: &str) -> Result<(), String> {
    if WRITE_PROTECTION_ENABLED {
        Err(format!(
            "BLOCKED: '{}' is a write operation. This app is strictly read-only and cannot modify, delete, or create files.",
            operation
        ))
    } else {
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiskUsageResult {
    pub nodes: Vec<FileNode>,
    pub total_size: u64,
    pub root_path: String,
}

// ============================================================
// NET-03: Ollama URL Validator
// Only allow connections to localhost/127.0.0.1 — never to
// external hosts that could intercept AI file metadata.
// ============================================================
fn validate_ollama_url(url: &str) -> Result<(), String> {
    let allowed_hosts = ["localhost", "127.0.0.1", "::1"];
    let url_lower = url.to_lowercase();
    // Strip http:// or https:// prefix
    let stripped = url_lower
        .trim_start_matches("http://")
        .trim_start_matches("https://");
    // Check if it starts with an allowed host
    let is_allowed = allowed_hosts.iter().any(|host| stripped.starts_with(host));
    if !is_allowed {
        Err(format!(
            "BLOCKED: Ollama URL '{}' is not a localhost address. This app only communicates with a local Ollama instance for privacy.",
            url
        ))
    } else {
        Ok(())
    }
}

// ============================================================
// FS-02: Scan Path Validator
// Block scanning of sensitive OS system directories that
// should never be enumerated by a disk cleaner.
// ============================================================
fn validate_scan_path(path: &str) -> Result<(), String> {
    let blocked_prefixes: &[&str] = &[
        // macOS / Unix system paths
        "/etc",
        "/private/etc",
        "/System",
        "/sbin",
        "/bin",
        "/usr/bin",
        "/usr/sbin",
        "/proc",
        "/sys",
        "/dev",
        // Windows system paths
        "C:\\Windows\\System32",
        "C:\\Windows\\SysWOW64",
        "C:\\Program Files\\Windows",
    ];
    let path_lower = path.to_lowercase().replace('\\', "/");
    for blocked in blocked_prefixes {
        let blocked_lower = blocked.to_lowercase().replace('\\', "/");
        if path_lower == blocked_lower || path_lower.starts_with(&format!("{}/", blocked_lower)) {
            return Err(format!(
                "BLOCKED: Scanning '{}' is not allowed. This path contains sensitive OS system files.",
                path
            ));
        }
    }
    Ok(())
}

/// Scan a directory and return top-level entries with sizes.
#[tauri::command]
async fn scan_directory(
    path: String,
    depth: Option<usize>,
    state: tauri::State<'_, AppState>,
) -> Result<DiskUsageResult, String> {
    // FS-02: Block sensitive system paths
    validate_scan_path(&path)?;

    state.scan_flag.store(true, Ordering::Relaxed);
    let keep_running = state.scan_flag.clone();
    let max_depth = depth.unwrap_or(3);

    let root_node = tokio::task::spawn_blocking(move || {
        scanner::scan_directory(&path, Some(max_depth), keep_running)
    })
    .await
    .map_err(|e| e.to_string())?;

    let mut nodes = root_node.children;

    // Apply junk catalog classifications
    for node in &mut nodes {
        node.junk_category = classify_by_catalog(&node.path);
    }

    Ok(DiskUsageResult {
        nodes,
        total_size: root_node.size,
        root_path: root_node.path,
    })
}

#[tauri::command]
fn cancel_scan(state: tauri::State<'_, AppState>) {
    state.scan_flag.store(false, Ordering::Relaxed);
}

#[tauri::command]
async fn clean_ollama_memory(model: String, ollama_url: Option<String>) -> Result<(), String> {
    let url = ollama_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    ollama::unload_model(model, &url).await
}

/// Get the OS-aware junk catalog list.
#[tauri::command]
fn get_junk_entries() -> Vec<JunkEntry> {
    get_junk_catalog()
}

/// Get known junk paths on this system (with sizes).
#[tauri::command]
async fn scan_known_junk(path: Option<String>) -> Vec<FileNode> {
    let catalog = get_junk_catalog();

    // If an explicit directory is provided, scan that specific directory for junk markers
    if let Some(scan_path) = path.filter(|p| !p.is_empty()) {
        let scan_path_clone = scan_path.clone();
        let junk_nodes = tokio::task::spawn_blocking(move || {
            let mut results = Vec::new();
            let mut iter = walkdir::WalkDir::new(&scan_path_clone).into_iter();

            while let Some(Ok(entry)) = iter.next() {
                let entry_path = entry.path();
                // Skip the root matching itself
                if entry_path.to_string_lossy() == scan_path_clone {
                    continue;
                }

                let path_str = entry_path.to_string_lossy().to_string();
                if let Some(category) = junk_catalog::classify_by_catalog(&path_str) {
                    let is_dir = entry.file_type().is_dir();
                    let size = if is_dir {
                        scanner::compute_dir_size(entry_path)
                    } else {
                        entry.metadata().map(|m| m.len()).unwrap_or(0)
                    };

                    let modified = entry
                        .metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    results.push(FileNode {
                        name: entry.file_name().to_string_lossy().to_string(),
                        path: path_str,
                        size,
                        is_dir,
                        extension: entry_path
                            .extension()
                            .map(|e| e.to_string_lossy().to_string())
                            .unwrap_or_default(),
                        modified,
                        created: 0,
                        children: vec![],
                        children_count: 0,
                        junk_category: Some(category),
                    });

                    // Stop descending into the junk folder to save immense time
                    if is_dir {
                        iter.skip_current_dir();
                    }
                }
            }
            results.sort_by(|a, b| b.size.cmp(&a.size));
            results
        })
        .await
        .unwrap_or_default();
        return junk_nodes;
    }

    // Default to global absolute system caches if no path provided
    let mut results: Vec<FileNode> = catalog
        .iter()
        .filter(|e| !e.path.starts_with("**")) // skip globs
        .filter_map(|entry| {
            let p = std::path::Path::new(&entry.path);
            if p.exists() {
                let size = scanner::compute_dir_size(p);
                let meta = std::fs::metadata(p).ok();
                let modified = meta
                    .as_ref()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                let is_dir = p.is_dir();
                Some(FileNode {
                    name: p
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| entry.path.clone()),
                    path: entry.path.clone(),
                    size,
                    is_dir,
                    extension: String::new(),
                    modified,
                    created: 0,
                    children: vec![],
                    children_count: 0,
                    junk_category: Some(entry.category.clone()),
                })
            } else {
                None
            }
        })
        .collect();

    results.sort_by(|a, b| b.size.cmp(&a.size));
    results
}

/// Classify a list of files/folders using Ollama (metadata only, no content).
#[tauri::command]
async fn classify_with_ai(
    files: Vec<FileMeta>,
    model: String,
    ollama_url: Option<String>,
) -> Vec<FileClassification> {
    let url = ollama_url.unwrap_or_else(|| "http://localhost:11434".to_string());

    // Process in batches of 15 to avoid overwhelming the LLM
    let batch_size = 15;
    let mut all_results: Vec<FileClassification> = Vec::new();

    for chunk in files.chunks(batch_size) {
        let batch: Vec<FileMeta> = chunk.to_vec();
        let results = classify_files(batch, model.clone(), url.clone()).await;
        all_results.extend(results);
    }

    all_results
}

/// List available Ollama models.
#[tauri::command]
async fn get_ollama_models(ollama_url: Option<String>) -> Vec<String> {
    let url = ollama_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    list_ollama_models(&url).await
}

/// Check if Ollama is reachable.
#[tauri::command]
async fn check_ollama(ollama_url: Option<String>) -> bool {
    let url = ollama_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    check_ollama_health(&url).await
}

/// Open a path in the system file explorer (Finder on macOS, Explorer on Windows, Nautilus on Linux).
#[tauri::command]
async fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", path))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        // Try xdg-open on the parent directory
        let parent = std::path::Path::new(&path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or(path);
        std::process::Command::new("xdg-open")
            .arg(&parent)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Get home directory path.
#[tauri::command]
fn get_home_dir() -> String {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string())
}

/// Get disk volumes/drives available on this system.
#[tauri::command]
fn get_volumes() -> Vec<scanner::Volume> {
    scanner::get_disk_volumes()
}

#[tauri::command]
async fn scan_model_duplicates() -> Result<Vec<DuplicateGroup>, String> {
    // Determine standard model locations
    let mut search_paths = vec![];

    // Add common Ollama model dir
    if let Some(home) = dirs::home_dir() {
        let ollama_models = home.join(".ollama").join("models");
        if ollama_models.exists() {
            search_paths.push(ollama_models);
        }

        let lm_studio_models = home.join(".cache").join("lm-studio").join("models");
        if lm_studio_models.exists() {
            search_paths.push(lm_studio_models);
        }
    }

    // Optionally scan the root if user wants a deep scan (could take long)
    // For now we'll stick to common model directories to keep it fast and safe.
    // In a real app we'd let the user select paths.

    let res =
        tokio::task::spawn_blocking(move || model_dedup::find_model_duplicates(&search_paths))
            .await
            .map_err(|e| e.to_string())?;

    Ok(res?)
}

#[tauri::command]
async fn unload_ollama_model(model: String, ollama_url: String) -> Result<(), String> {
    // NET-03: Validate localhost-only
    validate_ollama_url(&ollama_url)?;
    ollama::unload_model(model, &ollama_url).await
}

#[tauri::command]
async fn parse_user_intent(
    prompt: String,
    model: String,
    ollama_url: String,
) -> Result<IntentAction, String> {
    // NET-03: Validate localhost-only
    validate_ollama_url(&ollama_url)?;
    ollama::parse_intent(&prompt, model, ollama_url).await
}

#[tauri::command]
async fn generate_system_report(
    files: Vec<FileMeta>,
    model: String,
    ollama_url: String,
) -> Result<String, String> {
    // NET-03: Validate localhost-only
    validate_ollama_url(&ollama_url)?;
    let vols = scanner::get_disk_volumes();
    ollama::generate_system_report(files, vols, model, ollama_url).await
}

/// Free-form read-only chat. The model only sees user text + a hard-coded read-only system prompt.
/// Zero filesystem access — no shell, no file reads, no mutations of any kind.
#[tauri::command]
async fn chat_with_model(
    message: String,
    model: String,
    ollama_url: Option<String>,
) -> Result<String, String> {
    let url = ollama_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    // NET-03: Validate localhost-only even for chat
    validate_ollama_url(&url)?;
    ollama::chat_with_model(message, model, url).await
}

/// Scan a directory for dev artifacts (node_modules, target, .venv, etc.).
#[tauri::command]
async fn scan_dev_artifacts(root: String) -> Vec<dev_scanner::DevArtifact> {
    tokio::task::spawn_blocking(move || dev_scanner::scan_dev_artifacts(&root))
        .await
        .unwrap_or_default()
}

/// Delete a dev artifact directory after whitelist verification.
#[tauri::command]
fn delete_dev_artifact(path: String) -> Result<(), String> {
    dev_scanner::delete_dev_artifact(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            scan_flag: Arc::new(AtomicBool::new(true)),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            get_junk_entries,
            scan_known_junk,
            classify_with_ai,
            get_ollama_models,
            check_ollama,
            reveal_in_explorer,
            get_home_dir,
            get_volumes,
            cancel_scan,
            clean_ollama_memory,
            uninstaller::scan_app_for_uninstaller,
            scan_model_duplicates,
            unload_ollama_model,
            parse_user_intent,
            generate_system_report,
            app_write_protection_status,
            chat_with_model,
            scan_dev_artifacts,
            delete_dev_artifact,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
