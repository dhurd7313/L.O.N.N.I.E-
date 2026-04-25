export type ProviderId = "lovable" | "openai" | "anthropic" | "google" | "ollama";

export interface AISettings {
  activeProvider: ProviderId;
  keys: Record<string, string>;
}

export interface UsageData {
  requestCount: number;
  lastReset: string;
  dailyCounts: Record<string, number>;
}

export interface AiRequestConfig {
  provider: ProviderId;
  isCustom: boolean;
  headers: Record<string, string>;
  url: string;
  error?: string;
}

const STORAGE_KEY = "lonnie_ai_settings";
const USAGE_KEY = "lonnie_ai_usage";
const OLLAMA_STORAGE_KEY = "lonnie_ollama_url";
const WORKER_URL_STORAGE_KEY = "lonnie_worker_url";

// ✅ DYNAMIC: Load Cloudflare Worker URL from localStorage (no hardcoding!)
// This allows changing the URL without code updates
export function loadWorkerUrl(): string {
  try {
    return localStorage.getItem(WORKER_URL_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveWorkerUrl(url: string) {
  localStorage.setItem(WORKER_URL_STORAGE_KEY, url.trim());
}

export function loadOllamaUrl(): string {
  try {
    return localStorage.getItem(OLLAMA_STORAGE_KEY) || "http://localhost:11434";
  } catch {
    return "http://localhost:11434";
  }
}

export function saveOllamaUrl(url: string) {
  localStorage.setItem(OLLAMA_STORAGE_KEY, url.trim());
}

const VALID_PROVIDERS: ProviderId[] = ["lovable", "openai", "anthropic", "google", "ollama"];

function sanitizeProvider(value: unknown): ProviderId {
  return VALID_PROVIDERS.includes(value as ProviderId) ? (value as ProviderId) : "lovable";
}

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { activeProvider: "lovable", keys: {} };
    const parsed = JSON.parse(raw);
    return {
      activeProvider: sanitizeProvider(parsed?.activeProvider),
      keys: typeof parsed?.keys === "object" && parsed?.keys ? parsed.keys : {},
    };
  } catch {
    return { activeProvider: "lovable", keys: {} };
  }
}

export function saveAISettings(settings: AISettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function loadUsage(): UsageData {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { requestCount: 0, lastReset: new Date().toISOString().slice(0, 7), dailyCounts: {} };
}

function saveUsage(usage: UsageData) {
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
}

export function getActiveProvider(): ProviderId {
  return loadAISettings().activeProvider;
}

export function getCustomApiKey(provider = getActiveProvider()): string | null {
  if (provider === "lovable") return null;
  if (provider === "ollama") return "ollama"; // Ollama doesn't need a real key
  const key = loadAISettings().keys[provider];
  return key?.trim() || null;
}

export function notifyProviderChanged(provider: ProviderId) {
  window.dispatchEvent(new CustomEvent("lonnie-provider-changed", { detail: provider }));
}

export function setStoredActiveProvider(provider: ProviderId) {
  const next = { ...loadAISettings(), activeProvider: provider };
  saveAISettings(next);
  notifyProviderChanged(provider);
  return next;
}

export function saveProviderKey(provider: Exclude<ProviderId, "lovable">, key: string) {
  const next = {
    ...loadAISettings(),
    keys: {
      ...loadAISettings().keys,
      [provider]: key.trim(),
    },
  };
  saveAISettings(next);
  return next;
}

export function deleteProviderKey(provider: Exclude<ProviderId, "lovable">) {
  const current = loadAISettings();
  const nextKeys = { ...current.keys };
  delete nextKeys[provider];

  const next: AISettings = {
    ...current,
    keys: nextKeys,
    activeProvider: current.activeProvider === provider ? "lovable" : current.activeProvider,
  };

  saveAISettings(next);
  if (next.activeProvider !== current.activeProvider) {
    notifyProviderChanged(next.activeProvider);
  }
  return next;
}

export function trackUsage() {
  const usage = loadUsage();
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (usage.lastReset !== currentMonth) {
    usage.requestCount = 0;
    usage.dailyCounts = {};
    usage.lastReset = currentMonth;
  }
  usage.requestCount++;
  const today = new Date().toISOString().slice(0, 10);
  usage.dailyCounts[today] = (usage.dailyCounts[today] || 0) + 1;
  saveUsage(usage);
}

// ✅ DYNAMIC: Get Worker URL from localStorage (no hardcoded URLs!)
function getWorkerBaseUrl(): string {
  const storedUrl = loadWorkerUrl();
  if (storedUrl) {
    return storedUrl.replace(/\/+$/, ""); // Remove trailing slashes
  }
  // Fallback to env var if nothing in localStorage (for initial setup)
  return (import.meta.env.VITE_CLOUDFLARE_WORKER_URL || "").replace(/\/+$/, "");
}

export function getAiRequestConfig(): AiRequestConfig {
  const provider = getActiveProvider();
  const customKey = getCustomApiKey(provider);
  const isCustom = provider !== "lovable" && !!customKey;

  // ✅ FIXED: Removed Authorization header - Cloudflare Worker doesn't need Supabase auth
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Get dynamic Worker URL from localStorage
  const workerUrl = getWorkerBaseUrl();

  // Check if Worker URL is configured
  if (!workerUrl) {
    return {
      provider,
      isCustom: false,
      headers,
      url: "",
      error: "Cloudflare Worker URL not configured. Please set it in settings.",
    };
  }

  const chatUrl = `${workerUrl}/chat`;

  // Ollama uses its own tunnel URL
  if (provider === "ollama") {
    const ollamaUrl = loadOllamaUrl();
    headers["x-ai-provider"] = "ollama";
    headers["x-ai-key"] = ollamaUrl;
    return {
      provider,
      isCustom: true,
      headers,
      url: chatUrl,
    };
  }

  if (provider !== "lovable" && !customKey) {
    return {
      provider,
      isCustom: false,
      headers,
      url: chatUrl,
      error: `No API key saved for ${provider}. Save a key and try again.`,
    };
  }

  if (isCustom && customKey) {
    headers["x-ai-provider"] = provider;
    headers["x-ai-key"] = customKey;
  }

  return {
    provider,
    isCustom,
    headers,
    url: chatUrl,
  };
}
