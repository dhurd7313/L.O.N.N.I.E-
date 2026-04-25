import { loadWorkerUrl } from "./ai-provider";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatStreamOptions {
  onChunk?: (content: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export interface AiRequestConfig {
  provider: string;
  isCustom: boolean;
  headers: Record<string, string>;
  url: string;
  error?: string;
}

// Import the config getter
import { getAiRequestConfig } from "./ai-provider";

/**
 * Send a chat message and get a streaming response
 * Uses Cloudflare Worker directly, bypassing Supabase Edge Functions
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  options: ChatStreamOptions = {}
): Promise<void> {
  const { onChunk, onComplete, onError, signal } = options;

  const config = getAiRequestConfig();

  // Check for configuration errors
  if (config.error) {
    onError?.(new Error(config.error));
    return;
  }

  if (!config.url) {
    onError?.(new Error("AI service URL not configured. Please set the Cloudflare Worker URL in settings."));
    return;
  }

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      body: JSON.stringify({ messages }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI request failed: ${response.status} - ${errorText}`);
    }

    // Handle SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response stream available");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process SSE events
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          if (data === "[DONE]") {
            onComplete?.();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onChunk?.(content);
            }
          } catch {
            // Ignore parsing errors for non-JSON SSE messages
          }
        }
      }
    }

    onComplete?.();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // User cancelled - not an error
      return;
    }
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Send a non-streaming chat message (simpler for testing)
 */
export async function sendChatMessageSync(
  messages: ChatMessage[]
): Promise<string> {
  let fullResponse = "";

  await sendChatMessage(messages, {
    onChunk: (chunk) => {
      fullResponse += chunk;
    },
  });

  return fullResponse;
}

/**
 * Check if the AI service is configured and reachable
 */
export async function checkAiConnection(): Promise<{
  configured: boolean;
  reachable: boolean;
  error?: string;
}> {
  const workerUrl = loadWorkerUrl();

  if (!workerUrl) {
    return {
      configured: false,
      reachable: false,
      error: "Cloudflare Worker URL not configured",
    };
  }

  try {
    // Send a minimal test request
    const response = await fetch(`${workerUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ai-provider": "ollama",
        "x-ai-key": "http://localhost:11434",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "ping" }],
      }),
    });

    return {
      configured: true,
      reachable: response.ok,
      error: response.ok ? undefined : `Service returned ${response.status}`,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}