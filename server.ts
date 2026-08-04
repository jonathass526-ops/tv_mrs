import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import https from 'https';

// Load environment variables from .env
dotenv.config();

const CONFIG_FILE = path.resolve('./drive-config.json');

// Helper to read saved Drive config
function readConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {
      console.error('Error reading drive-config.json:', e);
      return {};
    }
  }
  return {};
}

// Helper to write Drive config
function writeConfig(data: any) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing drive-config.json:', e);
  }
}

const SEDES_FILE = path.resolve('./sedes-config.json');

// Extract Google Drive Folder ID from URL or ID string
function extractFolderId(urlOrId: string | null | undefined): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  const gDriveFolderRegex = /\/folders\/([a-zA-Z0-9-_]+)/;
  const gDriveIdParamRegex = /id=([a-zA-Z0-9-_]+)/;

  const matchFolder = trimmed.match(gDriveFolderRegex);
  if (matchFolder && matchFolder[1]) return matchFolder[1];

  const matchId = trimmed.match(gDriveIdParamRegex);
  if (matchId && matchId[1]) return matchId[1];

  if (/^[a-zA-Z0-9-_]+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function readSedes(): any[] {
  if (fs.existsSync(SEDES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SEDES_FILE, 'utf-8'));
    } catch (e) {
      console.error('Error reading sedes-config.json:', e);
      return [];
    }
  }
  return [];
}

function writeSedes(data: any[]) {
  try {
    fs.writeFileSync(SEDES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing sedes-config.json:', e);
  }
}

// Create a persistent HTTPS agent with keepAlive enabled to avoid SSL handshake overhead on range requests
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000,
});

// Dynamic Referer construction to bypass Google API Key restrictions on any device (TV, mobile, etc.)
function getRefererHeader(req: express.Request): string {
  if (req.headers.referer) {
    return req.headers.referer;
  }
  const host = req.headers.host;
  if (host) {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const protocol = isHttps ? 'https' : 'http';
    return `${protocol}://${host}/`;
  }
  return process.env.APP_URL || '';
}

// Global tokens & selection cache from file
let configState = readConfig();

// Sync file state periodically or update memory
function updateConfigState(newState: any) {
  configState = { ...configState, ...newState };
  writeConfig(configState);
}

// Fetch access token, refreshing if necessary
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Auth Status Endpoint
  app.get('/api/auth/status', (req, res) => {
    res.json({
      connected: !!configState.publicSharingUrl,
      hasCredentials: !!process.env.GOOGLE_API_KEY,
      user: null,
      selectedFolder: null,
      publicSharingUrl: configState.publicSharingUrl || null,
      isDemo: !configState.publicSharingUrl,
    });
  });

  // 2. Disconnect (Clear Config)
  app.get('/api/auth/disconnect', (req, res) => {
    updateConfigState({
      publicSharingUrl: null,
    });
    res.json({ success: true });
  });

  // 3. Set Public Sharing Link (Google Drive)
  app.post('/api/drive/public-link', (req, res) => {
    let { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL do link de compartilhamento não fornecida.' });
    }

    url = url.trim();
    const folderId = extractFolderId(url);

    if (!folderId) {
      return res.status(400).json({ error: 'Link inválido. Certifique-se de que é um link válido de uma pasta do Google Drive.' });
    }

    updateConfigState({
      publicSharingUrl: folderId, // We store the ID instead of the full URL for simplicity
      selectedFolder: null, // Reset manual folder if public link is configured
    });

    res.json({ success: true, publicSharingUrl: configState.publicSharingUrl });
  });

  // 3b. Sedes Management Endpoints
  app.get('/api/sedes', (req, res) => {
    const sedes = readSedes();
    res.json({ sedes });
  });

  app.post('/api/sedes', (req, res) => {
    const { id, name, folderUrl, description } = req.body;
    if (!name || !name.trim() || !folderUrl || !folderUrl.trim()) {
      return res.status(400).json({ error: 'Nome da sede e link da pasta são obrigatórios.' });
    }

    const folderId = extractFolderId(folderUrl);
    if (!folderId) {
      return res.status(400).json({ error: 'Link ou ID de pasta do Google Drive inválido. Cole o link público da pasta.' });
    }

    const sedes = readSedes();
    let updatedSede: any;

    if (id) {
      const index = sedes.findIndex((s: any) => s.id === id);
      if (index !== -1) {
        sedes[index] = {
          ...sedes[index],
          name: name.trim(),
          folderUrl: folderUrl.trim(),
          folderId,
          description: description ? description.trim() : '',
          trainAlerts: Array.isArray(req.body.trainAlerts) ? req.body.trainAlerts : (sedes[index].trainAlerts || []),
          updatedAt: new Date().toISOString()
        };
        updatedSede = sedes[index];
      } else {
        return res.status(404).json({ error: 'Sede não encontrada.' });
      }
    } else {
      const newId = 'sede-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
      updatedSede = {
        id: newId,
        name: name.trim(),
        folderUrl: folderUrl.trim(),
        folderId,
        description: description ? description.trim() : '',
        trainAlerts: Array.isArray(req.body.trainAlerts) ? req.body.trainAlerts : [],
        createdAt: new Date().toISOString()
      };
      sedes.push(updatedSede);
    }

    writeSedes(sedes);

    // Default global public link fallback if none set
    if (!configState.publicSharingUrl) {
      updateConfigState({ publicSharingUrl: folderId });
    }

    res.json({ success: true, sede: updatedSede, sedes });
  });

  app.post('/api/sedes/:id/alerts', (req, res) => {
    const { id } = req.params;
    const { trainAlerts } = req.body;
    if (!Array.isArray(trainAlerts)) {
      return res.status(400).json({ error: 'Os alertas de trens devem ser uma lista.' });
    }

    const sedes = readSedes();
    const index = sedes.findIndex((s: any) => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Sede não encontrada.' });
    }

    sedes[index].trainAlerts = trainAlerts;
    sedes[index].updatedAt = new Date().toISOString();

    writeSedes(sedes);
    res.json({ success: true, sede: sedes[index], sedes });
  });

  app.delete('/api/sedes/:id', (req, res) => {
    const { id } = req.params;
    let sedes = readSedes();
    sedes = sedes.filter((s: any) => s.id !== id);
    writeSedes(sedes);
    res.json({ success: true, sedes });
  });

  // 6c. Clear Public Link
  app.delete('/api/drive/public-link', (req, res) => {
    updateConfigState({
      publicSharingUrl: null,
    });
    res.json({ success: true });
  });

  // 4. Get Files in Selected Folder (Supports Sedes, Direct Folder Link, Public Link)
  app.get('/api/drive/files', async (req, res) => {
    let targetFolderUrlOrId = (req.query.sedeId || req.query.folderId || req.query.folderUrl) as string | undefined;
    let customSedeName = '';
    let matchedSede: any = null;

    if (req.query.sedeId) {
      const sedes = readSedes();
      matchedSede = sedes.find((s: any) => s.id === req.query.sedeId);
      if (matchedSede) {
        targetFolderUrlOrId = matchedSede.folderId || matchedSede.folderUrl;
        customSedeName = matchedSede.name;
      }
    }

    if (!targetFolderUrlOrId) {
      targetFolderUrlOrId = configState.publicSharingUrl;
    }

    if (targetFolderUrlOrId) {
      let folderId = extractFolderId(targetFolderUrlOrId) || targetFolderUrlOrId;
      const googleApiKey = process.env.GOOGLE_API_KEY;

      if (!googleApiKey) {
         return res.json({
           isDemo: true,
           error: 'A chave de API do Google (GOOGLE_API_KEY) não está configurada no servidor. Por favor, adicione-a nas configurações para ler pastas públicas do Google Drive.',
           folderName: customSedeName || 'Erro de Configuração',
           files: [],
         });
      }

      try {
        console.log(`Buscando arquivos da pasta do Google Drive: ${folderId}`);
        const q = `'${folderId}' in parents and trashed=false`;
        const encodedQ = encodeURIComponent(q);
        const fetchHeaders: any = {};
        const referer = getRefererHeader(req);
        if (referer) {
          fetchHeaders['Referer'] = referer;
        }

        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodedQ}&fields=files(id,name,mimeType,size,webContentLink,webViewLink,createdTime,videoMediaMetadata)&key=${googleApiKey}`, {
          headers: fetchHeaders
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`A API do Google Drive retornou erro ${response.status}: ${errText}`);
        }

        const data: any = await response.json();

        const files = (data.files || []).map((item: any) => {
          const nameLower = (item.name || '').toLowerCase();
          const isImage = item.mimeType?.startsWith('image/') || isImageExtension(item.name);
          const isVideo = item.mimeType?.startsWith('video/') || nameLower.endsWith('.mp4') || nameLower.endsWith('.webm') || nameLower.endsWith('.ogg');
          const isPdf = item.mimeType === 'application/pdf' || nameLower.endsWith('.pdf');
          
          return {
            id: item.id,
            name: item.name,
            size: item.size || 0,
            webUrl: item.webViewLink,
            downloadUrl: `/api/drive/media/${item.id}`,
            isImage,
            isVideo,
            isPdf,
            lastModified: item.createdTime,
            mimeType: item.mimeType || (isImage ? 'image/jpeg' : (isVideo ? 'video/mp4' : (isPdf ? 'application/pdf' : 'application/octet-stream'))),
            durationMillis: item.videoMediaMetadata?.durationMillis ? parseInt(item.videoMediaMetadata.durationMillis, 10) : undefined,
          };
        });

        // Try to fetch folder details (optional, best effort)
        let folderName = customSedeName || 'Pasta do Google Drive';
        if (!customSedeName) {
          try {
             const fRes = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=name&key=${googleApiKey}`);
             if (fRes.ok) {
                const fData: any = await fRes.json();
                if (fData.name) folderName = fData.name;
             }
          } catch (e) {
             console.warn('Could not fetch folder name', e);
          }
        }

        return res.json({
          isDemo: false,
          isPublicLink: true,
          folderName,
          files,
          trainAlerts: matchedSede?.trainAlerts || [],
          sede: matchedSede,
        });

      } catch (e: any) {
        console.error('Erro ao resolver link público do Google Drive:', e);
        return res.json({ 
          isDemo: true, 
          error: `Não foi possível acessar a pasta do Google Drive. Detalhes: ${e.message}. Certifique-se de que a pasta é pública ("Qualquer pessoa com o link").`, 
          folderName: customSedeName || 'Link com Erro', 
          files: [],
          trainAlerts: matchedSede?.trainAlerts || [],
          sede: matchedSede,
        });
      }
    }

    // Default empty state
    return res.json({
      isDemo: true,
      folderName: 'Nenhuma pasta ou sede configurada',
      files: [],
      trainAlerts: matchedSede?.trainAlerts || [],
      sede: matchedSede,
    });
  });

  // 5. Proxy endpoint to download/stream Google Drive media bypassing 403
  app.get('/api/drive/media/:id', (req, res) => {
    let activeClientReq: any = null;
    let activeApiRes: any = null;
    let isCleanedUp = false;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      if (activeClientReq) {
        try { activeClientReq.destroy(); } catch (_) {}
      }
      if (activeApiRes) {
        try { activeApiRes.destroy(); } catch (_) {}
      }
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
    res.on('close', cleanup);

    const fileId = req.params.id;
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      cleanup();
      return res.status(500).json({ error: 'Google API key missing.' });
    }

    const initialUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${googleApiKey}`;
    
    const requestHeaders: Record<string, string> = {};
    if (req.headers.range) {
      requestHeaders['Range'] = req.headers.range;
    }
    const referer = getRefererHeader(req);
    if (referer) {
      requestHeaders['Referer'] = referer;
    }

    const makeRequest = (targetUrl: string, headersToSend: Record<string, string>, redirectDepth = 0) => {
      if (isCleanedUp) return;
      if (redirectDepth > 6) {
        cleanup();
        if (!res.headersSent) res.status(508).send('Too many redirects');
        return;
      }

      activeClientReq = https.get(targetUrl, { headers: headersToSend, agent: keepAliveAgent }, (apiRes) => {
        activeApiRes = apiRes;

        if (isCleanedUp) {
          try { apiRes.destroy(); } catch (_) {}
          return;
        }

        // Handle 301 / 302 / 303 / 307 / 308 Redirects (Google Drive API redirects to Google Cloud Storage CDN)
        if (apiRes.statusCode && apiRes.statusCode >= 300 && apiRes.statusCode < 400 && apiRes.headers.location) {
          const redirectUrl = apiRes.headers.location;
          apiRes.resume(); // Consume stream to avoid leaking memory sockets
          
          const redirectHeaders: Record<string, string> = {};
          if (req.headers.range) {
            redirectHeaders['Range'] = req.headers.range;
          }
          
          makeRequest(redirectUrl, redirectHeaders, redirectDepth + 1);
          return;
        }

        const statusCode = apiRes.statusCode || 200;
        res.status(statusCode);

        // Instruct browser and Smart TVs to cache files (immutable 24h)
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

        // Forward safe headers
        const safeHeaders = [
          'content-type',
          'content-length',
          'accept-ranges',
          'content-range',
          'last-modified',
          'etag'
        ];
        for (const [key, value] of Object.entries(apiRes.headers)) {
          if (safeHeaders.includes(key.toLowerCase()) && value !== undefined) {
            res.setHeader(key, value);
          }
        }

        apiRes.on('error', () => {
          cleanup();
        });

        apiRes.pipe(res);
      });

      activeClientReq.on('error', (err: any) => {
        if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
          console.error('Error proxying media via https.get:', err);
        }
        cleanup();
        if (!res.headersSent) {
          res.status(500).send('Internal server error proxying file');
        }
      });
    };

    makeRequest(initialUrl, requestHeaders);
  });

  // Helper to check file extension
  function isImageExtension(filename: string): boolean {
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];
    const lower = filename.toLowerCase();
    return extensions.some(ext => lower.endsWith(ext));
  }

  // --- Serve Frontend and Integrate Vite ---

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // In production, serve build assets statically
    // Ensure we find the correct dist directory whether running from project root or inside dist/
    let distPath = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(path.join(distPath, 'index.html')) && fs.existsSync(path.join(process.cwd(), 'index.html'))) {
      distPath = process.cwd();
    } else if (typeof __dirname !== 'undefined') {
       if (fs.existsSync(path.join(__dirname, 'index.html'))) {
           distPath = __dirname;
       } else if (fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
           distPath = path.join(__dirname, 'dist');
       }
    }
    
    app.use(express.static(distPath));

    // Fallback for Single Page App routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // In development, hook up Vite middleware
    console.log('Starting server in development mode with Vite middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Slideshow Server running on port ${PORT} (Ready for requests)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start full-stack server:', err);
});
