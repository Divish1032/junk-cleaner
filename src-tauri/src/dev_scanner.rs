use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// A single dev artifact found on disk (e.g. a node_modules folder).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DevArtifact {
    /// Absolute path to the artifact directory.
    pub path: String,
    /// Name of the artifact folder (e.g. "node_modules").
    pub artifact_name: String,
    /// Programming ecosystem / language.
    pub ecosystem: String,
    /// Short description of what this folder contains.
    pub description: String,
    /// How to regenerate this folder.
    pub regen_command: String,
    /// Disk size in bytes.
    pub size_bytes: u64,
    /// The project root (parent directory of the artifact).
    pub project_root: String,
    /// Project name (basename of project root).
    pub project_name: String,
}

/// Configuration for a recognisable dev artifact pattern.
struct ArtifactPattern {
    /// Folder name to look for (exact match).
    folder_name: &'static str,
    ecosystem: &'static str,
    description: &'static str,
    regen_command: &'static str,
    /// Optional: a file that must exist in the parent dir to confirm this is a real project.
    marker_file: Option<&'static str>,
}

fn artifact_patterns() -> Vec<ArtifactPattern> {
    vec![
        ArtifactPattern {
            folder_name: "node_modules",
            ecosystem: "Node.js",
            description: "npm/yarn/pnpm package dependencies",
            regen_command: "npm install",
            marker_file: Some("package.json"),
        },
        ArtifactPattern {
            folder_name: ".next",
            ecosystem: "Next.js",
            description: "Next.js build output & cache",
            regen_command: "npm run build",
            marker_file: Some("package.json"),
        },
        ArtifactPattern {
            folder_name: ".nuxt",
            ecosystem: "Nuxt.js",
            description: "Nuxt.js build output & cache",
            regen_command: "npm run build",
            marker_file: Some("package.json"),
        },
        ArtifactPattern {
            folder_name: ".turbo",
            ecosystem: "Turborepo",
            description: "Turborepo build cache",
            regen_command: "turbo build",
            marker_file: Some("package.json"),
        },
        ArtifactPattern {
            folder_name: "dist",
            ecosystem: "Node.js / Frontend",
            description: "Production build output",
            regen_command: "npm run build",
            marker_file: Some("package.json"),
        },
        ArtifactPattern {
            folder_name: ".vite",
            ecosystem: "Vite",
            description: "Vite build cache",
            regen_command: "npm run build",
            marker_file: Some("package.json"),
        },
        ArtifactPattern {
            folder_name: "target",
            ecosystem: "Rust / Cargo",
            description: "Rust compiled artifacts & dependencies",
            regen_command: "cargo build",
            marker_file: Some("Cargo.toml"),
        },
        ArtifactPattern {
            folder_name: "__pycache__",
            ecosystem: "Python",
            description: "Python bytecode cache",
            regen_command: "python -m compileall .",
            marker_file: None,
        },
        ArtifactPattern {
            folder_name: ".venv",
            ecosystem: "Python",
            description: "Python virtual environment",
            regen_command: "python -m venv .venv && pip install -r requirements.txt",
            marker_file: Some("requirements.txt"),
        },
        ArtifactPattern {
            folder_name: "venv",
            ecosystem: "Python",
            description: "Python virtual environment",
            regen_command: "python -m venv venv && pip install -r requirements.txt",
            marker_file: Some("requirements.txt"),
        },
        ArtifactPattern {
            folder_name: ".pytest_cache",
            ecosystem: "Python",
            description: "pytest test cache",
            regen_command: "pytest (auto-regenerated on next run)",
            marker_file: None,
        },
        ArtifactPattern {
            folder_name: ".mypy_cache",
            ecosystem: "Python",
            description: "mypy type-checker cache",
            regen_command: "mypy (auto-regenerated on next run)",
            marker_file: None,
        },
        ArtifactPattern {
            folder_name: "vendor",
            ecosystem: "Go / PHP",
            description: "Go modules or Composer (PHP) dependencies",
            regen_command: "go mod vendor  /  composer install",
            marker_file: None,
        },
        ArtifactPattern {
            folder_name: "build",
            ecosystem: "Generic Build",
            description: "Build output directory",
            regen_command: "run the project's build command",
            marker_file: None,
        },
        ArtifactPattern {
            folder_name: ".gradle",
            ecosystem: "Java / Android",
            description: "Gradle build cache",
            regen_command: "./gradlew build",
            marker_file: Some("build.gradle"),
        },
        ArtifactPattern {
            folder_name: ".dart_tool",
            ecosystem: "Flutter / Dart",
            description: "Dart tooling cache",
            regen_command: "flutter pub get",
            marker_file: Some("pubspec.yaml"),
        },
        ArtifactPattern {
            folder_name: ".pub-cache",
            ecosystem: "Flutter / Dart",
            description: "Dart/Flutter pub package cache",
            regen_command: "flutter pub get",
            marker_file: None,
        },
        ArtifactPattern {
            folder_name: "Pods",
            ecosystem: "iOS / macOS (CocoaPods)",
            description: "CocoaPods dependency directory",
            regen_command: "pod install",
            marker_file: Some("Podfile"),
        },
        ArtifactPattern {
            folder_name: ".build",
            ecosystem: "Swift / SPM",
            description: "Swift Package Manager build artifacts",
            regen_command: "swift build",
            marker_file: Some("Package.swift"),
        },
        ArtifactPattern {
            folder_name: "DerivedData",
            ecosystem: "Xcode",
            description: "Xcode derived build data",
            regen_command: "Build in Xcode (⌘B)",
            marker_file: None,
        },
        ArtifactPattern {
            folder_name: ".svelte-kit",
            ecosystem: "SvelteKit",
            description: "SvelteKit build cache",
            regen_command: "npm run build",
            marker_file: Some("package.json"),
        },
    ]
}

/// Compute rough disk usage for a directory (non-recursive symlink-safe).
pub fn compute_dir_size(path: &Path) -> u64 {
    let mut total = 0u64;
    let walker = WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok());
    for entry in walker {
        if entry.file_type().is_file() {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    total
}

/// Scan a root path for dev artifacts, returning all found items sorted by size desc.
pub fn scan_dev_artifacts(root: &str) -> Vec<DevArtifact> {
    let patterns = artifact_patterns();
    let root_path = Path::new(root);
    let mut results: Vec<DevArtifact> = Vec::new();

    // Walk up to depth 6 to find projects; skip common skip dirs
    let walker = WalkDir::new(root_path)
        .max_depth(6)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            // Skip hidden system dirs and the artifact dirs themselves at top level
            // so we don't recurse into node_modules/node_modules etc.
            !matches!(
                name.as_ref(),
                ".git"
                    | ".svn"
                    | "Library"
                    | "System"
                    | "Applications"
                    | "proc"
                    | "sys"
                    | "dev"
                    | "run"
            )
        });

    'entries: for entry in walker.filter_map(|e| e.ok()) {
        if !entry.file_type().is_dir() {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy();

        // Check if this dir name matches a known artifact
        for pattern in &patterns {
            if dir_name != pattern.folder_name {
                continue;
            }

            let artifact_path = entry.path();
            let parent = match artifact_path.parent() {
                Some(p) => p,
                None => continue 'entries,
            };

            // If there's a marker file requirement, check it
            if let Some(marker) = pattern.marker_file {
                if !parent.join(marker).exists() {
                    continue;
                }
            }

            // Skip scanning inside existing results (e.g. node_modules inside node_modules)
            let artifact_path_str = artifact_path.to_string_lossy().to_string();
            let already_inside = results
                .iter()
                .any(|r| artifact_path_str.starts_with(&r.path));
            if already_inside {
                continue 'entries;
            }

            let project_name = parent
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| parent.to_string_lossy().to_string());

            let size_bytes = compute_dir_size(artifact_path);

            results.push(DevArtifact {
                path: artifact_path_str,
                artifact_name: pattern.folder_name.to_string(),
                ecosystem: pattern.ecosystem.to_string(),
                description: pattern.description.to_string(),
                regen_command: pattern.regen_command.to_string(),
                size_bytes,
                project_root: parent.to_string_lossy().to_string(),
                project_name,
            });

            // Don't recurse further into this artifact dir
            continue 'entries;
        }
    }

    // Sort biggest first
    results.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    results
}

/// Delete a path — ONLY if it matches a known artifact name (safety whitelist).
/// Returns an error if it's not a recognised artifact folder.
pub fn delete_dev_artifact(path: &str) -> Result<(), String> {
    let p = PathBuf::from(path);
    let folder_name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or_else(|| "Invalid path".to_string())?;

    // Hard-coded whitelist — we only delete known regeneratable folders
    let patterns = artifact_patterns();
    let allowed = patterns
        .iter()
        .any(|pat| pat.folder_name == folder_name.as_str());

    if !allowed {
        return Err(format!(
            "BLOCKED: '{}' is not a recognised dev artifact. Only explicitly catalogued folders can be deleted.",
            folder_name
        ));
    }

    if !p.exists() {
        return Err(format!("Path no longer exists: {}", path));
    }

    std::fs::remove_dir_all(&p).map_err(|e| format!("Failed to delete '{}': {}", path, e))
}
