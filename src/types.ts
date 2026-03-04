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

export interface AppUninstallerInfo {
  app_path: string;
  bundle_id: string;
  app_name: string;
  related_files: FileNode[];
  total_size: number;
}

export interface DuplicateGroup {
  original: FileNode;
  duplicates: FileNode[];
  potential_savings: number;
}

export interface IntentAction {
  action: string;
  confidence: number;
  path?: string;
  message?: string;
}

export type SortKey = "size" | "name" | "modified";
export type ViewMode = "tree" | "junk" | "duplicates" | "chat";
