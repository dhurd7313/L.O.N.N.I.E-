import { useState, useEffect } from "react";
import { loadWorkerUrl, saveWorkerUrl } from "./ai-provider";

interface WorkerUrlSettingsProps {
  onClose?: () => void;
}

export function WorkerUrlSettings({ onClose }: WorkerUrlSettingsProps) {
  const [url, setUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUrl(loadWorkerUrl());
  }, []);

  const handleSave = () => {
    saveWorkerUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    saveWorkerUrl("");
    setUrl("");
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-display text-glow mb-4">
          Configure AI Worker URL
        </h2>

        <p className="text-muted-foreground text-sm mb-4">
          Enter your Cloudflare Worker URL. This can be changed anytime.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Cloudflare Worker URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-worker.workers.dev"
              className="w-full px-4 py-2 bg-input border border-border rounded-lg
                         text-foreground placeholder:text-muted-foreground
                         focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground
                         rounded-lg hover:bg-primary/90 transition-colors"
            >
              {saved ? "Saved!" : "Save"}
            </button>

            <button
              onClick={handleClear}
              className="px-4 py-2 bg-secondary text-secondary-foreground
                         rounded-lg hover:bg-secondary/80 transition-colors"
            >
              Clear
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-lg
                           hover:bg-secondary transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {url && (
          <p className="text-xs text-muted-foreground mt-4">
            Current URL: {url}
          </p>
        )}
      </div>
    </div>
  );
}
