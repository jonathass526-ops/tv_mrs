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

  // Helper to determine mime type
  function getMediaMimeType(filename: string, fallbackMime?: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.ogg') || lower.endsWith('.ogv')) return 'video/ogg';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.mkv')) return 'video/x-matroska';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    return fallbackMime || 'application/octet-stream';
  }

  // 5. Proxy endpoint to download/stream Google Drive media directly without saving to TV disk
  app.get('/api/drive/media/:id', async (req, res) => {
    try {
      const fileId = req.params.id;
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (!googleApiKey) {
        return res.status(500).json({ error: 'Google API key missing.' });
      }
      
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${googleApiKey}`;
      
      const fetchHeaders: any = {};
      if (req.headers.range) fetchHeaders['Range'] = req.headers.range;
      if (req.headers.referer) fetchHeaders['Referer'] = req.headers.referer;
      else if (process.env.APP_URL) fetchHeaders['Referer'] = process.env.APP_URL;

      const response = await fetch(url, {
        headers: fetchHeaders
      });

      if (!response.ok) {
         console.error(`Google Drive Stream Error (${response.status}):`, await response.text());
         return res.status(response.status).send('Error streaming media from Google Drive');
      }

      res.status(response.status);
      
      // Explicitly allow range streaming and inline rendering (so video plays in-memory directly from Google without downloading to disk)
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Disposition', 'inline');
      
      // Forward safe headers from Google
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (['content-type', 'content-length', 'accept-ranges', 'content-range', 'cache-control', 'last-modified', 'etag'].includes(lowerKey)) {
          res.setHeader(key, value);
        }
      });
      
      if (response.body) {
        Readable.fromWeb(response.body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (e) {
      console.error('Error proxying media stream:', e);
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
