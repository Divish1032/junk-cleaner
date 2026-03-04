import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HardDrive, Trash2, Copy, Sparkles, FolderCode, RotateCcw } from 'lucide-react';
import { useScanner } from './hooks/useScanner';
import { ScanPanel } from './components/ScanPanel';
import { DiskTree } from './components/DiskTree';
import { JunkView } from './components/JunkView';
import { AppUninstallerModal } from './components/AppUninstallerModal';
import { ModelDuplicatesView } from './components/ModelDuplicatesView';
import { ChatView } from './components/ChatView';
import { DevCleanupView } from './components/DevCleanupView';
import { SystemReportModal } from './components/SystemReportModal';
import { ViewMode, IntentAction, DevArtifact } from './types';
import { Toaster, toast } from 'react-hot-toast';
import './App.css';

function App() {
  const {
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
    clearAppUninstallerResult,
    classifyWithAI,
    revealInExplorer,
    getHomeDir,
    cancelScan,
    cleanMemory,
    generateSystemReport,
    chatWithModel,
    resetAll,
  } = useScanner();

  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  // True while ANY Ollama request is in-flight — limits to 1 concurrent request
  const [ollamaLoading, setOllamaLoading] = useState(false);
  
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [systemReport, setSystemReport] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);
  const [devArtifacts, setDevArtifacts] = useState<DevArtifact[]>([]);
  const [scanningDev, setScanningDev] = useState(false);

  // Derived: any AI operation running? Block tab switching while true.
  const isOllamaBusy = ollamaLoading || classifying || isGeneratingReport;

  useEffect(() => {
    checkOllama().then((isOnline) => {
      setOllamaStatus(isOnline ? 'online' : 'offline');
    });
    loadVolumes();
  }, []);

  const handleGenerateReport = async () => {
    if (!selectedModel) {
      toast.error('Please select an AI model first.');
      return;
    }
    if (nodes.length === 0) {
      toast.error('Please scan a directory first to generate a report.');
      return;
    }
    setReportModalOpen(true);
    setIsGeneratingReport(true);
    setSystemReport('');
    const tid = toast.loading('Generating system health report…');
    try {
      const reportContent = await generateSystemReport(nodes, selectedModel, 'http://localhost:11434');
      setSystemReport(reportContent);
      toast.success('Report generated!', { id: tid });
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate report. Is Ollama running?', { id: tid });
      setSystemReport('⚠️ Failed to generate system report. Please ensure Ollama is running and a model is loaded.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleClassify = async () => {
    if (isOllamaBusy) {
      toast.error('An AI request is already running — please wait.');
      return;
    }
    if (nodes.length === 0) {
      toast.error('Scan a directory first before classifying.');
      return;
    }
    const tid = toast.loading('Classifying files with AI…');
    setOllamaLoading(true);
    try {
      const count = await classifyWithAI(nodes);
      toast.success(`Classified ${count ?? 0} items.`, { id: tid });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || 'Failed to classify files.', { id: tid });
    } finally {
      setOllamaLoading(false);
    }
  };

  const handleCleanMemory = async () => {
    try {
      await cleanMemory();
      toast.success(`Unloaded model ${selectedModel} from memory.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to unload model memory.');
    }
  };

  const handleReset = () => {
    resetAll();
    setViewMode('tree');
    setSystemReport('');
    setReportModalOpen(false);
    setChatPrefill(null);
    setIsGeneratingReport(false);
    setDevArtifacts([]);
    toast.success('App reset to initial state.');
  };

  const handleScanDevArtifacts = async (root?: string) => {
    // Use explicit root → currentPath → bail out (never auto-scan home)
    const scanRoot = root ?? currentPath;
    setViewMode('dev');
    if (!scanRoot) {
      // No directory selected — just navigate to the tab, show empty state
      return;
    }
    setScanningDev(true);
    try {
      const results = await invoke<DevArtifact[]>('scan_dev_artifacts', { root: scanRoot });
      setDevArtifacts(results);
      toast.success(`Found ${results.length} dev artifact${results.length !== 1 ? 's' : ''}.`);
    } catch (e) {
      toast.error('Failed to scan for dev artifacts.');
    } finally {
      setScanningDev(false);
    }
  };

  /**
   * Called when user clicks the "Ask AI" icon on a file row.
   * Generates a STRICTLY READ-ONLY, metadata-only prompt.
   * The prompt:
   *  - Contains ONLY name, path, size, type, modified date — no file contents
   *  - Explicitly forbids any modify/delete/move operations
   *  - Switches to the chat view and pre-fills the input
   */
  const handleAskAI = (path: string, node: { name: string; size: number; is_dir: boolean; modified: number }) => {
    const sizeStr = node.size >= 1_073_741_824
      ? `${(node.size / 1_073_741_824).toFixed(1)} GB`
      : node.size >= 1_048_576
      ? `${(node.size / 1_048_576).toFixed(1)} MB`
      : node.size >= 1_024
      ? `${(node.size / 1_024).toFixed(1)} KB`
      : `${node.size} B`;
    const kind = node.is_dir ? 'directory' : 'file';
    const modifiedDate = node.modified ? new Date(node.modified * 1000).toLocaleDateString() : 'unknown';
    // Strictly metadata-only prompt. No file content access, no destructive actions.
    const prompt = `[READ-ONLY METADATA ANALYSIS] Tell me about this ${kind} based only on its metadata:\n` +
      `Name: ${node.name}\n` +
      `Path: ${path}\n` +
      `Size: ${sizeStr}\n` +
      `Type: ${kind}\n` +
      `Last Modified: ${modifiedDate}\n\n` +
      `What can you tell me about this ${kind}? Is it likely safe to delete, or is it important? ` +
      `Base your answer only on the metadata above — do not read, edit, or delete any files.`;
    setChatPrefill(prompt);
    setViewMode('chat');
  };

  const handleExecuteIntent = async (intent: IntentAction) => {
    switch (intent.action) {
      case 'scan_junk':
        setViewMode('junk');
        await scanKnownJunk();
        break;
      case 'scan_model_duplicates':
        setViewMode('duplicates');
        await scanModelDuplicates();
        break;
      case 'scan_large_files':
        if (intent.path) {
          setViewMode('tree');
          await scanDirectory(intent.path);
        } else {
          setViewMode('tree');
          await scanDirectory('~');
        }
        break;
      // 'unknown' is handled by the ChatView component directly
    }
  };

  return (
    <div className="app-layout">
      <Toaster position="bottom-right" />
      <ScanPanel
        onScan={async (path) => {
          const tid = toast.loading('Scanning directory…');
          try {
            await scanDirectory(path);
            toast.success('Scan complete!', { id: tid });
          } catch {
            toast.error('Scan failed.', { id: tid });
          }
        }}
        onScanKnownJunk={async () => {
          setViewMode('junk');
          await scanKnownJunk();
          toast.success('Global junk scan complete');
        }}
        onClassify={handleClassify}
        onGenerateReport={handleGenerateReport}
        scanning={scanning}
        classifying={classifying}
        ollamaOnline={ollamaOnline}
        ollamaModels={ollamaModels}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        totalSize={totalSize}
        nodeCount={nodes.length}
        currentPath={currentPath}
        error={error}
        onCheckOllama={checkOllama}
        getHomeDir={getHomeDir}
        volumes={volumes}
        onCancelScan={cancelScan}
        onCleanMemory={handleCleanMemory}
      />
      <main className="main-content">
        {/* ── Top toolbar: view tabs + reset ──────────────────── */}
        <div className="main-toolbar">
          <div className="main-tabs">
            <button
              className={`tab-btn ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => !isOllamaBusy && setViewMode('tree')}
              disabled={isOllamaBusy}
              title={isOllamaBusy ? 'AI is processing — please wait' : ''}
            >
              <HardDrive size={14} /> Explore
            </button>
            <button
              className={`tab-btn ${viewMode === 'junk' ? 'active' : ''}`}
              onClick={() => !isOllamaBusy && setViewMode('junk')}
              disabled={isOllamaBusy}
              title={isOllamaBusy ? 'AI is processing — please wait' : ''}
            >
              <Trash2 size={14} /> Junk Items
            </button>
            <button
              className={`tab-btn ${viewMode === 'duplicates' ? 'active' : ''}`}
              onClick={() => { if (!isOllamaBusy) { setViewMode('duplicates'); scanModelDuplicates(); } }}
              disabled={isOllamaBusy}
              title={isOllamaBusy ? 'AI is processing — please wait' : ''}
            >
              <Copy size={14} /> Duplicates
            </button>
            <button
              className={`tab-btn ${viewMode === 'chat' ? 'active' : ''}`}
              onClick={() => !isOllamaBusy && setViewMode('chat')}
              disabled={isOllamaBusy}
              title={isOllamaBusy ? 'AI is processing — please wait' : ''}
            >
              <Sparkles size={14} /> Copilot Chat
            </button>
            <button
              className={`tab-btn tab-btn--dev ${viewMode === 'dev' ? 'active' : ''}`}
              onClick={() => !isOllamaBusy && handleScanDevArtifacts()}
              disabled={isOllamaBusy}
              title={isOllamaBusy ? 'AI is processing — please wait' : 'Find regeneratable dev folders: node_modules, target, .venv, etc.'}
            >
              <FolderCode size={14} /> Dev Cleanup
            </button>
          </div>
          {/* Busy indicator */}
          {isOllamaBusy && (
            <span className="toolbar-ai-busy" title="AI is thinking…">
              <span className="toolbar-spinner" /> AI thinking…
            </span>
          )}
          <button
            className="btn btn-danger-outline reset-btn"
            onClick={handleReset}
            disabled={isOllamaBusy}
            title={isOllamaBusy ? 'AI is processing — please wait' : 'Clear all scan results and reset to initial state'}
          >
            <RotateCcw size={13} /> Reset All
          </button>
        </div>
        <div className="main-view-content">
        {viewMode === 'tree' ? (
          <>
            {scanning && (
              <div className="scan-overlay">
                <div className="scan-spinner" />
                <p>Scanning disk…</p>
              </div>
            )}
            {!scanning && nodes.length === 0 ? (
              <div className="tab-empty-state">
                <div className="tab-empty-icon">📁</div>
                <div className="tab-empty-title">No directory scanned yet</div>
                <div className="tab-empty-desc">
                  Enter a path or browse to a folder in the sidebar, then click <strong>Scan</strong> to explore its contents.
                </div>
              </div>
            ) : (
              <DiskTree nodes={nodes} onReveal={revealInExplorer} onScanApp={scanAppForUninstaller} onAskAI={handleAskAI} />
            )}
          </>
        ) : viewMode === 'junk' ? (
          <>
            {scanning && (
              <div className="scan-overlay">
                <div className="scan-spinner" />
                <p>Scanning known junk locations…</p>
              </div>
            )}
            {!scanning && knownJunk.length === 0 && nodes.length === 0 ? (
              <div className="tab-empty-state">
                <div className="tab-empty-icon">🗑️</div>
                <div className="tab-empty-title">No junk scanned yet</div>
                <div className="tab-empty-desc">
                  Click <strong>Find Global Junk</strong> in the sidebar to scan well-known junk locations (caches, logs, temp files) across your system.
                </div>
              </div>
            ) : (
              <JunkView knownJunk={knownJunk} aiJunk={nodes} onReveal={revealInExplorer} />
            )}
          </>
        ) : viewMode === 'duplicates' ? (
          <>
            {scanning && (
              <div className="scan-overlay">
                <div className="scan-spinner" />
                <p>Scanning for model duplicates…</p>
              </div>
            )}
            {!scanning && duplicateModels.length === 0 ? (
              <div className="tab-empty-state">
                <div className="tab-empty-icon">🔁</div>
                <div className="tab-empty-title">No duplicates found yet</div>
                <div className="tab-empty-desc">
                  Click <strong>Duplicates</strong> to scan your home folder for duplicate AI model files. This uses SHA-256 checksums — no AI required.
                </div>
              </div>
            ) : (
              <ModelDuplicatesView groups={duplicateModels} onReveal={revealInExplorer} />
            )}
          </>
        ) : viewMode === 'dev' ? (
          !currentPath ? (
            <div className="tab-empty-state">
              <div className="tab-empty-icon">🧹</div>
              <div className="tab-empty-title">No directory selected</div>
              <div className="tab-empty-desc">
                Select a project folder in the sidebar first, then click <strong>Dev Cleanup</strong> to scan it for regeneratable artifacts like <code>node_modules</code>, <code>target</code>, <code>.venv</code>, and more.
              </div>
            </div>
          ) : (
            <DevCleanupView
              artifacts={devArtifacts}
              scanning={scanningDev}
              onRefresh={() => handleScanDevArtifacts(currentPath)}
              onReveal={revealInExplorer}
              onAskAI={(prompt) => {
                setChatPrefill(prompt);
                setViewMode('chat');
              }}
            />
          )
        ) : (
          /* Chat tab */
          ollamaStatus === 'offline' ? (
            <div className="tab-empty-state">
              <div className="tab-empty-icon">🤖</div>
              <div className="tab-empty-title">Ollama is not running</div>
              <div className="tab-empty-desc">
                Start Ollama on your machine (<code>ollama serve</code>) and then click <strong>Check Ollama</strong> in the sidebar to connect.
              </div>
            </div>
          ) : !selectedModel ? (
            <div className="tab-empty-state">
              <div className="tab-empty-icon">🧠</div>
              <div className="tab-empty-title">No AI model selected</div>
              <div className="tab-empty-desc">
                Choose a model from the <strong>AI Model</strong> dropdown in the sidebar. We recommend <code>llama3.2:1b</code> or <code>llama3.2:3b</code> for best results.
              </div>
            </div>
          ) : (
            <ChatView
              onParseIntent={async (prompt) => {
                if (ollamaLoading) return { action: 'unknown', confidence: 1.0, message: 'An AI request is already running — please wait.' };
                if (!selectedModel) return { action: 'unknown', confidence: 1.0, message: 'No AI model selected.' };
                setOllamaLoading(true);
                try {
                  return await parseUserIntent(prompt, selectedModel, 'http://localhost:11434');
                } finally {
                  setOllamaLoading(false);
                }
              }}
              onExecuteIntent={handleExecuteIntent}
              isOllamaAvailable={ollamaStatus === 'online'}
              onFreeformQuery={async (msg) => {
                if (ollamaLoading) return 'An AI request is already running — please wait for it to finish.';
                if (!selectedModel) return 'No AI model selected. Please choose a model in the sidebar first.';
                setOllamaLoading(true);
                try {
                  return await chatWithModel(msg, selectedModel, 'http://localhost:11434');
                } finally {
                  setOllamaLoading(false);
                }
              }}
              prefillQuery={chatPrefill}
              onPrefillConsumed={() => setChatPrefill(null)}
            />
          )
        )}

        </div>{/* end .main-view-content */}
      </main>

      {/* App Uninstaller Modal */}
      {appUninstallerResult && (
        <AppUninstallerModal
          info={appUninstallerResult}
          onClose={clearAppUninstallerResult}
          onReveal={revealInExplorer}
        />
      )}

      {/* AI System Report Modal */}
      <SystemReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        report={systemReport}
        isGenerating={isGeneratingReport}
      />
    </div>
  );
}

export default App;
