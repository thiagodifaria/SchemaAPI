import type { BrowserWindow as BrowserWindowType, OpenDialogOptions } from 'electron';
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron') as typeof import('electron');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindowType | null = null;
const managedProcesses: ChildProcess[] = [];
let desktopPgCtlPath: string | null = null;
let desktopPgDataDir: string | null = null;
const API_BASE_URLS = Array.from(
  new Set(
    [process.env.SCHEMA_API_URL, 'http://127.0.0.1:8081', 'http://localhost:8081'].filter(
      (value): value is string => Boolean(value),
    ),
  ),
);
let activeApiBaseUrl = API_BASE_URLS[0];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.xml') return 'application/xml';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.txt') return 'text/plain';
  return 'application/octet-stream';
}

function executableName(name: string) {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

function backendResourcePath(...parts: string[]) {
  const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../');
  return path.join(base, 'backend', ...parts);
}

function ensureDir(dir: string) {
  fsSync.mkdirSync(dir, { recursive: true });
}

function spawnManaged(name: string, command: string, args: string[], env: NodeJS.ProcessEnv, cwd?: string) {
  if (!fsSync.existsSync(command)) {
    console.warn(`[desktop-runtime] ${name} not found at ${command}`);
    return null;
  }

  const child = spawn(command, args, {
    cwd: cwd ?? path.dirname(command),
    env,
    stdio: 'ignore',
    windowsHide: true,
  });
  managedProcesses.push(child);
  child.on('exit', (code) => {
    console.warn(`[desktop-runtime] ${name} exited with code ${code}`);
  });
  return child;
}

async function waitForHealth(url: string, timeoutMs = 90_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // Process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv, cwd?: string) {
  if (!fsSync.existsSync(command)) {
    return { code: -1 };
  }
  return new Promise<{ code: number | null }>((resolve) => {
    const child = spawn(command, args, {
      cwd: cwd ?? path.dirname(command),
      env,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('exit', (code) => resolve({ code }));
    child.on('error', () => resolve({ code: -1 }));
  });
}

async function waitForPostgres(pgIsReady: string, env: NodeJS.ProcessEnv, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await runCommand(pgIsReady, ['-h', '127.0.0.1', '-p', '55432', '-U', 'admin'], env);
    if (result.code === 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

async function applyDesktopMigrations(postgresBin: string, env: NodeJS.ProcessEnv, userData: string) {
  const psql = path.join(postgresBin, executableName('psql'));
  const createdb = path.join(postgresBin, executableName('createdb'));
  const migrationsDir = backendResourcePath('migrations');
  const marker = path.join(userData, 'migrations-applied-v0.1.0');

  await runCommand(createdb, ['-h', '127.0.0.1', '-p', '55432', '-U', 'admin', 'schema_api_db'], env);
  if (fsSync.existsSync(marker) || !fsSync.existsSync(migrationsDir)) {
    return;
  }

  const migrationFiles = fsSync
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const result = await runCommand(
      psql,
      ['-h', '127.0.0.1', '-p', '55432', '-U', 'admin', '-d', 'schema_api_db', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migrationsDir, file)],
      env,
      migrationsDir,
    );
    if (result.code !== 0) {
      throw new Error(`Failed to apply migration ${file}`);
    }
  }

  fsSync.writeFileSync(marker, new Date().toISOString(), 'utf8');
}

async function startDesktopBackend() {
  if (!app.isPackaged || process.env.SCHEMA_DESKTOP_BACKEND === 'external') {
    return;
  }

  const backendDir = backendResourcePath();
  if (!fsSync.existsSync(backendDir)) {
    console.warn(`[desktop-runtime] backend bundle not found at ${backendDir}`);
    return;
  }

  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'data');
  const pgDataDir = path.join(dataDir, 'postgres');
  const logsDir = path.join(userData, 'logs');
  ensureDir(dataDir);
  ensureDir(pgDataDir);
  ensureDir(logsDir);

  const postgresBin = backendResourcePath('postgres', 'bin');
  const initDb = path.join(postgresBin, executableName('initdb'));
  const pgCtl = path.join(postgresBin, executableName('pg_ctl'));
  const pgIsReady = path.join(postgresBin, executableName('pg_isready'));
  const rustCore = backendResourcePath(executableName('rust-core'));
  const pythonApi = backendResourcePath(executableName('python-api'));
  const pythonWorker = backendResourcePath(executableName('python-worker'));
  desktopPgCtlPath = pgCtl;
  desktopPgDataDir = pgDataDir;

  const databaseUrl = 'postgres://admin:password123@127.0.0.1:55432/schema_api_db';
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    POSTGRES_USER: 'admin',
    POSTGRES_PASSWORD: 'password123',
    POSTGRES_DB: 'schema_api_db',
    DB_HOST: '127.0.0.1',
    DB_PORT: '55432',
    DATABASE__URL: databaseUrl,
    API__HOST: '127.0.0.1',
    API__PORT: '8081',
    SCHEMA_RUNTIME: 'desktop',
    WORKER_QUEUE_BACKEND: 'postgres',
    PYTHON_API_URL: 'http://127.0.0.1:8001',
    SCHEMA_PYTHON_API_URL: 'http://127.0.0.1:8001',
  };

  if (fsSync.existsSync(initDb) && fsSync.existsSync(pgCtl) && !fsSync.existsSync(path.join(pgDataDir, 'PG_VERSION'))) {
    await new Promise<void>((resolve) => {
      const init = spawn(initDb, ['-D', pgDataDir, '-U', 'admin', '--encoding=UTF8', '--locale=C'], {
        env: baseEnv,
        stdio: 'ignore',
        windowsHide: true,
      });
      init.on('exit', () => resolve());
      init.on('error', () => resolve());
    });
  }

  await runCommand(pgCtl, ['-D', pgDataDir, '-o', '-p 55432', '-l', path.join(logsDir, 'postgres.log'), 'start'], baseEnv, postgresBin);
  await waitForPostgres(pgIsReady, baseEnv);
  await applyDesktopMigrations(postgresBin, baseEnv, userData);

  spawnManaged('python-api', pythonApi, [], baseEnv, backendDir);
  spawnManaged('python-worker', pythonWorker, [], baseEnv, backendDir);
  spawnManaged('rust-core', rustCore, [], baseEnv, backendDir);

  await waitForHealth('http://127.0.0.1:8081/health', 120_000);
}

function stopDesktopBackend() {
  for (const child of managedProcesses.reverse()) {
    if (!child.killed) {
      child.kill();
    }
  }
  if (desktopPgCtlPath && desktopPgDataDir) {
    spawn(desktopPgCtlPath, ['-D', desktopPgDataDir, 'stop', '-m', 'fast'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  }
}

async function apiFetch(pathname: string, init?: RequestInit) {
  const candidates = [activeApiBaseUrl, ...API_BASE_URLS.filter((baseUrl) => baseUrl !== activeApiBaseUrl)];
  const failures: string[] = [];

  for (const baseUrl of candidates) {
    try {
      const response = await fetch(`${baseUrl}${pathname}`, init);
      const text = await response.text();
      activeApiBaseUrl = baseUrl;
      return { response, text, baseUrl };
    } catch (error) {
      failures.push(`${baseUrl}: ${errorMessage(error)}`);
    }
  }

  throw new Error(`API indisponivel. Tentativas: ${failures.join(' | ')}`);
}

async function apiJson(pathname: string, init?: RequestInit) {
  const { response, text } = await apiFetch(pathname, init);
  if (!response.ok) {
    throw new Error(text || `HTTP ${response.status} ${response.statusText}`);
  }
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function apiBinary(pathname: string, init?: RequestInit) {
  const candidates = [activeApiBaseUrl, ...API_BASE_URLS.filter((baseUrl) => baseUrl !== activeApiBaseUrl)];
  const failures: string[] = [];

  for (const baseUrl of candidates) {
    try {
      const response = await fetch(`${baseUrl}${pathname}`, init);
      const buffer = Buffer.from(await response.arrayBuffer());
      activeApiBaseUrl = baseUrl;
      if (!response.ok) {
        throw new Error(buffer.toString('utf8') || `HTTP ${response.status} ${response.statusText}`);
      }
      return { response, buffer };
    } catch (error) {
      failures.push(`${baseUrl}: ${errorMessage(error)}`);
    }
  }

  throw new Error(`API indisponivel. Tentativas: ${failures.join(' | ')}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: 'Schema API',
    backgroundColor: '#f6f7f9',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  await startDesktopBackend();

  ipcMain.handle('dialog:select-document', async () => {
    const options: OpenDialogOptions = {
      title: 'Selecionar documento',
      properties: ['openFile'],
      filters: [
        { name: 'Documentos', extensions: ['pdf', 'docx', 'xml', 'png', 'jpg', 'jpeg', 'txt'] },
        { name: 'Todos os arquivos', extensions: ['*'] },
      ],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    return {
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
    };
  });

  ipcMain.handle('app:platform', () => process.platform);
  ipcMain.handle('api:health', async () => {
    try {
      const value = await apiJson('/health');
      return { ok: true, baseUrl: activeApiBaseUrl, value };
    } catch (error) {
      return { ok: false, baseUrl: activeApiBaseUrl, error: errorMessage(error) };
    }
  });
  ipcMain.handle('api:document', (_event, id: string) => apiJson(`/documents/${id}`));
  ipcMain.handle('api:graph', (_event, id: string) => apiJson(`/documents/${id}/graph`));
  ipcMain.handle('api:auto-contexts', () => apiJson('/contexts/auto'));
  ipcMain.handle('api:search-hybrid', (_event, query: string) =>
    apiJson('/search/hybrid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 8 }),
    }),
  );
  ipcMain.handle('api:rag-query', (_event, query: string) =>
    apiJson('/rag/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 8 }),
    }),
  );
  ipcMain.handle('api:pii-redact', (_event, text: string) =>
    apiJson('/governance/pii/redact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  );
  ipcMain.handle('api:audit', () => apiJson('/governance/audit?limit=20'));
  ipcMain.handle('api:evaluate-rag', () => apiJson('/observability/rag/evaluate', { method: 'POST' }));
  ipcMain.handle('api:latest-rag-eval', () => apiJson('/observability/rag/latest'));
  ipcMain.handle('api:rag-eval-history', () => apiJson('/observability/rag/history?limit=25'));
  ipcMain.handle('api:analysis-create', (_event, payload: unknown) =>
    apiJson('/analysis/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
  ipcMain.handle('api:analysis-reports', (_event, limit = 25) => apiJson(`/analysis/reports?limit=${limit}`));
  ipcMain.handle('api:analysis-export', async (_event, id: string, format: 'md' | 'doc' | 'pdf') => {
    const { response, buffer } = await apiBinary(`/analysis/reports/${id}/export?format=${format}`);
    const extension = format === 'pdf' ? 'pdf' : format === 'doc' ? 'doc' : 'md';
    return {
      fileName: `schema-api-analise-${id}.${extension}`,
      mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
      contentBase64: buffer.toString('base64'),
    };
  });
  ipcMain.handle('api:agent-tools', () => apiJson('/agents/tools'));
  ipcMain.handle('api:create-agent-run', (_event, payload: { goal: string; requested_tool?: string }) =>
    apiJson('/agents/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );
  ipcMain.handle('api:approve-agent-run', (_event, id: string, approvedBy: string) =>
    apiJson(`/agents/runs/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: approvedBy }),
    }),
  );

  ipcMain.handle('api:upload-document', async () => {
    const options: OpenDialogOptions = {
      title: 'Selecionar documento',
      properties: ['openFile'],
      filters: [
        { name: 'Documentos', extensions: ['pdf', 'docx', 'xml', 'png', 'jpg', 'jpeg', 'txt'] },
        { name: 'Todos os arquivos', extensions: ['*'] },
      ],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    const bytes = await fs.readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(bytes)], { type: contentTypeFor(filePath) }), fileName);
    const upload = await apiJson('/documents/upload', { method: 'POST', body: form });

    return {
      canceled: false,
      fileName,
      filePath,
      documentId: upload.document_id,
    };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopDesktopBackend();
});
