import { useState, useMemo, useRef, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { OllamaOnboarding } from './OllamaOnboarding';
import './OllamaOnboarding.css';
import {
  ScanLine,
  FolderOpen,
  Brain,
  Trash2,
  HardDrive,
  RefreshCw,
  Wifi,
  WifiOff,
  Home,
  AlertCircle,
  Activity,
  ChevronDown,
  Star,
  Cpu,
} from 'lucide-react';


interface ScanPanelProps {
  onScan: (path: string) => void;
  onScanKnownJunk: () => void;
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

// ── Custom Model Dropdown ───────────────────────────────────────────────────
function ModelDropdown({
  models,
  selected,
  onChange,
  disabled,
  recommendedModels,
}: {
  models: string[];
  selected: string;
  onChange: (m: string) => void;
  disabled: boolean;
  recommendedModels: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = (m: string) => m.replace(/:latest$/, '');
  const isRec = (m: string) => recommendedModels.includes(m);

  const selectedDisplay = selected ? displayName(selected) : 'Select a model…';

  return (
    <div className={`model-dropdown${disabled ? ' model-dropdown--disabled' : ''}`} ref={ref}>
      {/* Trigger button */}
      <button
        type="button"
        className="model-dropdown__trigger"
        onClick={() => !disabled && setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className="model-dropdown__trigger-left">
          <Cpu size={13} className="model-dropdown__cpu-icon" />
          <span className="model-dropdown__selected-name">{selectedDisplay}</span>
          {selected && isRec(selected) && (
            <span className="model-dropdown__rec-badge">
              <Star size={9} /> Recommended
            </span>
          )}
        </span>
        <ChevronDown size={14} className={`model-dropdown__chevron${open ? ' model-dropdown__chevron--open' : ''}`} />
      </button>

      {/* Panel */}
      {open && (
        <div className="model-dropdown__panel" role="listbox">
          {models.length === 0 ? (
            <div className="model-dropdown__empty">No models available</div>
          ) : (
            models.map(m => {
              const rec = isRec(m);
              const active = m === selected;
              return (
                <button
                  key={m}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`model-dropdown__item${active ? ' model-dropdown__item--active' : ''}${rec ? ' model-dropdown__item--rec' : ''}`}
                  onClick={() => { onChange(m); setOpen(false); }}
                >
                  <span className="model-dropdown__item-name">{displayName(m)}</span>
                  {rec && (
                    <span className="model-dropdown__item-badge">
                      <Star size={9} /> Recommended
                    </span>
                  )}
                  {active && <span className="model-dropdown__item-check">✓</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function ScanPanel({
  onScan,
  onScanKnownJunk,
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

  const recommendedModels = useMemo(() => ['qwen3.5:0.8b', 'qwen3.5:2b', 'llama3.2:1b', 'llama3.2:3b'], []);
  
  const { sortedModels, missingRecommended } = useMemo(() => {
    const sorted = [...ollamaModels].sort((a, b) => {
      const aIsRec = recommendedModels.includes(a);
      const bIsRec = recommendedModels.includes(b);
      if (aIsRec && !bIsRec) return -1;
      if (!aIsRec && bIsRec) return 1;
      return a.localeCompare(b);
    });

    const missing = recommendedModels.filter(m => !ollamaModels.includes(m));
    return { sortedModels: sorted, missingRecommended: missing };
  }, [ollamaModels, recommendedModels]);

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

      {/* Target Selection */}
      <section className="panel-section">
        <h3 className="section-title">
          <FolderOpen size={14} /> Scan Target
        </h3>
        
        {volumes.length > 0 && (
          <div className="volume-list" style={{ marginBottom: 16 }}>
            {volumes.map((vol) => (
              <button
                key={vol.path}
                className="volume-btn"
                onClick={() => setCustomPath(vol.path)}
                title={`Select volume: ${vol.name} (then press Scan)`}
              >
                <HardDrive size={14} />
                <span>{vol.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="path-input-row">
          <input
            className="path-input"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="/path/to/scan"
            onKeyDown={(e) => e.key === 'Enter' && customPath && !scanning && onScan(customPath)}
            disabled={scanning}
          />
          <button className="icon-btn" onClick={handleBrowse} disabled={scanning} title="Browse Folder">
            <FolderOpen size={16} />
          </button>
        </div>
        
        <div className="btn-group">
          {scanning ? (
            <button className="btn btn-danger-outline" onClick={onCancelScan} style={{ flex: 1 }}>
              <AlertCircle size={14} /> Cancel Scan
            </button>
          ) : (
            <>
              <button
                className="btn btn-primary"
                onClick={() => customPath && onScan(customPath)}
                disabled={!customPath}
              >
                <ScanLine size={14} /> Scan
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleScanHome}
                disabled={scanning}
                title="Scan Home Folder"
              >
                <Home size={14} /> Home
              </button>
            </>
          )}
        </div>
      </section>

      {/* Quick Tools */}
      <section className="panel-section">
        <h3 className="section-title">Quick Tools</h3>
        <button
          className="btn btn-danger-outline"
          onClick={onScanKnownJunk}
          disabled={scanning}
          style={{ padding: '8px 8px', fontSize: '11px' }}
        >
          <Trash2 size={12} /> Find Global Junk
        </button>
        <p className="hint">Quickly isolates OS caches, temp files, and artifacts without full scan.</p>
      </section>

      {/* Stats */}
      {nodeCount > 0 && (
        <section className="panel-section stats-section">
          <h3 className="section-title">Current Scan Details</h3>
          <div className="stat-row">
            <span className="stat-label">Total Size</span>
            <span className="stat-value">{formatSize(totalSize)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Items Found</span>
            <span className="stat-value">{nodeCount}</span>
          </div>
          {currentPath && (
            <div className="stat-row">
              <span className="stat-label">Root</span>
              <span className="stat-value stat-path" title={currentPath}>
                {currentPath.length > 25 ? '…' + currentPath.slice(-22) : currentPath}
              </span>
            </div>
          )}
        </section>
      )}

      {/* AI Analysis section */}
      <section className="panel-section">
        <h3 className="section-title" style={{ color: '#818cf8' }}>
          <Brain size={14} /> Analyzer AI 
        </h3>

        <div className="ollama-status">
          {ollamaOnline === null && (
            <span className="status-dot status-checking">
              <RefreshCw size={11} className="spin" /> Checking connection…
            </span>
          )}
          {ollamaOnline === true && (
            <span className="status-dot status-online">
              <Wifi size={11} /> Ready
            </span>
          )}
          {ollamaOnline === false && (
            <span className="status-dot status-offline">
              <WifiOff size={11} /> Offline
            </span>
          )}
          <button className="icon-btn small" onClick={onCheckOllama} title="Refresh connection">
            <RefreshCw size={13} />
          </button>
        </div>

        {ollamaOnline === false || (ollamaOnline === true && ollamaModels.length === 0) ? (
          <OllamaOnboarding 
            ollamaOnline={ollamaOnline} 
            ollamaModels={ollamaModels} 
            onCheckOllama={onCheckOllama} 
          />
        ) : (
          <>
            <ModelDropdown
              models={sortedModels}
              selected={selectedModel}
              onChange={onModelChange}
              disabled={!ollamaOnline || ollamaModels.length === 0}
              recommendedModels={recommendedModels}
            />
            
            {missingRecommended.length === recommendedModels.length && (
              <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', marginBottom: '14px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fcd34d', marginBottom: '4px', fontWeight: 600 }}>
                  <AlertCircle size={12} /> Missing recommended models
                </div>
                Some specialized fast models are missing. To improve analysis, consider installing: 
                <div style={{ margin: '4px 0', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {missingRecommended.slice(0, 2).join(', ')}{missingRecommended.length > 2 ? ', ...' : ''}
                </div>
                Required RAM: ~2GB - 4GB
              </div>
            )}
            
            <div className="button-group-vertical">
              <button
                className="btn btn-primary"
                disabled={!ollamaOnline || !selectedModel || nodeCount === 0}
                onClick={onGenerateReport}
                title={nodeCount === 0 ? 'Scan a directory first to generate a health report' : 'Generate a full AI-powered system health report based on your scan results'}
                style={{ 
                  background: nodeCount === 0 ? undefined : 'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(52, 211, 153, 0.9))',
                  justifyContent: 'center',
                  padding: '10px'
                }}
              >
                <Activity size={16} /> Generate Health Report
              </button>
              
              <button
                className="btn btn-secondary"
                disabled={!ollamaOnline || !selectedModel || classifying || nodeCount === 0}
                onClick={onClassify}
                title={nodeCount === 0 ? 'Scan a directory first before classifying' : 'Use AI to evaluate files in current view and flag potential junk'}
                style={{ justifyContent: 'center' }}
              >
                <Brain size={14} /> {classifying ? 'Classifying...' : 'Classify Current View'}
              </button>
                
              <button
                className="btn btn-danger-outline"
                disabled={!ollamaOnline || !selectedModel}
                onClick={onCleanMemory}
                title="Free up RAM by forcefully unloading the model"
                style={{ marginTop: '4px', fontSize: '11px', padding: '6px' }}
              >
                Unload Model Memory
              </button>
            </div>
          </>
        )}
      </section>

      {error && (
        <div className="error-box">
          <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      <div className="panel-footer">
        <span>JunkCleaner v0.2.0</span>
        <span>Reads metadata, not file contents.</span>
      </div>
    </aside>
  );
}

