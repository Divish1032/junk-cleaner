import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { ViewMode } from '../types';
import {
  ScanLine,
  FolderOpen,
  Brain,
  Trash2,
  HardDrive,
  Cpu,
  RefreshCw,
  Wifi,
  WifiOff,
  Home,
  AlertCircle,
  Copy,
  Sparkles,
  Activity,
} from 'lucide-react';

interface ScanPanelProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onScan: (path: string) => void;
  onScanKnownJunk: () => void;
  onScanModelDuplicates: () => void;
  onClassify: () => void;
  onGenerateReport: () => void;
  scanning: boolean;
  classifying: boolean;
  ollamaOnline: boolean | null;
  ollamaModels: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  totalSize: number;
  nodeCount: number;
  currentPath: string;
  error: string | null;
  onCheckOllama: () => void;
  getHomeDir: () => Promise<string>;
  volumes: { name: string; path: string }[];
  onCancelScan: () => void;
  onCleanMemory: () => void;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function ScanPanel({
  viewMode,
  onViewModeChange,
  onScan,
  onScanKnownJunk,
  onScanModelDuplicates,
  onClassify,
  onGenerateReport,
  scanning,
  classifying,
  ollamaOnline,
  ollamaModels,
  selectedModel,
  onModelChange,
  totalSize,
  nodeCount,
  currentPath,
  error,
  onCheckOllama,
  getHomeDir,
  volumes,
  onCancelScan,
  onCleanMemory,
}: ScanPanelProps) {
  const [customPath, setCustomPath] = useState('');

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Choose a directory to scan',
      });
      if (selected && typeof selected === 'string') {
        setCustomPath(selected);
        onScan(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleScanHome = async () => {
    const home = await getHomeDir();
    setCustomPath(home);
    onScan(home);
  };

  return (
    <aside className="scan-panel">
      <div className="panel-logo">
        <Trash2 size={28} color="#6366f1" />
        <h1>JunkCleaner</h1>
      </div>

      {/* Volumes */}
      {volumes.length > 0 && (
        <section className="panel-section">
          <h3 className="section-title">
            <HardDrive size={14} /> Volumes
          </h3>
          <div className="volume-list">
            {volumes.map((vol) => (
              <button
                key={vol.path}
                className="volume-btn"
                onClick={() => { setCustomPath(vol.path); onScan(vol.path); }}
              >
                <HardDrive size={14} />
                <span>{vol.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Custom path scan */}
      <section className="panel-section">
        <h3 className="section-title">
          <FolderOpen size={14} /> Directory
        </h3>
        <div className="path-input-row">
          <input
            className="path-input"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="/path/to/scan"
            onKeyDown={(e) => e.key === 'Enter' && customPath && onScan(customPath)}
          />
          <button className="icon-btn" onClick={handleBrowse} title="Browse">
            <FolderOpen size={16} />
          </button>
        </div>
        <div className="btn-group">
          {scanning ? (
            <button className="btn btn-danger-outline" onClick={onCancelScan}>
              <AlertCircle size={14} /> Cancel Scan
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => customPath && onScan(customPath)}
              disabled={!customPath}
            >
              <ScanLine size={14} /> Scan
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={handleScanHome}
            disabled={scanning}
          >
            <Home size={14} /> Home
          </button>
        </div>
      </section>

      {/* Stats */}
      {nodeCount > 0 && (
        <section className="panel-section stats-section">
          <div className="stat-row">
            <span className="stat-label">Total Size</span>
            <span className="stat-value">{formatSize(totalSize)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Items</span>
            <span className="stat-value">{nodeCount}</span>
          </div>
          {currentPath && (
            <div className="stat-row">
              <span className="stat-label">Path</span>
              <span className="stat-value stat-path" title={currentPath}>
                {currentPath.length > 28 ? '…' + currentPath.slice(-25) : currentPath}
              </span>
            </div>
          )}
        </section>
      )}

      {/* Known Junk Scan */}
      <section className="panel-section">
        <button
          className="btn btn-danger-outline"
          onClick={onScanKnownJunk}
          disabled={scanning}
        >
          <Trash2 size={14} /> Scan Known Junk
        </button>
        <p className="hint">Finds OS caches, tmp files, dev artifacts</p>
      </section>

      {/* AI Analysis */}
      <section className="panel-section">
        <h3 className="section-title">
          <Brain size={14} /> AI Analysis (Ollama)
        </h3>

        <div className="ollama-status">
          {ollamaOnline === null && (
            <span className="status-dot status-checking">
              <RefreshCw size={11} className="spin" /> Checking…
            </span>
          )}
          {ollamaOnline === true && (
            <span className="status-dot status-online">
              <Wifi size={11} /> Connected
            </span>
          )}
          {ollamaOnline === false && (
            <span className="status-dot status-offline">
              <WifiOff size={11} /> Offline
            </span>
          )}
          <button className="icon-btn small" onClick={onCheckOllama} title="Refresh">
            <RefreshCw size={13} />
          </button>
        </div>

      {/* LLM Controls */}
      <section className="panel-section">
        <h3>AI Assistant</h3>
        <div className="model-selector">
          <label htmlFor="model-select">Model:</label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={!ollamaOnline || ollamaModels.length === 0}
          >
            {ollamaModels.length === 0 ? (
              <option value="">No models found</option>
            ) : (
              ollamaModels.map((m) => (
                <option key={m} value={m}>
                  {m.replace(':latest', '')}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="button-group-vertical" style={{ marginTop: 12 }}>
          <button
            className="btn btn-secondary"
            disabled={!ollamaOnline || !selectedModel || classifying}
            onClick={onClassify}
            title="Uses Ollama to guess if files are safe to delete based on name/path"
          >
            {classifying ? 'Classifying...' : 'Classify Current View'}
          </button>
          
          <button
            className="btn btn-primary"
            disabled={!ollamaOnline || !selectedModel}
            onClick={onGenerateReport}
            title="Generate a personalized system health report"
            style={{ 
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(52, 211, 153, 0.9))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Activity size={16} /> Generate Health Report
          </button>
            
          <button
            className="btn btn-secondary"
            disabled={!ollamaOnline || !selectedModel}
            onClick={onCleanMemory}
            title="Unload the model from RAM explicitly"
          >
            Unload Model from Memory
          </button>
        </div>
      </section>
        <p className="hint">Classifies by name, size, path — no file content read</p>
      </section>

      {/* View mode toggle */}
      <section className="panel-section">
        <h3 className="section-title">View</h3>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'tree' ? 'active' : ''}`}
            onClick={() => onViewModeChange('tree')}
          >
            <HardDrive size={14} /> All Files
          </button>
          <button
            className={`toggle-btn ${viewMode === 'junk' ? 'active' : ''}`}
            onClick={() => onViewModeChange('junk')}
          >
            <Trash2 size={14} /> Junk Only
          </button>
          <button
            className={`toggle-btn ${viewMode === 'duplicates' ? 'active' : ''}`}
            onClick={() => {
              onViewModeChange('duplicates');
              onScanModelDuplicates();
            }}
          >
            <Copy size={14} /> Duplicates
          </button>
          <button
            className={`toggle-btn ${viewMode === 'chat' ? 'active' : ''}`}
            onClick={() => onViewModeChange('chat')}
          >
            <Sparkles size={14} /> Copilot Chat
          </button>
        </div>
      </section>

      {error && (
        <div className="error-box">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="panel-footer">
        <span>JunkCleaner v0.1.0</span>
        <span>No files deleted automatically</span>
      </div>
    </aside>
  );
}
