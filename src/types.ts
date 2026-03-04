export interface FileNode {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  extension: string;
  modified: number; // unix timestamp
  created: number;
  children: FileNode[];
  children_count: number;
  junk_category: string | null;
  // Added by frontend
  ai_classification?: "junk" | "important" | "unknown";
  ai_confidence?: number;
  ai_reason?: string;
}

export interface DiskUsageResult {
  nodes: FileNode[];
  total_size: number;
  root_path: string;
}

export interface JunkEntry {
  path: string;
  category: string;
  description: string;
  os: string;
}

export interface FileMeta {
  name: string;
  path: string;
  size_bytes: number;
  extension: string;
  is_dir: boolean;
  modified_days_ago: number;
}

export interface FileClassification {
  path: string;
  classification: "junk" | "important" | "unknown";
  confidence: number;
  reason: string;
}

export interface Volume {
  name: string;
  path: string;
}

export type SortKey = "size" | "name" | "modified";
export type ViewMode = "tree" | "junk";
