import { useEffect, useState } from 'react';
import { useScanner } from './hooks/useScanner';
import { ScanPanel } from './components/ScanPanel';
import { DiskTree } from './components/DiskTree';
import { JunkView } from './components/JunkView';
import { AppUninstallerModal } from './components/AppUninstallerModal';
import { ModelDuplicatesView } from './components/ModelDuplicatesView';
import { ChatView } from './components/ChatView';
import { SystemReportModal } from './components/SystemReportModal';
import { ViewMode, IntentAction } from './types';
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
  } = useScanner();

  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [systemReport, setSystemReport] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    checkOllama().then((isOnline) => {
      setOllamaStatus(isOnline ? 'online' : 'offline');
    });
    loadVolumes();
  }, []);

  const handleClassify = () => {
    classifyWithAI(nodes);
  };

  const handleGenerateReport = async () => {
    if (!selectedModel) return;
    setReportModalOpen(true);
    setIsGeneratingReport(true);
    try {
      const reportContent = await generateSystemReport(nodes, selectedModel, 'http://localhost:11434');
      setSystemReport(reportContent);
    } catch (e) {
      setSystemReport('Failed to generate system report. Please ensure Ollama is running and a model is loaded.');
    } finally {
      setIsGeneratingReport(false);
    }
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
      <ScanPanel
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onScan={scanDirectory}
        onScanKnownJunk={scanKnownJunk}
        onScanModelDuplicates={scanModelDuplicates}
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
        onCleanMemory={cleanMemory}
      />
      <main className="main-content">
        {viewMode === 'tree' ? (
          <>
            {scanning && (
              <div className="scan-overlay">
                <div className="scan-spinner" />
                <p>Scanning disk…</p>
              </div>
            )}
            <DiskTree nodes={nodes} onReveal={revealInExplorer} onScanApp={scanAppForUninstaller} />
          </>
        ) : viewMode === 'junk' ? (
          <>
            {scanning && (
              <div className="scan-overlay">
                <div className="scan-spinner" />
                <p>Scanning known junk locations…</p>
              </div>
            )}
            <JunkView
              knownJunk={knownJunk}
              aiJunk={nodes}
              onReveal={revealInExplorer}
            />
          </>
        ) : viewMode === 'duplicates' ? (
          <>
            {scanning && (
              <div className="scan-overlay">
                <div className="scan-spinner" />
                <p>Scanning for model duplicates…</p>
              </div>
            )}
            <ModelDuplicatesView 
              groups={duplicateModels} 
              onReveal={revealInExplorer} 
            />
          </>
        ) : (
          <ChatView 
            onParseIntent={(prompt) => parseUserIntent(prompt, selectedModel, 'http://localhost:11434')}
            onExecuteIntent={handleExecuteIntent}
            isOllamaAvailable={ollamaStatus === 'online'}
          />
        )}
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
