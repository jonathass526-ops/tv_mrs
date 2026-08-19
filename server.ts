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

// In-memory debug logs buffer for real-time diagnostics
interface ServerLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'warn' | 'error' | 'stream';
  message: string;
  details?: any;
}

const serverLogs: ServerLogEntry[] = [];
const MAX_SERVER_LOGS = 200;

function addServerLog(type: 'info' | 'warn' | 'error' | 'stream', message: string, details?: any) {
  const timestamp = new Date().toISOString();
  const entry: ServerLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp,
    type,
    message,
    details,
  };
  
  serverLogs.push(entry);
  if (serverLogs.length > MAX_SERVER_LOGS) {
    serverLogs.shift();
  }

  // Also print nicely to server console
  const prefix = `[${timestamp.substring(11, 19)}] [${type.toUpperCase()}]`;
  if (type === 'error') {
    console.error(prefix, message, details ? details : '');
  } else if (type === 'warn') {
    console.warn(prefix, message, details ? details : '');
  } else {
    console.log(prefix, message, details ? details : '');
  }
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
  const port = Number(process.env.PORT) || 3000;

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

  // Helper to extract folderId from any Google Drive link or raw ID
  function extractFolderId(input: string): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    const gDriveFolderRegex = /\/folders\/([a-zA-Z0-9-_]+)/;
    const gDriveIdParamRegex = /[?&]id=([a-zA-Z0-9-_]+)/;
    
    const matchFolder = trimmed.match(gDriveFolderRegex);
    if (matchFolder && matchFolder[1]) return matchFolder[1];
    
    const matchId = trimmed.match(gDriveIdParamRegex);
    if (matchId && matchId[1]) return matchId[1];
    
    // If it's already an ID (no slashes, typical alphanumeric with hyphens/underscores)
    if (/^[a-zA-Z0-9-_]{10,}$/.test(trimmed)) {
      return trimmed;
    }
    return null;
  }

  // 3. Set Public Sharing Link (Google Drive)
  app.post('/api/drive/public-link', (req, res) => {
    let { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL do link de compartilhamento não fornecida.' });
    }

    const folderId = extractFolderId(url);
    if (!folderId) {
      return res.status(400).json({ error: 'Link inválido. Certifique-se de que é um link válido de uma pasta do Google Drive.' });
    }

    updateConfigState({
      publicSharingUrl: folderId, // We store the ID instead of the full URL for simplicity
      selectedFolder: null, // Reset manual folder if public link is configured
    });

    res.json({ success: true, publicSharingUrl: configState.publicSharingUrl, folderId });
  });

  // 3b. Validate Folder Link
  app.post('/api/drive/validate-folder', async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ valid: false, error: 'URL não fornecida.' });
    }
    const folderId = extractFolderId(url);
    if (!folderId) {
      return res.status(400).json({ valid: false, error: 'Formato de link do Google Drive inválido.' });
    }

    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      return res.json({ 
        valid: true, 
        folderId, 
        folderName: 'Pasta do Google Drive', 
        warning: 'Chave GOOGLE_API_KEY não configurada no servidor.' 
      });
    }

    try {
      const fRes = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name&key=${googleApiKey}`);
      if (fRes.ok) {
        const fData: any = await fRes.json();
        return res.json({ valid: true, folderId, folderName: fData.name || 'Pasta do Google Drive' });
      }
      return res.json({ valid: true, folderId, folderName: 'Pasta do Google Drive' });
    } catch (e: any) {
      return res.json({ valid: true, folderId, folderName: 'Pasta do Google Drive' });
    }
  });

  // 6c. Clear Public Link
  app.delete('/api/drive/public-link', (req, res) => {
    updateConfigState({
      publicSharingUrl: null,
    });
    res.json({ success: true });
  });

  // 4. Get Files in Selected Folder (Supports specific TV folder or default config)
  app.get('/api/drive/files', async (req, res) => {
    const rawTarget = (req.query.folderId as string) || (req.query.url as string) || configState.publicSharingUrl;
    const targetFolderId = rawTarget ? extractFolderId(rawTarget) : null;

    // If a Public Sharing Link is configured (Google Drive)
    if (targetFolderId) {
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (!googleApiKey) {
         return res.json({
           isDemo: true,
           error: 'A chave de API do Google (GOOGLE_API_KEY) não está configurada no servidor. Por favor, adicione-a nas configurações para ler pastas públicas do Google Drive.',
           folderName: 'Erro de Configuração',
           files: [],
         });
      }

      try {
        const folderId = targetFolderId;
        
        console.log(`Buscando arquivos da pasta do Google Drive: ${folderId}`);
        const q = `'${folderId}' in parents and trashed=false`;
        const encodedQ = encodeURIComponent(q);
        const fetchHeaders: any = {};
        if (req.headers.referer) fetchHeaders['Referer'] = req.headers.referer;
        else if (process.env.APP_URL) fetchHeaders['Referer'] = process.env.APP_URL;

        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodedQ}&fields=files(id,name,mimeType,size,webContentLink,webViewLink,createdTime,videoMediaMetadata,thumbnailLink)&key=${googleApiKey}`);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`A API do Google Drive retornou erro ${response.status}: ${errText}`);
        }

        const data: any = await response.json();

        const files = (data.files || []).map((item: any) => {
          const nameLower = (item.name || '').toLowerCase();
          const isImage = item.mimeType?.startsWith('image/') || isImageExtension(item.name);
          const isVideo = item.mimeType?.startsWith('video/') || nameLower.endsWith('.mp4') || nameLower.endsWith('.webm') || nameLower.endsWith('.ogg') || nameLower.endsWith('.mov') || nameLower.endsWith('.mkv');
          const isPdf = item.mimeType === 'application/pdf' || nameLower.endsWith('.pdf');
          
          // High-res direct Google CDN URL for images
          let directCdnUrl = `https://lh3.googleusercontent.com/d/${item.id}=w2560-h1440`;
          if (item.thumbnailLink) {
            directCdnUrl = item.thumbnailLink.replace(/=s\d+.*$/, '=s0');
          }

          const mediaUrl = `/api/drive/media/${item.id}?name=${encodeURIComponent(item.name || '')}&mime=${encodeURIComponent(item.mimeType || '')}`;

          return {
            id: item.id,
            name: item.name,
            size: item.size || 0,
            webUrl: item.webViewLink,
            downloadUrl: mediaUrl,
            directUrl: isImage ? directCdnUrl : mediaUrl,
            isImage,
            isVideo,
            isPdf,
            lastModified: item.createdTime,
            mimeType: item.mimeType || getMediaMimeType(item.name),
            durationMillis: item.videoMediaMetadata?.durationMillis ? parseInt(item.videoMediaMetadata.durationMillis, 10) : undefined,
          };
        });

        // Try to fetch folder details (optional, best effort)
        let folderName = 'Pasta do Google Drive';
        try {
           const fRes = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=name&key=${googleApiKey}`);
           if (fRes.ok) {
              const fData: any = await fRes.json();
              if (fData.name) folderName = fData.name;
           }
        } catch (e) {
           console.warn('Could not fetch folder name', e);
        }

        return res.json({
          isDemo: false,
          isPublicLink: true,
          folderId,
          folderName,
          files,
        });

      } catch (e: any) {
        console.error('Erro ao resolver link público do Google Drive:', e);
        return res.json({ 
          isDemo: true, 
          error: `Não foi possível acessar a pasta do Google Drive. Detalhes: ${e.message}. Certifique-se de que a pasta é pública ("Qualquer pessoa com o link").`, 
          folderName: 'Link com Erro', 
          files: [] 
        });
      }
    }

    // Default empty state
    return res.json({
      isDemo: true,
      folderName: 'Nenhuma pasta configurada',
      files: [],
    });
  });

  // 4.5 Debug Logs Endpoints
  app.get('/api/debug/logs', (req, res) => {
    res.json({
      count: serverLogs.length,
      logs: serverLogs,
    });
  });

  app.get('/api/debug/logs/text', (req, res) => {
    const text = serverLogs
      .map(l => `[${l.timestamp}] [${l.type.toUpperCase().padEnd(6)}] ${l.message} ${l.details ? JSON.stringify(l.details) : ''}`)
      .join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text || 'Nenhum log registrado ainda no servidor.');
  });

  app.delete('/api/debug/logs', (req, res) => {
    serverLogs.length = 0;
    addServerLog('info', 'Logs do servidor limpos via API');
    res.json({ ok: true });
  });

  // Helper to determine mime type
  function getMediaMimeType(filename: string, fallbackMime?: string): string {
    const lower = (filename || '').toLowerCase();
    // MOV / MP4 / M4V / MKV are MPEG-4 compatible containers.
    // Serving video/mp4 is essential for Smart TVs (webOS/Tizen) and modern browsers
    // because video/quicktime is rejected by HTML5 <video> elements.
    if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.m4v') || lower.endsWith('.mkv')) return 'video/mp4';
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.ogg') || lower.endsWith('.ogv')) return 'video/ogg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (fallbackMime && fallbackMime.includes('quicktime')) return 'video/mp4';
    if (fallbackMime && fallbackMime.startsWith('video/')) return fallbackMime;
    return fallbackMime || 'application/octet-stream';
  }

  // 5. Proxy endpoint to download/stream Google Drive media directly without saving to TV disk
  app.get('/api/drive/media/:id', async (req, res) => {
    const fileId = req.params.id;
    const fileName = (req.query.name as string) || '';
    const mimeQuery = (req.query.mime as string) || '';
    const rangeHeader = req.headers.range || '';
    const userAgent = req.headers['user-agent'] || 'Desconhecido';
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    
    // Identify Smart TV platform from User-Agent for logs
    let deviceType = 'PC/Navegador';
    const uaLower = userAgent.toLowerCase();
    if (uaLower.includes('webos') || uaLower.includes('netcast')) deviceType = 'LG Smart TV (webOS)';
    else if (uaLower.includes('tizen') || uaLower.includes('samsung')) deviceType = 'Samsung Smart TV (Tizen)';
    else if (uaLower.includes('android') && uaLower.includes('tv')) deviceType = 'Android TV';
    else if (uaLower.includes('smart-tv') || uaLower.includes('smarttv')) deviceType = 'Smart TV Genérica';

    addServerLog('stream', `📥 Requisição de mídia: "${fileName || fileId}" (ID: ${fileId})`, {
      device: deviceType,
      range: rangeHeader || 'Completo (sem Range)',
      ip: clientIp,
    });

    try {
      const googleApiKey = process.env.GOOGLE_API_KEY;
      const expectedMime = getMediaMimeType(fileName, mimeQuery);
      const isVideo = expectedMime.startsWith('video/') || fileName.toLowerCase().endsWith('.mp4') || fileName.toLowerCase().endsWith('.webm') || fileName.toLowerCase().endsWith('.mov') || fileName.toLowerCase().endsWith('.mkv') || fileName.toLowerCase().endsWith('.ogg');
      const isImage = isImageExtension(fileName) || expectedMime.startsWith('image/');

      const fetchHeaders: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      if (rangeHeader) fetchHeaders['Range'] = rangeHeader;

      let upstreamResponse: Response | null = null;
      let finalContentType = expectedMime;
      let chosenStrategy = 'Nenhuma';

      // Strategy 1: Google Drive API (Official alt=media)
      if (googleApiKey) {
        try {
          const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${googleApiKey}`;
          const r = await fetch(url, { headers: fetchHeaders });
          const ct = (r.headers.get('content-type') || '').toLowerCase();
          
          if ((r.ok || r.status === 206) && !ct.includes('text/html') && !ct.includes('application/json')) {
            upstreamResponse = r;
            chosenStrategy = 'Estratégia 1 (Google Drive API)';
            finalContentType = isVideo ? (expectedMime !== 'application/octet-stream' ? expectedMime : 'video/mp4') : (r.headers.get('content-type') || expectedMime);
            addServerLog('info', `✅ [Estratégia 1 OK] Google Drive API alt=media -> HTTP ${r.status} (${finalContentType})`);
          } else {
            addServerLog('warn', `⚠️ [Estratégia 1 Falhou] Status ${r.status} (${ct}) para arquivo ${fileId}, tentando fallback...`);
          }
        } catch (e: any) {
          addServerLog('warn', `⚠️ [Estratégia 1 Erro] ${e?.message || e}`);
        }
      }

      // Strategy 2: Google CDN (lh3.googleusercontent.com - ONLY FOR IMAGES)
      if (!upstreamResponse && isImage) {
        try {
          const cdnUrl = `https://lh3.googleusercontent.com/d/${fileId}=w2560-h1440`;
          const r = await fetch(cdnUrl, { headers: fetchHeaders });
          if (r.ok || r.status === 206) {
            upstreamResponse = r;
            chosenStrategy = 'Estratégia 2 (Google CDN Imagem)';
            finalContentType = r.headers.get('content-type') || expectedMime;
            addServerLog('info', `✅ [Estratégia 2 OK] Google CDN -> HTTP ${r.status} (${finalContentType})`);
          }
        } catch (e: any) {
          addServerLog('warn', `⚠️ [Estratégia 2 Erro] CDN fallback: ${e?.message || e}`);
        }
      }

      // Strategy 3: Google Drive UserContent Direct Stream
      if (!upstreamResponse && isVideo) {
        try {
          const userContentUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
          const r = await fetch(userContentUrl, { headers: fetchHeaders, redirect: 'follow' });
          const ct = (r.headers.get('content-type') || '').toLowerCase();

          if ((r.ok || r.status === 206) && !ct.includes('text/html')) {
            upstreamResponse = r;
            chosenStrategy = 'Estratégia 3 (Google UserContent)';
            finalContentType = isVideo ? 'video/mp4' : (r.headers.get('content-type') || expectedMime);
            addServerLog('info', `✅ [Estratégia 3 OK] Google UserContent -> HTTP ${r.status} (${finalContentType})`);
          }
        } catch (e: any) {
          addServerLog('warn', `⚠️ [Estratégia 3 Erro] UserContent: ${e?.message || e}`);
        }
      }

      // Strategy 4: Google Drive UC Export Download (with Virus Scan Confirmation Bypass for large videos)
      if (!upstreamResponse) {
        try {
          const ucUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          const r = await fetch(ucUrl, { headers: fetchHeaders, redirect: 'follow' });
          const ct = (r.headers.get('content-type') || '').toLowerCase();

          if ((r.ok || r.status === 206) && !ct.includes('text/html')) {
            upstreamResponse = r;
            chosenStrategy = 'Estratégia 4 (Google UC Direto)';
            finalContentType = isVideo ? (expectedMime !== 'application/octet-stream' ? expectedMime : 'video/mp4') : (r.headers.get('content-type') || expectedMime);
            addServerLog('info', `✅ [Estratégia 4 OK] Google UC Direto -> HTTP ${r.status} (${finalContentType})`);
          } else if (ct.includes('text/html')) {
            // Large file virus warning page detected: extract confirmation token
            const htmlText = await r.text();
            const tokenMatch = htmlText.match(/confirm=([0-9A-Za-z_-]+)/) || 
                               htmlText.match(/name="confirm"\s+value="([^"]+)"/) ||
                               htmlText.match(/download_warning_[0-9A-Za-z_-]+=([0-9A-Za-z_-]+)/);
            
            const actionMatch = htmlText.match(/action="([^"]+)"/);
            
            if (tokenMatch && tokenMatch[1]) {
              const confirmToken = tokenMatch[1];
              addServerLog('info', `🔄 [Bypass Vírus] Token detectado (${confirmToken}) para vídeo grande`);
              const confirmedUrl = actionMatch && actionMatch[1].startsWith('http')
                ? `${actionMatch[1]}${actionMatch[1].includes('?') ? '&' : '?'}confirm=${confirmToken}&id=${fileId}`
                : `https://drive.google.com/uc?export=download&confirm=${confirmToken}&id=${fileId}`;
              
              const setCookie = r.headers.get('set-cookie');
              const secondHeaders = { ...fetchHeaders };
              if (setCookie) secondHeaders['Cookie'] = setCookie;

              const confirmedRes = await fetch(confirmedUrl, { headers: secondHeaders, redirect: 'follow' });
              if (confirmedRes.ok || confirmedRes.status === 206) {
                upstreamResponse = confirmedRes;
                chosenStrategy = 'Estratégia 4 (Google UC Confirm Token Bypass)';
                finalContentType = isVideo ? (expectedMime !== 'application/octet-stream' ? expectedMime : 'video/mp4') : (confirmedRes.headers.get('content-type') || expectedMime);
                addServerLog('info', `✅ [Estratégia 4 Confirm OK] Vídeo liberado com token -> HTTP ${confirmedRes.status} (${finalContentType})`);
              }
            } else {
              addServerLog('warn', `⚠️ [Estratégia 4 Falhou] Resposta em HTML mas token de confirmação não encontrado`);
            }
          }
        } catch (e: any) {
          addServerLog('warn', `⚠️ [Estratégia 4 Erro] UC fallback: ${e?.message || e}`);
        }
      }

      if (!upstreamResponse) {
        addServerLog('error', `❌ Arquivo ${fileId} não pôde ser obtido por nenhuma estratégia do Google Drive`);
        return res.status(404).send('Media not found or not accessible on Google Drive');
      }

      res.status(upstreamResponse.status);
      
      // Crucial for Smart TV: prevent dead cache lock on loop
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Explicitly allow range streaming and inline rendering with correct MIME types for Smart TV webOS/Tizen
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', finalContentType);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Accept, Content-Type');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
      
      // Forward essential streaming headers from Google
      const contentRange = upstreamResponse.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);

      const contentLength = upstreamResponse.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      const etag = upstreamResponse.headers.get('etag');
      if (etag) res.setHeader('ETag', etag);

      addServerLog('stream', `📤 Enviando stream para TV (${deviceType})`, {
        status: upstreamResponse.status,
        mime: finalContentType,
        strategy: chosenStrategy,
        contentLength: contentLength || 'chunked',
        contentRange: contentRange || 'none',
      });

      if (upstreamResponse.body) {
        const stream = Readable.fromWeb(upstreamResponse.body as any);
        
        stream.on('error', (err) => {
          addServerLog('warn', `⚠️ Erro no pipe de streaming de ${fileId}: ${err.message}`);
        });

        res.on('close', () => {
          if (!res.writableEnded) {
            addServerLog('info', `ℹ️ Conexão de streaming encerrada pela TV (${fileName || fileId})`);
          }
        });

        stream.pipe(res);
      } else {
        res.end();
      }
    } catch (e: any) {
      addServerLog('error', `❌ Erro crítico proxyando mídia ${fileId}: ${e?.message || e}`);
      if (!res.headersSent) res.status(500).send('Internal server error proxying file');
    }
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

  app.listen(port, '0.0.0.0', () => {
    console.log(`OneDrive Slideshow Server running on port ${port} (Ready for requests)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start full-stack server:', err);
});
