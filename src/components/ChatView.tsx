import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, ShieldAlert, Zap, MessageCircle } from 'lucide-react';
import { IntentAction } from '../types';

// ── CLIENT-SIDE WRITE-PROTECTION WHITELIST ────────────────────────────────────
// This is Layer 4 (defense-in-depth). Even if a jailbroken LLM somehow returns
// a non-scan action and it slips past the Rust whitelist, we block it here too.
const ALLOWED_INTENT_ACTIONS = new Set(['scan_junk', 'scan_model_duplicates', 'scan_large_files', 'unknown']);
// ─────────────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  isAnalysis?: boolean; // file metadata analysis reply
}

interface ChatViewProps {
  /** Intent-routing handler (scan junk, large files, etc.) */
  onParseIntent: (prompt: string) => Promise<IntentAction | null>;
  onExecuteIntent: (intent: IntentAction) => void;
  isOllamaAvailable: boolean;
  /** Free-form read-only AI chat (file metadata analysis). */
  onFreeformQuery: (message: string) => Promise<string>;
  /** When set, the chat input is pre-filled with this text. */
  prefillQuery?: string | null;
  onPrefillConsumed?: () => void;
}

const FILE_ANALYSIS_PREFIX = '[READ-ONLY METADATA ANALYSIS]';

export function ChatView({
  onParseIntent,
  onExecuteIntent,
  isOllamaAvailable,
  onFreeformQuery,
  prefillQuery,
  onPrefillConsumed,
}: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: "Hi! I'm your local Mac Copilot. You can ask me to:\n• **Scan for junk files** — caches, temp files, build artifacts\n• **Find large files** — anywhere on your disk\n• **Find duplicate AI models** — .gguf, .safetensors files\n• **Analyze any file/folder** — click the 💬 icon on any row in the file tree\n\nI can only read file metadata — I cannot delete, modify, or read file contents.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (prefillQuery) {
      setInput(prefillQuery);
      onPrefillConsumed?.();
      // Focus the input so the user can review and send
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [prefillQuery]);

  const addMessage = useCallback((msg: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: Date.now().toString() + Math.random() }]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || !isOllamaAvailable) return;

    const userPrompt = input.trim();
    setInput('');
    addMessage({ sender: 'user', text: userPrompt });
    setIsProcessing(true);

    const isFileAnalysis = userPrompt.startsWith(FILE_ANALYSIS_PREFIX);

    try {
      if (isFileAnalysis) {
        // ── Free-form mode: file / directory metadata analysis ──────────
        // Uses chat_with_model backend — strictly read-only, no filesystem access.
        const reply = await onFreeformQuery(userPrompt);
        addMessage({ sender: 'ai', text: reply, isAnalysis: true });
        } else {
        // ── Intent routing mode: scan junk / large files / duplicates ───
        const intent = await onParseIntent(userPrompt);

        if (!intent) {
          addMessage({ sender: 'ai', text: "I had trouble understanding that. Could you try asking in a different way?" });
        } else if (!ALLOWED_INTENT_ACTIONS.has(intent.action)) {
          // ── FRONTEND WRITE-PROTECTION BLOCK ───────────────────────────────────
          addMessage({ sender: 'ai', text: "⛔ Blocked: I am read-only and cannot perform write or destructive operations." });
        } else if (intent.action === "unknown") {
          // No scan command detected — ask the model directly for a conversational reply
          const reply = await onFreeformQuery(userPrompt);
          addMessage({ sender: 'ai', text: reply });
        } else if (intent.action === "scan_junk") {
          addMessage({ sender: 'ai', text: "I'll start scanning known junk locations for you right away." });
          onExecuteIntent(intent);
        } else if (intent.action === "scan_model_duplicates") {
          addMessage({ sender: 'ai', text: "Looking for duplicate AI models (.gguf, .safetensors) on your system now." });
          onExecuteIntent(intent);
        } else if (intent.action === "scan_large_files") {
          const pathSuffix = intent.path ? ` in ${intent.path}` : "";
          addMessage({ sender: 'ai', text: `I'll scan for large files${pathSuffix}.` });
          onExecuteIntent(intent);
        } else {
          addMessage({ sender: 'ai', text: "Command recognized, but I don't have an execution path for it yet." });
        }
      }

    } catch (e: unknown) {
      const errStr = String(e);
      // Show a specific message when Ollama can't be reached vs other errors
      const isNetworkErr = errStr.toLowerCase().includes('cannot reach') ||
        errStr.toLowerCase().includes('network') ||
        errStr.toLowerCase().includes('connection');
      addMessage({
        sender: 'ai',
        text: isNetworkErr
          ? 'Cannot reach Ollama. Please make sure Ollama is running (`ollama serve`) and a model is loaded.'
          : `Something went wrong: ${errStr.slice(0, 200)}`,
      });
      console.error('[ChatView] Error:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="chat-view">
      {!isOllamaAvailable && (
        <div className="chat-warning">
          Ollama is not running. Please start Ollama to use the Copilot Chat.
        </div>
      )}

      {/* Read-only badge */}
      <div className="chat-readonly-badge">
        <ShieldAlert size={11} />
        Read-only · Write-protected · No file modifications ever permitted
      </div>

      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.sender}`}>
            <div className="message-avatar">
              {msg.sender === 'ai'
                ? (msg.isAnalysis ? <Zap size={16} /> : <Bot size={18} />)
                : <User size={18} />}
            </div>
            <div className={`message-content ${msg.isAnalysis ? 'analysis-reply' : ''}`}>
              {msg.text.split('\n').map((line, i) => (
                <span key={i}>
                  {line}
                  {i < msg.text.split('\n').length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="chat-message ai processing">
            <div className="message-avatar"><Bot size={18} /></div>
            <div className="message-content">
              <Loader2 className="spin" size={16} /> Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        {input.startsWith(FILE_ANALYSIS_PREFIX) && (
          <div className="chat-analysis-hint">
            <MessageCircle size={11} /> File analysis mode — AI will explain this item based on metadata only
          </div>
        )}
        <div className="chat-input-row">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isOllamaAvailable ? 'Ask me to scan for junk, or click 💬 on any file...' : 'Start Ollama to chat...'}
            disabled={isProcessing || !isOllamaAvailable}
            className="chat-input"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing || !isOllamaAvailable}
            className="chat-send-btn"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
