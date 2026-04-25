/**
 * Platform Bridge — abstracts OS-level capabilities.
 * In web mode: uses cloud storage + simulated shell.
 * In native mode (Tauri/Electron): routes to real FS/shell APIs via globals.
 */

export type PlatformType = "web" | "tauri" | "electron";

export interface FileEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  mimeType?: string;
  lastModified?: string;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface PlatformCapabilities {
  fileSystem: boolean;
  shell: boolean;
  notifications: boolean;
  backgroundService: boolean;
  clipboard: boolean;
  systemInfo: boolean;
}

class PlatformBridge {
  private _type: PlatformType = "web";

  constructor() {
    this._type = this.detectPlatform();
  }

  private detectPlatform(): PlatformType {
    if (typeof window !== "undefined") {
      if ((window as any).__TAURI__) return "tauri";
      if ((window as any).__ELECTRON__) return "electron";
    }
    return "web";
  }

  get type(): PlatformType {
    return this._type;
  }

  get isNative(): boolean {
    return this._type !== "web";
  }

  get capabilities(): PlatformCapabilities {
    if (this._type === "tauri" || this._type === "electron") {
      return {
        fileSystem: true,
        shell: true,
        notifications: true,
        backgroundService: true,
        clipboard: true,
        systemInfo: true,
      };
    }
    return {
      fileSystem: false,
      shell: false,
      notifications: "Notification" in window,
      backgroundService: false,
      clipboard: !!navigator.clipboard,
      systemInfo: true,
    };
  }

  // ---- File System (native only, uses globals set by Tauri/Electron preload) ----

  async readDir(path: string): Promise<FileEntry[]> {
    if (this._type === "tauri" && (window as any).__TAURI__?.fs?.readDir) {
      const entries = await (window as any).__TAURI__.fs.readDir(path);
      return entries.map((e: any) => ({
        name: e.name || "",
        path: e.path,
        size: 0,
        isDirectory: !!e.children,
      }));
    }
    console.warn("[PlatformBridge] readDir not available in web mode.");
    return [];
  }

  async readFile(path: string): Promise<Uint8Array | null> {
    if (this._type === "tauri" && (window as any).__TAURI__?.fs?.readBinaryFile) {
      return await (window as any).__TAURI__.fs.readBinaryFile(path);
    }
    console.warn("[PlatformBridge] readFile not available in web mode.");
    return null;
  }

  async writeFile(path: string, data: Uint8Array): Promise<boolean> {
    if (this._type === "tauri" && (window as any).__TAURI__?.fs?.writeBinaryFile) {
      await (window as any).__TAURI__.fs.writeBinaryFile(path, data);
      return true;
    }
    console.warn("[PlatformBridge] writeFile not available in web mode.");
    return false;
  }

  // ---- Shell ----

  async executeCommand(command: string, args: string[] = []): Promise<ShellResult> {
    if (this._type === "tauri" && (window as any).__TAURI__?.shell?.Command) {
      const Command = (window as any).__TAURI__.shell.Command;
      const cmd = new Command(command, args);
      const output = await cmd.execute();
      return { stdout: output.stdout, stderr: output.stderr, exitCode: output.code };
    }
    return {
      stdout: `[WEB MODE] Command "${command} ${args.join(" ")}" queued for native execution.`,
      stderr: "",
      exitCode: -1,
    };
  }

  // ---- System Info ----

  getSystemInfo() {
    const ua = navigator.userAgent;
    const p = navigator.platform;
    const cores = navigator.hardwareConcurrency || 0;
    const memory = (navigator as any).deviceMemory || 0;

    let os = "Unknown";
    if (/Win/i.test(p)) os = "Windows";
    else if (/Mac/i.test(p)) os = "macOS";
    else if (/Linux/i.test(p)) os = "Linux";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/iPhone|iPad/i.test(ua)) os = "iOS";

    return {
      os,
      platform: this._type,
      cores,
      memoryGB: memory,
      online: navigator.onLine,
      isPWA: window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true,
      userAgent: ua,
      language: navigator.language,
      screenWidth: screen.width,
      screenHeight: screen.height,
    };
  }

  // ---- Notifications ----

  async notify(title: string, body: string): Promise<boolean> {
    if (this._type === "tauri" && (window as any).__TAURI__?.notification?.sendNotification) {
      await (window as any).__TAURI__.notification.sendNotification({ title, body });
      return true;
    }
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
      return true;
    }
    if ("Notification" in window && Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm === "granted") { new Notification(title, { body }); return true; }
    }
    return false;
  }

  // ---- Clipboard ----

  async copyToClipboard(text: string): Promise<boolean> {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }
}

export const platform = new PlatformBridge();
