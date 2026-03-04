import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileNode, DiskUsageResult, FileMeta, FileClassification, Volume } from '../types';

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

  const checkOllama = useCallback(async () => {
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
    } catch (e) {
      setOllamaOnline(false);
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
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }, []);

  const scanKnownJunk = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      // Send the currently selected path, or empty string if global
      const junk = await invoke<FileNode[]>('scan_known_junk', { path: currentPath || '' });
      setKnownJunk(junk);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }, [currentPath]);

  const classifyWithAI = useCallback(async (filesToClassify: FileNode[]) => {
    if (!selectedModel) return;
    setClassifying(true);
    try {
      // Find the current directory node to classify it and its immediate children
      let targetFiles = filesToClassify;
      if (currentPath) {
        // If there's a current scan root, we primarily want to classify its children
        // The disk scanner might return the root node or a list of top-level children
        // We'll flatten the immediate children of the top-level nodes if they match the path
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

      // Merge classifications back into nodes
      // We need a recursive map update function to apply classifications deeply
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
    } catch (e) {
      setError(String(e));
    } finally {
      setClassifying(false);
    }
  }, [selectedModel]);

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
    if (!selectedModel) return;
    try {
      await invoke('clean_ollama_memory', { model: selectedModel });
    } catch (e) {
      console.error('Failed to clean memory:', e);
    }
  }, [selectedModel]);

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
    checkOllama,
    loadVolumes,
    scanDirectory,
    scanKnownJunk,
    classifyWithAI,
    revealInExplorer,
    getHomeDir,
    cancelScan,
    cleanMemory,
  };
}
