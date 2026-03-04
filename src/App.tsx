import { useEffect, useState } from 'react';
import { useScanner } from './hooks/useScanner';
import { ScanPanel } from './components/ScanPanel';
import { DiskTree } from './components/DiskTree';
import { JunkView } from './components/JunkView';
import { ViewMode } from './types';
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
    checkOllama,
    loadVolumes,
    scanDirectory,
    scanKnownJunk,
    classifyWithAI,
    revealInExplorer,
    getHomeDir,
    cancelScan,
    cleanMemory,
  } = useScanner();

  const [viewMode, setViewMode] = useState<ViewMode>('tree');

  useEffect(() => {
    checkOllama();
    loadVolumes();
  }, []);

  const handleClassify = () => {
    classifyWithAI(nodes);
  };

  return (
    <div className="app-layout">
      <ScanPanel
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onScan={scanDirectory}
        onScanKnownJunk={scanKnownJunk}
        onClassify={handleClassify}
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
            <DiskTree nodes={nodes} onReveal={revealInExplorer} />
          </>
        ) : (
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
        )}
      </main>
    </div>
  );
}

export default App;
