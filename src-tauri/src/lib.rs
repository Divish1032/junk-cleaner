mod junk_catalog;
mod ollama;
mod scanner;

use junk_catalog::{classify_by_catalog, get_junk_catalog, JunkEntry};
use ollama::{
    check_ollama_health, classify_files, list_ollama_models, FileClassification, FileMeta,
};
use scanner::FileNode;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::UNIX_EPOCH;

struct AppState {
    scan_flag: Arc<AtomicBool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiskUsageResult {
    pub nodes: Vec<FileNode>,
    pub total_size: u64,
    pub root_path: String,
}

/// Scan a directory and return top-level entries with sizes.
#[tauri::command]
async fn scan_directory(
    path: String,
    depth: Option<usize>,
    state: tauri::State<'_, AppState>,
) -> Result<DiskUsageResult, String> {
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
fn get_volumes() -> Vec<serde_json::Value> {
    #[cfg(target_os = "macos")]
    {
        let volumes_dir = std::path::Path::new("/Volumes");
        if let Ok(rd) = std::fs::read_dir(volumes_dir) {
            return rd
                .filter_map(|e| e.ok())
                .map(|e| {
                    let path = e.path().to_string_lossy().to_string();
                    let name = e.file_name().to_string_lossy().to_string();
                    serde_json::json!({ "name": name, "path": path })
                })
                .collect();
        }
        // Fallback: root
        vec![
            serde_json::json!({ "name": "Macintosh HD", "path": "/" }),
            serde_json::json!({ "name": "Home", "path": dirs::home_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or("/".to_string()) }),
        ]
    }
    #[cfg(target_os = "windows")]
    {
        // Scan drive letters A-Z
        (b'A'..=b'Z')
            .map(|c| format!("{}:\\", c as char))
            .filter(|p| std::path::Path::new(p).exists())
            .map(|p| {
                let letter = p.chars().next().unwrap_or('C');
                serde_json::json!({ "name": format!("Drive ({}:)", letter), "path": p })
            })
            .collect()
    }
    #[cfg(target_os = "linux")]
    {
        vec![
            serde_json::json!({ "name": "Root (/)", "path": "/" }),
            serde_json::json!({ "name": "Home", "path": dirs::home_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or("/home".to_string()) }),
        ]
    }
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
