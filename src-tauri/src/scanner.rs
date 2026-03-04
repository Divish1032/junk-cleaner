use dashmap::DashSet;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
#[cfg(unix)]
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::UNIX_EPOCH;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub extension: String,
    pub modified: u64,
    pub created: u64,
    pub children: Vec<FileNode>,
    pub children_count: usize,
    pub junk_category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct ScanProgress {
    pub scanned: usize,
    pub current_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Volume {
    pub name: String,
    pub mount_point: PathBuf,
    pub available_bytes: u64,
    pub total_bytes: u64,
}

pub fn get_disk_volumes() -> Vec<Volume> {
    use std::collections::HashSet;
    use sysinfo::Disks;

    let disks = Disks::new_with_refreshed_list();
    let mut volumes = Vec::new();
    let mut seen_names = HashSet::new();

    // Sort disks by mount point length so we process '/' before '/System/...'
    let mut disk_list: Vec<_> = disks.iter().collect();
    disk_list.sort_by_key(|d| d.mount_point().as_os_str().len());

    for disk in disk_list {
        let name = disk.name().to_string_lossy().to_string();

        // Skip duplicate names, or empty names
        if name.is_empty() || seen_names.contains(&name) {
            continue;
        }

        seen_names.insert(name.clone());

        volumes.push(Volume {
            name,
            mount_point: disk.mount_point().to_path_buf(),
            available_bytes: disk.available_space(),
            total_bytes: disk.total_space(),
        });
    }

    // Sort so root is usually first or predictably ordered
    volumes.sort_by(|a, b| a.mount_point.cmp(&b.mount_point));

    volumes
}

/// Recursively scan a directory, returning a tree of FileNodes.
/// Sizes are computed bottom-up in parallel. Nodes deeper than max_depth
/// are not saved in the visual tree (memory footprint kept low).
pub fn scan_directory(
    root: &str,
    max_depth: Option<usize>,
    keep_running: Arc<AtomicBool>,
) -> FileNode {
    let visited_inodes = Arc::new(DashSet::new());
    let path = Path::new(root);
    scan_node(
        path,
        0,
        max_depth.unwrap_or(99999),
        keep_running,
        visited_inodes,
    )
}

fn scan_node(
    path: &Path,
    current_depth: usize,
    max_depth: usize,
    keep_running: Arc<AtomicBool>,
    visited_inodes: Arc<DashSet<u64>>,
) -> FileNode {
    if !keep_running.load(Ordering::Relaxed) {
        // Return an empty node if cancelled
        return FileNode {
            name: String::new(),
            path: String::new(),
            size: 0,
            is_dir: false,
            extension: String::new(),
            modified: 0,
            created: 0,
            children: vec![],
            children_count: 0,
            junk_category: None,
        };
    }

    let meta = std::fs::symlink_metadata(path);
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());
    let path_str = path.to_string_lossy().to_string();

    let (mut size, modified, created, is_dir) = match meta {
        Ok(m) => {
            #[cfg(unix)]
            {
                // Prevent double counting hardlinks
                let inode = m.ino();
                if !visited_inodes.insert(inode) {
                    // Already counted this physical file via another path
                    return FileNode {
                        name: String::new(),
                        path: String::new(),
                        size: 0,
                        is_dir: false,
                        extension: String::new(),
                        modified: 0,
                        created: 0,
                        children: vec![],
                        children_count: 0,
                        junk_category: None,
                    };
                }
            }

            let modified = m
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let created = m
                .created()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);

            // Directories themselves have a typical small block size, but we'll
            // accumulate their children's sizes into `size` below.
            let initial_size = if m.is_dir() { 0 } else { m.len() };
            (initial_size, modified, created, m.is_dir())
        }
        Err(_) => (0, 0, 0, false),
    };

    if !is_dir {
        return FileNode {
            name,
            path: path_str,
            size,
            is_dir,
            extension: path
                .extension()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default(),
            modified,
            created,
            children: vec![],
            children_count: 0,
            junk_category: None,
        };
    }

    let mut children = vec![];
    let mut total_child_nodes = 0;

    if is_dir {
        if let Ok(entries) = std::fs::read_dir(path) {
            let entry_paths: Vec<PathBuf> = entries
                .filter_map(|e| e.ok().map(|e| e.path()))
                .filter(|p| !p.is_symlink()) // Prevent infinite symlink loops
                .collect();

            // Parallel child evaluation
            let child_nodes: Vec<FileNode> = entry_paths
                .into_par_iter()
                .map(|p| {
                    scan_node(
                        &p,
                        current_depth + 1,
                        max_depth,
                        keep_running.clone(),
                        visited_inodes.clone(),
                    )
                })
                .collect();

            for child in child_nodes {
                size += child.size;
                total_child_nodes += 1;

                // Only keep children in the UI tree if we are within max_depth limit
                if current_depth < max_depth {
                    children.push(child);
                }
            }
        }
    }

    // Sort children by size descending for UI display
    children.sort_unstable_by(|a, b| b.size.cmp(&a.size));

    FileNode {
        name,
        path: path_str,
        size,
        is_dir,
        extension: String::new(),
        modified,
        created,
        children,
        children_count: total_child_nodes,
        junk_category: None,
    }
}

pub fn compute_dir_size(path: &Path) -> u64 {
    // Only used for known_junk explicit paths now
    let visited_inodes = Arc::new(DashSet::new());
    scan_node(path, 0, 0, Arc::new(AtomicBool::new(true)), visited_inodes).size
}
