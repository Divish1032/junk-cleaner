import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  FileNode,
  DiskUsageResult,
  FileMeta,
  FileClassification,
  Volume,
  AppUninstallerInfo,
  DuplicateGroup,
  IntentAction
} from '../types';

// PRIV-03: Strip raw Rust/OS error details that could expose sensitive filesystem paths.
// Maps known error patterns to user-friendly messages.
function sanitizeError(e: unknown): string {
  const raw = String(e);
  // Surface our own BLOCKED messages verbatim (they are purposely user-facing)
  if (raw.includes('BLOCKED:')) return raw.replace(/^.*BLOCKED:/, '⛔ Blocked:').trim();
  // Permission denied — don't expose the exact path
  if (raw.toLowerCase().includes('permission denied')) {
    return 'Access denied: you do not have permission to read this location.';
  }
  // No such file
  if (raw.toLowerCase().includes('no such file') || raw.toLowerCase().includes('not found')) {
    return 'Path not found. It may have been moved or deleted.';
  }
  // Generic catch-all — truncate long internal Rust errors
  if (raw.length > 120) {
    return raw.slice(0, 120) + '…';
  }
  return raw;
}

export function useScanner() {
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [scanning, setScanning] = useState(false);
  const [totalSize, setTotalSize] = useState(0);
  const [currentPath, setCurrentPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [knownJunk, setKnownJunk] = useState<FileNode[]>([]);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [appUninstallerResult, setAppUninstallerResult] = useState<AppUninstallerInfo | null>(null);
  const [duplicateModels, setDuplicateModels] = useState<DuplicateGroup[]>([]);

  const checkOllama = useCallback(async (): Promise<boolean> => {
    try {
      const online = await invoke<boolean>('check_ollama');
      setOllamaOnline(online);
      if (online) {
        const models = await invoke<string[]>('get_ollama_models');
        setOllamaModels(models);
        if (models.length > 0 && !selectedModel) {
          setSelectedModel(models[0]);
        }
      }
      return online;
    } catch (e) {
      setOllamaOnline(false);
      return false;
    }
  }, [selectedModel]);

  const loadVolumes = useCallback(async () => {
    try {
      const vols = await invoke<Volume[]>('get_volumes');
      setVolumes(vols);
    } catch (_) {}
  }, []);

  const scanDirectory = useCallback(async (path: string) => {
    setScanning(true);
    setError(null);
    setCurrentPath(path);
    try {
      const result = await invoke<DiskUsageResult>('scan_directory', { path, depth: 99999 });
      setNodes(result.nodes);
      setTotalSize(result.total_size);
    } catch (e) {
      setError(sanitizeError(e));
    } finally {
      setScanning(false);
    }
  }, []);

  const scanKnownJunk = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const junk = await invoke<FileNode[]>('scan_known_junk', { path: currentPath || '' });
      setKnownJunk(junk);
    } catch (e) {
      setError(sanitizeError(e));
    } finally {
      setScanning(false);
    }
  }, [currentPath]);

  const scanAppForUninstaller = useCallback(async (appPath: string) => {
    setScanning(true);
    setError(null);
    setAppUninstallerResult(null);
    try {
      const result = await invoke<AppUninstallerInfo>('scan_app_for_uninstaller', { appPath });
      setAppUninstallerResult(result);
    } catch (e) {
      setError(sanitizeError(e));
    } finally {
      setScanning(false);
    }
  }, []);

  const scanModelDuplicates = useCallback(async () => {
    setScanning(true);
    setError(null);
    setDuplicateModels([]);
    try {
      const result = await invoke<DuplicateGroup[]>('scan_model_duplicates');
      setDuplicateModels(result);
    } catch (e) {
      setError(sanitizeError(e));
    } finally {
      setScanning(false);
    }
  }, []);

  const clearAppUninstallerResult = useCallback(() => {
    setAppUninstallerResult(null);
  }, []);

  const classifyWithAI = useCallback(async (filesToClassify: FileNode[]) => {
    if (!selectedModel) throw new Error('No model selected');
    if (filesToClassify.length === 0) throw new Error('No files to classify. Please scan a directory first.');
    setClassifying(true);
    try {
      let targetFiles = filesToClassify;
      if (currentPath) {
        targetFiles = [];
        for (const rootNode of filesToClassify) {
            targetFiles.push(rootNode);
            if (rootNode.children) {
                targetFiles.push(...rootNode.children);
            }
        }
      }

      const fileMetas: FileMeta[] = targetFiles.slice(0, 50).map((f) => {
        const now = Math.floor(Date.now() / 1000);
        const modifiedDaysAgo = f.modified ? Math.floor((now - f.modified) / 86400) : 0;
        return {
          name: f.name,
          path: f.path,
          size_bytes: f.size,
          extension: f.extension,
          is_dir: f.is_dir,
          modified_days_ago: modifiedDaysAgo,
        };
      });

      const classifications = await invoke<FileClassification[]>('classify_with_ai', {
        files: fileMetas,
        model: selectedModel,
      });

      const classMap = new Map(classifications.map((c) => [c.path, c]));
      
      const updateNodes = (nodeList: FileNode[]): FileNode[] => {
        return nodeList.map((node) => {
          let updatedNode = { ...node };
          const cls = classMap.get(node.path);
          if (cls) {
            updatedNode.ai_classification = cls.classification;
            updatedNode.ai_confidence = cls.confidence;
            updatedNode.ai_reason = cls.reason;
          }
          if (updatedNode.children) {
              updatedNode.children = updateNodes(updatedNode.children);
          }
          return updatedNode;
        });
      };

      setNodes((prev) => updateNodes(prev));
      return classifications.length;
    } catch (e) {
      setError(String(e));
      throw e; // re-throw so caller can handle toast
    } finally {
      setClassifying(false);
    }
  }, [selectedModel, currentPath]);

  const revealInExplorer = useCallback(async (path: string) => {
    try {
      await invoke('reveal_in_explorer', { path });
    } catch (e) {
      console.error('Failed to open in explorer:', e);
    }
  }, []);

  const getHomeDir = useCallback(async () => {
    return await invoke<string>('get_home_dir');
  }, []);

  const cancelScan = useCallback(async () => {
    try {
      await invoke('cancel_scan');
    } catch (e) {
      console.error('Failed to cancel scan:', e);
    }
  }, []);

  const cleanMemory = useCallback(async () => {
    if (!selectedModel) throw new Error('No model selected');
    try {
      await invoke('clean_ollama_memory', { model: selectedModel });
    } catch (e) {
      console.error('Failed to clean memory:', e);
      throw e; // re-throw so caller can show toast
    }
  }, [selectedModel]);

  const parseUserIntent = async (prompt: string, model: string, url: string): Promise<IntentAction> => {
    try {
      const result: IntentAction = await invoke('parse_user_intent', {
        prompt,
        model,
        ollamaUrl: url
      });
      return result;
    } catch (err) {
      console.error("Failed to parse intent:", err);
      throw err;
    }
  };

  const generateSystemReport = async (files: FileNode[], model: string, url: string): Promise<string> => {
    try {
      // Map nodes to the FileMeta structure expected by the backend
      const topFiles: FileMeta[] = files.slice(0, 50).map((f) => {
        const now = Math.floor(Date.now() / 1000);
        const modifiedDaysAgo = f.modified ? Math.floor((now - f.modified) / 86400) : 0;
        return {
          name: f.name,
          path: f.path,
          size_bytes: f.size,
          extension: f.extension,
          is_dir: f.is_dir,
          modified_days_ago: modifiedDaysAgo,
        };
      });

      const report: string = await invoke('generate_system_report', {
        files: topFiles,
        model,
        ollamaUrl: url
      });
      return report;
    } catch (err) {
      console.error("Failed to generate report:", err);
      throw err;
    }
  };

  const resetAll = useCallback(() => {
    setNodes([]);
    setScanning(false);
    setTotalSize(0);
    setCurrentPath('');
    setError(null);
    setClassifying(false);
    setKnownJunk([]);
    setDuplicateModels([]);
    setAppUninstallerResult(null);
  }, []);

  const chatWithModel = async (message: string, model: string, url: string): Promise<string> => {
    const result: string = await invoke('chat_with_model', {
      message,
      model,
      ollamaUrl: url,
    });
    return result;
  };

  return {
    nodes,
    scanning,
    totalSize,
    currentPath,
    error,
    classifying,
    ollamaOnline,
    ollamaModels,
    selectedModel,
    setSelectedModel,
    knownJunk,
    volumes,
    appUninstallerResult,
    duplicateModels,
    checkOllama,
    loadVolumes,
    scanDirectory,
    scanKnownJunk,
    scanAppForUninstaller,
    scanModelDuplicates,
    parseUserIntent,
    generateSystemReport,
    chatWithModel,
    resetAll,
    clearAppUninstallerResult,
    classifyWithAI,
    revealInExplorer,
    getHomeDir,
    cancelScan,
    cleanMemory,
  };
}
