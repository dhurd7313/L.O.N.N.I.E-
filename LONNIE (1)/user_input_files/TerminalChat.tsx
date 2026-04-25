import { useState, useEffect, useRef } from "react";
import { sendChatMessage, ChatMessage } from "../ai-client";
import { loadWorkerUrl } from "../ai-provider";

interface TerminalChatProps {
  className?: string;
}

const TerminalChat = ({ className = "" }: TerminalChatProps) => {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const workerUrl = loadWorkerUrl();
    setConnected(!!workerUrl);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(undefined);

    try {
      const chatMessages: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: input.trim() },
      ];

      await sendChatMessage(chatMessages, {
        onChunk: (chunk) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last.role === "user") {
              return [...prev, { role: "assistant", content: chunk }];
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

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="font-mono text-sm text-primary">TERMINAL CHAT</span>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-muted-foreground">{connected ? "Connected" : "No Worker URL"}</span>
        </div>
      </div>

      <div className="h-64 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-4">
            <p className="font-mono text-sm">No messages. Configure Worker URL to start.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`mb-2 ${msg.role === "user" ? "text-right" : "text-left"}`}>
            <span className={`inline-block px-3 py-1 rounded-lg text-sm ${
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}>
              {msg.content}
            </span>
          </div>
        ))}
        {isLoading && <div className="text-muted-foreground text-sm">Thinking...</div>}
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type message..."
          className="flex-1 px-3 py-1.5 bg-input border border-border rounded text-sm"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default TerminalChat;
