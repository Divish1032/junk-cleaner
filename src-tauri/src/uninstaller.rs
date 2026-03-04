use crate::scanner::{compute_dir_size, FileNode};
use plist::Value as PlistValue;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppUninstallerInfo {
    pub app_path: String,
    pub bundle_id: String,
    pub app_name: String,
    pub related_files: Vec<FileNode>,
    pub total_size: u64,
}

/// Finds all related files for a given macOS application bundle identifier.
pub fn find_related_app_files(bundle_id: &str, app_path: &str) -> Vec<FileNode> {
    let mut related_paths: Vec<PathBuf> = Vec::new();

    // The .app bundle itself
    related_paths.push(PathBuf::from(app_path));

    if let Some(home) = dirs::home_dir() {
        // macOS typical application data locations
        let locations = vec![
            home.join("Library/Application Support").join(bundle_id),
            home.join("Library/Caches").join(bundle_id),
            home.join("Library/Preferences")
                .join(format!("{}.plist", bundle_id)),
            home.join("Library/Saved Application State")
                .join(format!("{}.savedState", bundle_id)),
            home.join("Library/Logs").join(bundle_id),
            home.join("Library/Containers").join(bundle_id),
            home.join("Library/Group Containers").join(bundle_id), // Note: apps share these, could be risky if deleted blindly
        ];

        for loc in locations {
            if loc.exists() {
                related_paths.push(loc);
            }
        }
    }

    // Convert paths to FileNodes
    related_paths
        .into_iter()
        .map(|p| {
            let is_dir = p.is_dir();
            let size = if is_dir {
                compute_dir_size(&p)
            } else {
                p.metadata().map(|m| m.len()).unwrap_or(0)
            };

            let modified = p
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);

            FileNode {
                name: p
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                path: p.to_string_lossy().to_string(),
                size,
                is_dir,
                extension: p
                    .extension()
                    .map(|e| e.to_string_lossy().to_string())
                    .unwrap_or_default(),
                modified,
                created: 0,
                children: vec![],
                children_count: 0,
                junk_category: Some("App Uninstaller".into()),
            }
        })
        .collect()
}

/// Extracts the CFBundleIdentifier from an Info.plist file inside a macOS .app bundle
pub fn get_bundle_id(app_path: &str) -> Option<String> {
    let info_plist_path = Path::new(app_path).join("Contents/Info.plist");
    if !info_plist_path.exists() {
        return None;
    }

    if let Ok(value) = PlistValue::from_file(info_plist_path) {
        if let Some(dict) = value.as_dictionary() {
            if let Some(bundle_id) = dict.get("CFBundleIdentifier") {
                return bundle_id.as_string().map(|s| s.to_string());
            }
        }
    }
    None
}

/// Analyzes an app at `app_path` and returns its related files.
#[tauri::command]
pub async fn scan_app_for_uninstaller(app_path: String) -> Result<AppUninstallerInfo, String> {
    let path = Path::new(&app_path);
    if !path.exists() || !path.is_dir() || path.extension().unwrap_or_default() != "app" {
        return Err("Path is not a valid macOS application bundle".into());
    }

    let bundle_id = get_bundle_id(&app_path).unwrap_or_else(|| {
        // Fallback: use the app name without the .app extension
        path.file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default()
    });

    let app_name = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    let app_path_clone = app_path.clone();
    let bundle_id_clone = bundle_id.clone();
    let related_files = tokio::task::spawn_blocking(move || {
        find_related_app_files(&bundle_id_clone, &app_path_clone)
    })
    .await
    .map_err(|e| e.to_string())?;

    let total_size = related_files.iter().map(|f| f.size).sum();

    Ok(AppUninstallerInfo {
        app_path,
        bundle_id,
        app_name,
        related_files,
        total_size,
    })
}
