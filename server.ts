import express from 'express';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const HOST = '0.0.0.0';
const CONFIG_DIR = path.join(__dirname, 'config');
const OUTPUT_DIR = path.join(__dirname, 'output');
const HELP_DIR = path.join(__dirname, 'help');
const SNIPPETS_DIR = path.join(__dirname, 'snippets');
const DIST_DIR = path.join(__dirname, 'dist');

const HELP_DOC_FILES: Record<string, string> = {
  gui1: 'gui1_help.txt',
  gui2: 'gui2_help.txt',
  overlays: 'component_overlays.txt',
};

function safeSlug(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'tab'
  );
}

async function ensureDirs() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(HELP_DIR, { recursive: true });
  await fs.mkdir(SNIPPETS_DIR, { recursive: true });
}

async function startServer() {
  await ensureDirs();

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'note-tool-json-generator' });
  });

  app.get('/api/configs', async (_req, res) => {
    try {
      await ensureDirs();
      const entries = await fs.readdir(CONFIG_DIR);
      const jsonFiles = entries.filter((name) => name.endsWith('.json')).sort();
      const configs: Record<string, unknown> = {};
      const order: string[] = [];

      for (const fileName of jsonFiles) {
        try {
          const fullPath = path.join(CONFIG_DIR, fileName);
          const raw = await fs.readFile(fullPath, 'utf-8');
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const baseSlug = safeSlug(path.basename(fileName, '.json'));
          const tabId =
            typeof parsed.tab_id === 'string' && parsed.tab_id.trim()
              ? safeSlug(parsed.tab_id)
              : baseSlug;
          configs[tabId] = parsed;
          order.push(tabId);
        } catch (err) {
          console.error(`[server] Failed to parse config/${fileName}:`, err);
        }
      }

      res.json({ configs, order });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put('/api/configs/:tabId', async (req, res) => {
    try {
      await ensureDirs();
      const tabId = safeSlug(req.params.tabId);
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        res.status(400).json({ error: 'Config payload must be a JSON object.' });
        return;
      }
      const filePath = path.join(CONFIG_DIR, `${tabId}.json`);
      await fs.writeFile(filePath, JSON.stringify(body, null, 2) + '\n', 'utf-8');
      res.json({ ok: true, tabId, path: `config/${tabId}.json`, config: body });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/configs', async (req, res) => {
    try {
      await ensureDirs();
      const { tabId: rawTabId, config } = req.body as {
        tabId?: string;
        config?: Record<string, unknown>;
      };
      if (!rawTabId || !config || typeof config !== 'object') {
        res.status(400).json({ error: 'tabId and config object are required.' });
        return;
      }
      const tabId = safeSlug(rawTabId);
      const filePath = path.join(CONFIG_DIR, `${tabId}.json`);
      await fs.writeFile(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      res.json({ ok: true, tabId, path: `config/${tabId}.json`, config });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/outputs', async (_req, res) => {
    try {
      await ensureDirs();
      const historyPath = path.join(OUTPUT_DIR, 'generation_history.jsonl');
      try {
        const raw = await fs.readFile(historyPath, 'utf-8');
        const entries = raw
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line))
          .reverse()
          .slice(0, 100);
        res.json({ entries });
      } catch {
        res.json({ entries: [] });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/outputs', async (req, res) => {
    try {
      await ensureDirs();
      const { fileName, content, historyEntry } = req.body as {
        fileName?: string;
        content?: string;
        historyEntry?: Record<string, unknown>;
      };
      if (!fileName || typeof content !== 'string') {
        res.status(400).json({ error: 'fileName and content are required.' });
        return;
      }
      const cleanName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = path.join(OUTPUT_DIR, cleanName);
      await fs.writeFile(filePath, content, 'utf-8');

      if (historyEntry && typeof historyEntry === 'object') {
        const historyPath = path.join(OUTPUT_DIR, 'generation_history.jsonl');
        await fs.appendFile(historyPath, JSON.stringify(historyEntry) + '\n', 'utf-8');
      }

      res.json({ ok: true, fileName: cleanName, filePath: `output/${cleanName}` });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/save-files', async (req, res) => {
    try {
      const { directory, files } = req.body as {
        directory?: string;
        files?: Array<{ fileName?: string; content?: string }>;
      };

      if (!Array.isArray(files) || files.length === 0) {
        res.status(400).json({ error: 'files array is required.' });
        return;
      }

      const savedRoot = path.join(__dirname, 'saved_projects');
      await fs.mkdir(savedRoot, { recursive: true });

      const rawSegments = String(directory ?? 'workspace')
        .replace(/\\/g, '/')
        .split('/')
        .map((seg) => seg.trim())
        .filter((seg) => seg && seg !== '.' && seg !== '..');

      if (rawSegments[0] === 'saved_projects') {
        rawSegments.shift();
      }

      const safeSegments = rawSegments
        .map((seg) => seg.replace(/[^a-zA-Z0-9._ -]/g, '_').trim())
        .filter(Boolean);

      const relDir = safeSegments.length > 0 ? safeSegments.join('/') : 'workspace';
      const targetDir = path.resolve(savedRoot, ...safeSegments);

      if (targetDir !== savedRoot && !targetDir.startsWith(savedRoot + path.sep)) {
        res.status(400).json({ error: 'Invalid directory path.' });
        return;
      }

      await fs.mkdir(targetDir, { recursive: true });

      const savedFiles: string[] = [];
      for (const item of files) {
        if (!item || typeof item.fileName !== 'string' || typeof item.content !== 'string') {
          continue;
        }
        const cleanFileName =
          path.basename(item.fileName).replace(/[^a-zA-Z0-9._-]/g, '_') || 'untitled.txt';
        const fullFilePath = path.join(targetDir, cleanFileName);
        await fs.writeFile(fullFilePath, item.content, 'utf-8');
        savedFiles.push(`saved_projects/${relDir}/${cleanFileName}`);
      }

      res.json({
        ok: true,
        directory: relDir,
        fullPathLabel: `saved_projects/${relDir}`,
        savedFiles,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/help/:docId', async (req, res) => {
    try {
      await ensureDirs();
      const targetFile = HELP_DOC_FILES[req.params.docId];
      if (!targetFile) {
        res.status(404).json({ error: 'Unknown help document ID.' });
        return;
      }
      const fullPath = path.join(HELP_DIR, targetFile);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        res.json({ ok: true, docId: req.params.docId, fileName: `help/${targetFile}`, content });
      } catch {
        res.status(404).json({ error: `help/${targetFile} not found.` });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put('/api/help/:docId', async (req, res) => {
    try {
      await ensureDirs();
      const targetFile = HELP_DOC_FILES[req.params.docId];
      if (!targetFile) {
        res.status(404).json({ error: 'Unknown help document ID.' });
        return;
      }
      const { content } = req.body as { content?: string };
      if (typeof content !== 'string') {
        res.status(400).json({ error: 'content string is required.' });
        return;
      }
      const fullPath = path.join(HELP_DIR, targetFile);
      await fs.writeFile(fullPath, content, 'utf-8');
      res.json({ ok: true, docId: req.params.docId, fileName: `help/${targetFile}`, content });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/snippets', async (_req, res) => {
    try {
      await ensureDirs();
      const filePath = path.join(SNIPPETS_DIR, 'custom_snippets.json');
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        res.json({ ok: true, snippets: Array.isArray(parsed) ? parsed : [] });
      } catch {
        res.json({ ok: true, snippets: [] });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.put('/api/snippets', async (req, res) => {
    try {
      await ensureDirs();
      const { snippets } = req.body as { snippets?: unknown };
      if (!Array.isArray(snippets)) {
        res.status(400).json({ error: 'snippets array is required.' });
        return;
      }
      const filePath = path.join(SNIPPETS_DIR, 'custom_snippets.json');
      await fs.writeFile(filePath, JSON.stringify(snippets, null, 2) + '\n', 'utf-8');
      res.json({ ok: true, count: snippets.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  const httpServer = http.createServer(app);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_DIR));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`[NoteTool + GUI2 Server] Listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
