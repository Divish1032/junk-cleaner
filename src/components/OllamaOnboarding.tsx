import { Download, Terminal, Settings, AlertCircle, RefreshCw, Cpu, Brain } from 'lucide-react';

interface OllamaOnboardingProps {
  ollamaOnline: boolean | null;
  ollamaModels: string[];
  onCheckOllama: () => void;
}

export function OllamaOnboarding({ ollamaOnline, ollamaModels, onCheckOllama }: OllamaOnboardingProps) {
  const modelsToRecommend = [
    {
      id: "qwen3.5:0.8b",
      name: "Qwen 3.5 (0.8B)",
      specs: "~2GB RAM, 1GB Disk",
      bestFor: "Older laptops, extremely fast inference",
      icon: <Cpu size={14} className="model-icon speed" />
    },
    {
      id: "qwen3.5:2b",
      name: "Qwen 3.5 (2B)",
      specs: "~4GB RAM, 2.7GB Disk",
      bestFor: "Everyday use, great balance of speed/accuracy",
      icon: <Brain size={14} className="model-icon balance" />
    },
    {
      id: "llama3.2:1b",
      name: "Llama 3.2 (1B)",
      specs: "~2GB RAM, 1.3GB Disk",
      bestFor: "Fast, lightweight classification tasks",
      icon: <Cpu size={14} className="model-icon speed" />
    },
    {
      id: "llama3.2:3b",
      name: "Llama 3.2 (3B)",
      specs: "~4GB RAM, 2.0GB Disk",
      bestFor: "More complex reasoning and detailed reports",
      icon: <Brain size={14} className="model-icon smart" />
    }
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here if desired
  };

  // State 1: Checking
  if (ollamaOnline === null) {
    return (
      <div className="onboarding-container checking">
        <RefreshCw size={24} className="spin text-muted" />
        <p>Checking AI Engine status...</p>
      </div>
    );
  }

  // State 2: Ollama Not Running/Installed
  if (ollamaOnline === false) {
    return (
      <div className="onboarding-container offline-state">
        <div className="onboarding-header">
          <div className="icon-wrapper alert">
            <AlertCircle size={28} />
          </div>
          <h4>AI Engine Offline</h4>
        </div>
        
        <p className="onboarding-desc">
          JunkCleaner uses <strong>Ollama</strong> to run AI models entirely on your device. 
          This ensures 100% privacy—no file data ever leaves your computer.
        </p>

        <div className="onboarding-actions">
          <a 
            href="https://ollama.com/download" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-primary"
          >
            <Download size={16} /> Download Ollama
          </a>
          <button className="btn btn-secondary" onClick={onCheckOllama}>
            <RefreshCw size={14} /> I've Installed & Started It
          </button>
        </div>
      </div>
    );
  }

  // State 3: Ollama is running, but no models installed
  if (ollamaOnline === true && ollamaModels.length === 0) {
    return (
      <div className="onboarding-container models-state">
        <div className="onboarding-header">
          <div className="icon-wrapper setup">
            <Settings size={28} />
          </div>
          <h4>AI Model Required</h4>
        </div>
        
        <p className="onboarding-desc">
          Ollama is running, but no AI models are installed. You need to download the "brain" 
          for the AI to work. Choose one of the recommended lightweight models below.
        </p>
        
        <div className="cpu-notice">
          <AlertCircle size={14} />
          <span><strong>CPU-Only Systems:</strong> No GPU? No problem. Ollama automatically falls back to CPU. Scans will just take a bit longer.</span>
        </div>

        <div className="model-recommendations">
          {modelsToRecommend.map((model) => (
            <div key={model.id} className="model-card">
              <div className="model-card-header">
                {model.icon}
                <span className="model-name">{model.name}</span>
                <button 
                  className="copy-command-btn" 
                  onClick={() => handleCopy(`ollama run ${model.id}`)}
                  title="Copy terminal command"
                >
                  <Terminal size={12} /> <span className="cmd-text">ollama run {model.id}</span>
                </button>
              </div>
              <div className="model-details">
                <p className="model-specs"><strong>Specs:</strong> {model.specs}</p>
                <p className="model-best-for"><strong>Best for:</strong> {model.bestFor}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="onboarding-footer">
          <p>Paste the command in your terminal, wait for the download to finish, then refresh.</p>
          <button className="btn btn-secondary w-full" onClick={onCheckOllama}>
            <RefreshCw size={14} /> Refresh AI Connection
          </button>
        </div>
      </div>
    );
  }

  // If online and models exist, this component shouldn't render (handled by parent),
  // but just in case, return null or an empty div.
  return null;
}
