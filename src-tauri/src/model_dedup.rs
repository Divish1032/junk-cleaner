use crate::scanner::FileNode;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub original: FileNode,
    pub duplicates: Vec<FileNode>,
    pub potential_savings: u64,
}

const MODEL_EXTENSIONS: &[&str] = &["gguf", "safetensors", "pt", "bin", "onnx", "ckpt"];
const SAMPLE_SIZE: usize = 1024 * 1024; // 1MB sample for quick hashing

pub fn find_model_duplicates(search_paths: &[PathBuf]) -> Result<Vec<DuplicateGroup>, String> {
    // 1. Find all model files
    let mut model_files: Vec<FileNode> = Vec::new();
    for path in search_paths {
        if path.exists() {
            scan_for_models(path, &mut model_files);
        }
    }

    // 2. Group by exact file size first (fast pre-filter)
    let mut size_groups: HashMap<u64, Vec<FileNode>> = HashMap::new();
    for file in model_files {
        size_groups.entry(file.size).or_default().push(file);
    }

    let mut duplicate_groups: Vec<DuplicateGroup> = Vec::new();

    // 3. For files with the same size, compare a quick hash of the first 1MB
    for (_, files) in size_groups {
        if files.len() < 2 {
            continue;
        }

        let mut hash_groups: HashMap<String, Vec<FileNode>> = HashMap::new();

        for file in files {
            if let Ok(hash) = quick_hash(&file.path) {
                hash_groups.entry(hash).or_default().push(file);
            }
        }

        // 4. Form duplicate groups
        for (_, ref_files) in hash_groups {
            if ref_files.len() > 1 {
                let mut sorted_files = ref_files;
                // Sort by creation time, keep oldest as original
                sorted_files.sort_by(|a, b| a.created.cmp(&b.created));

                let original = sorted_files.remove(0);
                let potential_savings: u64 = sorted_files.iter().map(|f| f.size).sum();

                duplicate_groups.push(DuplicateGroup {
                    original,
                    duplicates: sorted_files,
                    potential_savings,
                });
            }
        }
    }

    Ok(duplicate_groups)
}

fn scan_for_models(dir: &Path, results: &mut Vec<FileNode>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_for_models(&path, results);
            } else if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if MODEL_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                        if let Ok(metadata) = fs::metadata(&path) {
                            results.push(FileNode {
                                name: entry.file_name().to_string_lossy().to_string(),
                                path: path.to_string_lossy().to_string(),
                                size: metadata.len(),
                                is_dir: false,
                                created: metadata
                                    .created()
                                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                                    .duration_since(std::time::SystemTime::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs(),
                                modified: metadata
                                    .modified()
                                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                                    .duration_since(std::time::SystemTime::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_secs(),
                                children: vec![],
                                children_count: 0,
                                extension: ext.to_string(),
                                junk_category: Some("Model Weight".to_string()),
                            });
                        }
                    }
                }
            }
        }
    }
}

// Read the first 1MB and hash it for a fast comparison instead of full file hashing
fn quick_hash(file_path: &str) -> io::Result<String> {
    let mut file = fs::File::open(file_path)?;
    let mut buffer = vec![0; SAMPLE_SIZE];

    // It's ok if we read less than 1MB (e.g. for a very small file)
    let bytes_read = file.read(&mut buffer)?;

    let mut hasher = Sha256::new();
    hasher.update(&buffer[..bytes_read]);
    let result = hasher.finalize();

    Ok(format!("{:x}", result))
}
