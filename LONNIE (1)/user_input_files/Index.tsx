import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBiometric } from "@/hooks/useBiometric";
import { loadWorkerUrl, saveWorkerUrl, loadOllamaUrl } from "./ai-provider";
import { sendChatMessage, ChatMessage } from "./ai-client";

interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

// Simple particle background
const ParticleField = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {Array.from({ length: 30 }).map((_, i) => (
      <div
        key={i}
        className="absolute w-1 h-1 bg-primary/20 rounded-full animate-pulse"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 3}s`,
          animationDuration: `${2 + Math.random() * 3}s`,
        }}
      />
    ))}
  </div>
);

// Status bar
const StatusBar = ({ isConnected }: { isConnected: boolean }) => (
  <div className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm border-b border-border/30">
    <div className="container mx-auto px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
        <span className="font-mono text-xs text-primary tracking-widest">
          {isConnected ? "LONNIE ONLINE" : "CONNECTING..."}
        </span>
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        {new Date().toLocaleTimeString()}
      </div>
    </div>
  </div>
);

// Worker URL configuration modal
const WorkerUrlModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [url, setUrl] = useState(loadWorkerUrl());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveWorkerUrl(url);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
      window.location.reload();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-display mb-4 text-primary">Configure AI Worker URL</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your Cloudflare Worker URL. This can be changed anytime without code updates.
        </p>
        <div className="space-y-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-worker.workers.dev"
            className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSave}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            {saved ? "Saved!" : "Save & Connect"}
          </button>
          <button onClick={onClose} className="w-full px-4 py-2 border border-border rounded-lg hover:bg-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Ollama configuration modal
const OllamaModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [url, setUrl] = useState(loadOllamaUrl());

  const handleSave = () => {
    localStorage.setItem("lonnie_ollama_url", url.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-display mb-4 text-primary">Configure Ollama</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your Ollama server URL (local or cloudflare tunnel).
        </p>
        <div className="space-y-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="w-full px-4 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSave}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
          <button onClick={onClose} className="w-full px-4 py-2 border border-border rounded-lg hover:bg-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const bio = useBiometric(user?.id ?? null);
  const [bioPassed, setBioPassed] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [isConnected, setIsConnected] = useState(false);

  // Modal states
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [showOllamaModal, setShowOllamaModal] = useState(false);

  // Scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Auto-pass biometric
  useEffect(() => {
    if (user && bio.verified) setBioPassed(true);
    if (user && !bio.enrolled && !bio.supported) setBioPassed(true);
  }, [user, bio.verified, bio.enrolled, bio.supported]);

  // Check connection on mount
  useEffect(() => {
    if (user) {
      const workerUrl = loadWorkerUrl();
      if (!workerUrl) {
        setShowWorkerModal(true);
      } else {
        setIsConnected(true);
      }
    }
  }, [user]);

  // Handle biometric verification
  const handleVerify = async () => {
    const success = await bio.verify({
      onVerifySuccess: () => setBioPassed(true),
      onError: (err) => setError(err),
    });
    if (success) setBioPassed(true);
  };

  // Send message
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessageItem = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(undefined);

    try {
      const chatMessages: ChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      chatMessages.push({ role: "user", content: input.trim() });

      await sendChatMessage(chatMessages, {
        onChunk: (chunk) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last.role === "user") {
              return [...prev, { id: Date.now().toString(), role: "assistant", content: chunk, timestamp: new Date() }];
            }
            return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
          });
        },
        onComplete: () => setIsLoading(false),
        onError: (err) => {
          setError(err.message);
          setIsLoading(false);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setIsLoading(false);
    }
  };

  const clearChat = () => setMessages([]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-mono text-xs text-primary tracking-widest">INITIALIZING LONNIE...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Biometric gate
  if (bio.enrolled && !bioPassed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-display text-primary mb-4">Biometric Verification</h2>
          <button onClick={handleVerify} className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            Verify Identity
          </button>
          {bio.error && <p className="text-red-500 mt-2">{bio.error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <ParticleField />
      <StatusBar isConnected={isConnected} />

      {/* Settings buttons */}
      <div className="fixed top-16 right-4 z-40 flex flex-col gap-2">
        <button
          onClick={() => setShowWorkerModal(true)}
          className="px-3 py-2 bg-secondary border border-border rounded-lg text-xs hover:bg-secondary/80"
        >
          Worker URL
        </button>
        <button
          onClick={() => setShowOllamaModal(true)}
          className="px-3 py-2 bg-secondary border border-border rounded-lg text-xs hover:bg-secondary/80"
        >
          Ollama URL
        </button>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 pt-20 pb-32 relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display text-primary mb-4">LONNIE AI SYSTEM</h1>
          <p className="text-muted-foreground">Autonomous Goal-Driven AI Companion</p>
        </div>

        {/* Chat container */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-card/50 backdrop-blur border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-mono text-sm text-primary">TERMINAL CHAT</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-xs text-muted-foreground">{isConnected ? "Connected" : "Disconnected"}</span>
                <button onClick={clearChat} className="px-2 py-1 text-xs border border-border rounded hover:bg-secondary">
                  Clear
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="h-96 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <p className="font-mono text-sm">No messages yet. Start a conversation.</p>
                  <p className="text-xs mt-2">Configure Worker URL and Ollama in settings.</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-4`}>
                  <div className={`max-w-[80%] px-4 py-2 rounded-lg ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary border border-border"}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                </div>
              )}
              {error && (
                <div className="text-red-500 text-sm p-2 bg-red-500/10 rounded">{error}</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isLoading ? "..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-4xl mx-auto">
          <div className="bg-card/50 border border-border rounded-lg p-4">
            <h3 className="font-display text-sm text-primary mb-2">Fast Connection</h3>
            <p className="text-xs text-muted-foreground">Direct Worker connection bypasses Supabase for faster responses.</p>
          </div>
          <div className="bg-card/50 border border-border rounded-lg p-4">
            <h3 className="font-display text-sm text-primary mb-2">Flexible URL</h3>
            <p className="text-xs text-muted-foreground">Change Worker URL anytime. Stored in localStorage.</p>
          </div>
          <div className="bg-card/50 border border-border rounded-lg p-4">
            <h3 className="font-display text-sm text-primary mb-2">Ollama Support</h3>
            <p className="text-xs text-muted-foreground">Connect to local or cloud Ollama instances.</p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <WorkerUrlModal isOpen={showWorkerModal} onClose={() => setShowWorkerModal(false)} />
      <OllamaModal isOpen={showOllamaModal} onClose={() => setShowOllamaModal(false)} />

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-border/30 py-4 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 text-center">
          <p className="font-mono text-xs text-muted-foreground">LONNIE AI SYSTEM © 2026 — ALL SYSTEMS NOMINAL</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
