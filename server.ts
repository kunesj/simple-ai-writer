import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.join(__dirname, "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const CONVERSATIONS_DIR = path.join(DATA_DIR, "conversations");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o755 });
    await fs.mkdir(CONVERSATIONS_DIR, { recursive: true, mode: 0o755 });
    await fs.mkdir(UPLOADS_DIR, { recursive: true, mode: 0o755 });
  } catch (e) {
    // Ignore
  }
}

async function safeWriteFile(filePath: string, data: string) {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, data, "utf-8");
  await fs.rename(tempPath, filePath);
}

const pendingWrites = new Map<string, Promise<void>>();
const inProgressData = new Map<string, string>();

async function safeWriteFileWithDedupe(filePath: string, data: string): Promise<void> {
  const existingData = inProgressData.get(filePath);
  if (existingData === data) {
    return;
  }
  
  if (pendingWrites.has(filePath)) {
    await pendingWrites.get(filePath);
    if (inProgressData.get(filePath) === data) {
      return;
    }
  }
  
  const writePromise = (async () => {
    inProgressData.set(filePath, data);
    try {
      await safeWriteFile(filePath, data);
      lastWriteTime.set(filePath, Date.now());
    } finally {
      pendingWrites.delete(filePath);
    }
  })();
  
  pendingWrites.set(filePath, writePromise);
  await writePromise;
}

const lastWriteTime = new Map<string, number>();
const WATCHER_IGNORE_WINDOW_MS = 200;

function isRecentWrite(filePath: string): boolean {
  const lastWrite = lastWriteTime.get(filePath);
  return lastWrite !== undefined && (Date.now() - lastWrite) < WATCHER_IGNORE_WINDOW_MS;
}

async function startServer() {
  await ensureDataDir();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  });
  const upload = multer({ storage: storage });

  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({
      id: req.file.filename,
      url: `/api/uploads/${req.file.filename}`,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size
    });
  });

  app.use("/api/uploads", express.static(UPLOADS_DIR));

  // API routes
  app.get("/api/settings", async (req, res) => {
    try {
      const data = await fs.readFile(SETTINGS_FILE, "utf-8");
      res.json(JSON.parse(data));
    } catch (e: any) {
      if (e.code === "ENOENT") {
        res.json(null);
      } else {
        res.status(500).json({ error: "Failed to read settings" });
      }
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const data = JSON.stringify(req.body, null, 2);
      await safeWriteFileWithDedupe(SETTINGS_FILE, data);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  app.get("/api/conversations", async (req, res) => {
    try {
      const files = await fs.readdir(CONVERSATIONS_DIR);
      const conversations = await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(async file => {
            const data = await fs.readFile(path.join(CONVERSATIONS_DIR, file), "utf-8");
            return JSON.parse(data);
          })
      );
      res.json(conversations);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to read conversations" });
    }
  });

  app.post("/api/conversations/:id", async (req, res) => {
    try {
      const filePath = path.join(CONVERSATIONS_DIR, `${req.params.id}.json`);
      const data = JSON.stringify(req.body, null, 2);
      await safeWriteFileWithDedupe(filePath, data);
      res.json({ success: true });
    } catch (e: any) {
      console.error("Failed to save conversation:", e);
      res.status(500).json({ error: "Failed to save conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      const filePath = path.join(CONVERSATIONS_DIR, `${req.params.id}.json`);
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        res.status(404).json({ error: "Conversation not found" });
      } else {
        res.status(500).json({ error: "Failed to delete conversation" });
      }
    }
  });

  // SSE endpoint for file changes
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const ac = new AbortController();

    const watchDir = async () => {
      let settingsTimeout: NodeJS.Timeout | null = null;
      let convsTimeout: NodeJS.Timeout | null = null;
      
      try {
        const watcher = fs.watch(DATA_DIR, { recursive: true, signal: ac.signal });
        for await (const event of watcher) {
          if (isRecentWrite(path.join(DATA_DIR, event.filename || ''))) {
            continue;
          }
          
          if (event.filename === 'settings.json') {
            if (settingsTimeout) clearTimeout(settingsTimeout);
            settingsTimeout = setTimeout(() => {
              sendEvent('settings_changed', { changed: true });
            }, 100);
          } else if (event.filename && event.filename.startsWith('conversations/')) {
            if (convsTimeout) clearTimeout(convsTimeout);
            convsTimeout = setTimeout(() => {
              sendEvent('conversations_changed', { changed: true });
            }, 100);
          }
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error(`Error watching ${DATA_DIR}:`, e);
        }
      }
    };

    // We need to ensure files exist before watching
    Promise.all([
      fs.access(SETTINGS_FILE).catch(() => fs.writeFile(SETTINGS_FILE, "null")),
    ]).then(() => {
      watchDir();
    });

    req.on("close", () => {
      ac.abort();
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
