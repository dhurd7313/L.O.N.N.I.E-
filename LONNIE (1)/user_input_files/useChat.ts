import { useState, useCallback, useRef, useEffect } from "react";
import { sendChatMessage, ChatMessage, checkAiConnection } from "./ai-client";
import { trackUsage } from "./ai-provider";
import { useAuth } from "./useAuth";

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error?: string;
  isConnected: boolean;
}

export function useChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [isConnected, setIsConnected] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check connection status
  const checkConnection = useCallback(async () => {
    const result = await checkAiConnection();
    setIsConnected(result.reachable);
    return result;
  }, []);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    // Add user message
    const userMessage: ChatMessage = { role: "user", content };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(undefined);

    // Track usage
    trackUsage();

    // Add assistant message placeholder
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      await sendChatMessage([...messages, userMessage], {
        onChunk: (chunk) => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
          });
        },
        onComplete: () => {
          setIsLoading(false);
          checkConnection(); // Verify still connected
        },
        onError: (err) => {
          setError(err.message);
          setIsLoading(false);
          // Remove the empty assistant message on error
          setMessages(prev => prev.slice(0, -1));
        },
        signal: abortControllerRef.current.signal,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setIsLoading(false);
      setMessages(prev => prev.slice(0, -1));
    }
  }, [messages, checkConnection]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(undefined);
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    isConnected,
    sendMessage,
    clearMessages,
    stopGeneration,
    checkConnection,
  };
}