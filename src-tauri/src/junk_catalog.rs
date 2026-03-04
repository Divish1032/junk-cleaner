use serde::{Deserialize, Serialize};

#[cfg(target_os = "windows")]
use std::env;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JunkEntry {
    pub path: String,
    pub category: String,
    pub description: String,
    pub os: String, // "all", "macos", "windows", "linux"
}

/// Returns the OS-aware junk path catalog with resolved absolute paths.
pub fn get_junk_catalog() -> Vec<JunkEntry> {
    let home = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut entries: Vec<JunkEntry> = vec![
        // ─── Cross-platform: Developer junk ──────────────────────────────────
        JunkEntry {
            path: "**/node_modules".into(),
            category: "Dev: Node Packages".into(),
            description: "npm/yarn package dependencies (safe to delete if package.json present)"
                .into(),
            os: "all".into(),
        },
        JunkEntry {
            path: "**/__pycache__".into(),
            category: "Dev: Python Cache".into(),
            description: "Python compiled bytecode cache".into(),
            os: "all".into(),
        },
        JunkEntry {
            path: "**/.gradle".into(),
            category: "Dev: Gradle Cache".into(),
            description: "Gradle build tool cache".into(),
            os: "all".into(),
        },
        JunkEntry {
            path: "**/target".into(),
            category: "Dev: Rust Build Artifacts".into(),
            description: "Rust/Cargo compiled output (can be huge, re-buildable)".into(),
            os: "all".into(),
        },
        JunkEntry {
            path: "**/.next".into(),
            category: "Dev: Next.js Build".into(),
            description: "Next.js build output directory".into(),
            os: "all".into(),
        },
        JunkEntry {
            path: "**/dist".into(),
            category: "Dev: Build Output".into(),
            description: "Common build/dist directory".into(),
            os: "all".into(),
        },
        JunkEntry {
            path: "**/.DS_Store".into(),
            category: "System: macOS Metadata".into(),
            description: "macOS folder metadata files (safe to delete on non-Mac systems)".into(),
            os: "macos".into(),
        },
    ];

    // ─── macOS specific ───────────────────────────────────────────────────────
    #[cfg(target_os = "macos")]
    {
        let macos_entries = vec![
            JunkEntry {
                path: format!("{}/Library/Caches", home),
                category: "Cache: App Caches".into(),
                description: "macOS application caches — generally safe to clear".into(),
                os: "macos".into(),
            },
            JunkEntry {
                path: format!("{}/Library/Logs", home),
                category: "Logs".into(),
                description: "macOS application log files".into(),
                os: "macos".into(),
            },
            JunkEntry {
                path: format!("{}/.Trash", home),
                category: "Trash".into(),
                description: "Files in the Trash that haven't been emptied".into(),
                os: "macos".into(),
            },
            JunkEntry {
                path: "/private/var/folders".into(),
                category: "System: Temp".into(),
                description: "macOS system temporary files".into(),
                os: "macos".into(),
            },
            JunkEntry {
                path: format!("{}/Library/Application Support/MobileSync/Backup", home),
                category: "Backup: iOS Backups".into(),
                description: "iTunes/Finder iOS device backups (can be several GB)".into(),
                os: "macos".into(),
            },
            JunkEntry {
                path: format!("{}/Library/Developer/Xcode/DerivedData", home),
                category: "Dev: Xcode DerivedData".into(),
                description: "Xcode build artifacts — safe to delete, will be rebuilt".into(),
                os: "macos".into(),
            },
            JunkEntry {
                path: format!("{}/Library/Developer/Xcode/Archives", home),
                category: "Dev: Xcode Archives".into(),
                description: "Xcode app archives — review before deleting".into(),
                os: "macos".into(),
            },
            JunkEntry {
                path: format!("{}/Library/Developer/CoreSimulator/Devices", home),
                category: "Dev: iOS Simulators".into(),
                description: "iOS Simulator device images (can be many GB)".into(),
                os: "macos".into(),
            },
            JunkEntry {
                path: format!("{}/Movies", home),
                category: "Media: Movies".into(),
                description: "User movies folder — large files, review carefully".into(),
                os: "macos".into(),
            },
            JunkEntry {
                path: "/Library/Caches".into(),
                category: "Cache: System Caches".into(),
                description: "System-wide application caches".into(),
                os: "macos".into(),
            },
            JunkEntry {
                path: format!("{}/Library/Mail/V10", home),
                category: "Mail: Email Data".into(),
                description: "Apple Mail email storage (can be large)".into(),
                os: "macos".into(),
            },
        ];
        entries.extend(macos_entries);
    }

    // ─── Windows specific ─────────────────────────────────────────────────────
    #[cfg(target_os = "windows")]
    {
        let temp = env::var("TEMP").unwrap_or_else(|_| "C:\\Windows\\Temp".into());
        let appdata = env::var("APPDATA").unwrap_or_else(|_| format!("{}\\AppData\\Roaming", home));
        let localappdata =
            env::var("LOCALAPPDATA").unwrap_or_else(|_| format!("{}\\AppData\\Local", home));

        let windows_entries = vec![
            JunkEntry {
                path: temp.clone(),
                category: "Temp Files".into(),
                description: "Windows temporary files".into(),
                os: "windows".into(),
            },
            JunkEntry {
                path: format!("{}\\Temp", localappdata),
                category: "Temp Files: User".into(),
                description: "User-level temp files".into(),
                os: "windows".into(),
            },
            JunkEntry {
                path: "C:\\Windows\\SoftwareDistribution\\Download".into(),
                category: "Windows Update Cache".into(),
                description: "Downloaded Windows update files (can be cleared after updates)"
                    .into(),
                os: "windows".into(),
            },
            JunkEntry {
                path: format!("{}\\Microsoft\\Windows\\INetCache", localappdata),
                category: "Cache: IE/Edge Cache".into(),
                description: "Internet Explorer / Edge browser cache".into(),
                os: "windows".into(),
            },
            JunkEntry {
                path: format!(
                    "{}\\Google\\Chrome\\User Data\\Default\\Cache",
                    localappdata
                ),
                category: "Cache: Chrome".into(),
                description: "Google Chrome browser cache".into(),
                os: "windows".into(),
            },
            JunkEntry {
                path: format!("{}\\Recycle.Bin", "C:"),
                category: "Recycle Bin".into(),
                description: "Files in the Recycle Bin".into(),
                os: "windows".into(),
            },
            JunkEntry {
                path: format!("{}\\npm-cache", appdata),
                category: "Dev: npm Cache".into(),
                description: "npm package manager cache".into(),
                os: "windows".into(),
            },
        ];
        entries.extend(windows_entries);
    }

    // ─── Linux specific ───────────────────────────────────────────────────────
    #[cfg(target_os = "linux")]
    {
        let linux_entries = vec![
            JunkEntry {
                path: format!("{}/.cache", home),
                category: "Cache: App Caches".into(),
                description: "Linux user application caches".into(),
                os: "linux".into(),
            },
            JunkEntry {
                path: format!("{}/.local/share/Trash", home),
                category: "Trash".into(),
                description: "Files in the Freedesktop Trash".into(),
                os: "linux".into(),
            },
            JunkEntry {
                path: "/var/cache/apt".into(),
                category: "Package Cache: APT".into(),
                description: "Debian/Ubuntu APT package download cache".into(),
                os: "linux".into(),
            },
            JunkEntry {
                path: "/var/cache/dnf".into(),
                category: "Package Cache: DNF".into(),
                description: "Fedora/RHEL DNF package download cache".into(),
                os: "linux".into(),
            },
            JunkEntry {
                path: "/var/log".into(),
                category: "Logs: System".into(),
                description: "System logs — old logs are safe to remove".into(),
                os: "linux".into(),
            },
            JunkEntry {
                path: format!("{}/.npm", home),
                category: "Dev: npm Cache".into(),
                description: "npm package manager cache".into(),
                os: "linux".into(),
            },
            JunkEntry {
                path: format!("{}/.cargo/registry", home),
                category: "Dev: Cargo Registry".into(),
                description: "Rust/Cargo package registry cache".into(),
                os: "linux".into(),
            },
            JunkEntry {
                path: "/tmp".into(),
                category: "Temp Files".into(),
                description: "Linux temporary files directory".into(),
                os: "linux".into(),
            },
        ];
        entries.extend(linux_entries);
    }

    entries
}

/// Check if a path matches any known junk category.
pub fn classify_by_catalog(path: &str) -> Option<String> {
    let catalog = get_junk_catalog();
    let path_lower = path.to_lowercase();

    for entry in &catalog {
        // Skip glob patterns for exact matching
        if entry.path.starts_with("**") {
            let pattern = entry.path.trim_start_matches("**/").to_lowercase();
            let file_name = std::path::Path::new(path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase();

            if file_name == pattern {
                return Some(entry.category.clone());
            }
        } else {
            let entry_lower = entry.path.to_lowercase();
            if path_lower.starts_with(&entry_lower) || path_lower == entry_lower {
                return Some(entry.category.clone());
            }
        }
    }
    None
}
