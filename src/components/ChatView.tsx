import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { IntentAction } from '../types';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
}

interface ChatViewProps {
  onParseIntent: (prompt: string) => Promise<IntentAction | null>;
  onExecuteIntent: (intent: IntentAction) => void;
  isOllamaAvailable: boolean;
}

export function ChatView({ onParseIntent, onExecuteIntent, isOllamaAvailable }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: 'ai',
      text: "Hello! I'm your local Mac Copilot. I can help you clean junk files, find large unused files, or track down duplicate AI models. What would you like to do?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing || !isOllamaAvailable) return;

    const userPrompt = input.trim();
    setInput("");
    
    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: userPrompt };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const intent = await onParseIntent(userPrompt);
      
      let aiResponseText = "";
      
      if (!intent) {
        aiResponseText = "I had trouble understanding that. Could you try asking in a different way?";
      } else if (intent.action === "unknown") {
        aiResponseText = intent.message || "I'm not sure how to help with that. I can scan for junk, find large files, or look for model duplicates.";
      } else if (intent.action === "scan_junk") {
        aiResponseText = "I'll start scanning known junk locations for you right away.";
        onExecuteIntent(intent);
      } else if (intent.action === "scan_model_duplicates") {
        aiResponseText = "Looking for duplicate AI models (.gguf, .safetensors) on your system now.";
        onExecuteIntent(intent);
      } else if (intent.action === "scan_large_files") {
        const pathSuffix = intent.path ? ` in ${intent.path}` : "";
        aiResponseText = `I'll scan for large files${pathSuffix}.`;
        onExecuteIntent(intent);
      } else {
         aiResponseText = "Command recognized, but I don't have an execution path for it yet.";
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiResponseText
      }]);

    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: "Sorry, I encountered an error communicating with the local AI model."
      }]);
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
      
      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.sender}`}>
            <div className="message-avatar">
              {msg.sender === 'ai' ? <Bot size={18} /> : <User size={18} />}
            </div>
            <div className="message-content">
              {msg.text}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="chat-message ai processing">
            <div className="message-avatar"><Bot size={18} /></div>
            <div className="message-content">
              <Loader2 className="spin" size={16} /> Parsing command...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me to clean my Mac..."
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
      </form>
    </div>
  );
}
