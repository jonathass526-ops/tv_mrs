import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Cloud, 
  Folder, 
  FolderOpen, 
  Image as ImageIcon, 
  FileText, 
  FileCheck, 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  Settings, 
  LogOut, 
  ChevronUp, 
  Info, 
  Check, 
  Clock, 
  FileSpreadsheet, 
  FileCode, 
  File, 
  Sparkles,
  ExternalLink,
  Laptop,
  Link as LinkIcon,
  AlertTriangle
} from 'lucide-react';
interface AuthStatus {
  connected: boolean;
  hasCredentials: boolean;
  user: { displayName?: string; mail?: string } | null;
  selectedFolder: { id: string; name: string } | null;
  publicSharingUrl: string | null;
  isDemo: boolean;
}
interface MediaFile {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  downloadUrl: string | null;
  isImage: boolean;
  isVideo: boolean;
  isPdf?: boolean;
  lastModified: string;
  mimeType: string;
  durationMillis?: number;
}
interface OneDriveFolder {
  id: string;
  name: string;
  path: string;
}
import { useLocalStorage } from './hooks/useLocalStorage';
export default function App() {
  // Authentication & Source Data States
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    connected: false,
    hasCredentials: false,
    user: null,
    selectedFolder: null,
    publicSharingUrl: null,
    isDemo: true,
  });
  const [publicLinkInput, setPublicLinkInput] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [resolvedFolderName, setResolvedFolderName] = useState('');
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  // Slideshow Engine States
  const [slideshowMode, setSlideshowMode] = useState(false);
  const [isDirectView, setIsDirectView] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [renderedIndex, setRenderedIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [transitionSpeed, setTransitionSpeed] = useLocalStorage('app_transitionSpeed', 5000);
  const [transitionEffect, setTransitionEffect] = useLocalStorage<'fade' | 'zoom' | 'slide'>('app_transitionEffect', 'fade');
  const [showFileName, setShowFileName] = useLocalStorage('app_showFileName', true);
  const [showClock, setShowClock] = useLocalStorage('app_showClock', true);
  const [showUiInSlideshow, setShowUiInSlideshow] = useLocalStorage('app_showUiInSlideshow', true);
  // UI Detail States
  const [selectedDoc, setSelectedDoc] = useState<MediaFile | null>(null);
  const [showCredentialsHelp, setShowCredentialsHelp] = useState(false);
  const [autoRefresh, setAutoRefresh] = useLocalStorage('app_autoRefresh', true);
  const [autoRefreshRate, setAutoRefreshRate] = useLocalStorage('app_autoRefreshRate', 60000); // 1 minute default
  const [currentTime, setCurrentTime] = useState('');
  
  // Train Departure Schedule and Test Alert States
  const [trainSchedules, setTrainSchedules] = useLocalStorage<string[]>('app_trainSchedules', ['12:00', '17:00', '19:50']);
  const [testAlertActive, setTestAlertActive] = useState(false);
  const [newScheduleInput, setNewScheduleInput] = useState('');

  // Active Refs for Slideshow Auto-play
  const autoPlayTimer = useRef<NodeJS.Timeout | null>(null);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);
  const clockTimer = useRef<NodeJS.Timeout | null>(null);

  // Filter files to images/videos only for the slideshow
  const mediaFiles = useMemo(() => files.filter(f => f.isImage || f.isVideo || f.isPdf), [files]);

  // Train Departure Alert / KPC Logic (Triggers strictly 15 minutes before departure and disappears after departure)
  const kpcData = useMemo(() => {
    if (testAlertActive) {
      return {
        message: "Atenção para a formação do KPC das 12:00h",
        targetTime: "12:00",
        diffSeconds: 899,
        formattedTimer: "14:59",
      };
    }

    const now = new Date();
    const currentMs = now.getTime();

    for (const timeStr of trainSchedules) {
      const parts = timeStr.trim().split(':');
      if (parts.length < 2) continue;
      const targetHour = parseInt(parts[0], 10);
      const targetMinute = parseInt(parts[1], 10);
      if (isNaN(targetHour) || isNaN(targetMinute)) continue;

      const targetDate = new Date(now);
      targetDate.setHours(targetHour, targetMinute, 0, 0);

      const diffMs = targetDate.getTime() - currentMs;
      const diffSeconds = Math.floor(diffMs / 1000);

      // Alert triggers ONLY when 15 minutes or less remain BEFORE departure (> 0 seconds)
      if (diffSeconds > 0 && diffSeconds <= 15 * 60) {
        const h = Math.floor(diffSeconds / 3600);
        const m = Math.floor((diffSeconds % 3600) / 60);
        const s = diffSeconds % 60;
        const formattedTimer = h > 0
          ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
          : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        return {
          message: `Atenção para a formação do KPC das ${timeStr}h`,
          targetTime: timeStr,
          diffSeconds,
          formattedTimer,
        };
      }
    }

    return null;
  }, [currentTime, trainSchedules, testAlertActive]);
  // Fetch Connection Status
  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        setAuthStatus(data);
      }
    } catch (e) {
      console.error('Error fetching auth status:', e);
    }
  }, []);
  // Fetch Files in Selected Folder
  const fetchFiles = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingFiles(true);
    setFileError(null);
    try {
      const res = await fetch('/api/drive/files');
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setFileError(data.error);
        }
        setFiles(data.files || []);
        setResolvedFolderName(data.folderName || '');
      } else {
        const data = await res.json().catch(() => ({}));
        setFileError(data.error || 'Erro desconhecido ao carregar arquivos da pasta.');
      }
    } catch (e: any) {
      console.error('Error fetching files:', e);
      setFileError(e.message || 'Erro de conexão com o servidor ao carregar arquivos.');
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);
  // Trigger manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchFiles(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };
  // Load initial status and files
  useEffect(() => {
    fetchAuthStatus();
    // Check URL for direct view mode
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('view') === '1' || searchParams.get('view') === 'true') {
      setSlideshowMode(true);
      setIsDirectView(true);
      if (searchParams.has('speed')) setTransitionSpeed(Number(searchParams.get('speed')));
      if (searchParams.has('effect')) setTransitionEffect(searchParams.get('effect') as any);
      if (searchParams.has('filename')) setShowFileName(searchParams.get('filename') === 'true');
      if (searchParams.has('clock')) setShowClock(searchParams.get('clock') === 'true');
      if (searchParams.has('ui')) setShowUiInSlideshow(searchParams.get('ui') === 'true');
      if (searchParams.has('refresh')) setAutoRefresh(searchParams.get('refresh') === 'true');
      if (searchParams.has('rate')) setAutoRefreshRate(Number(searchParams.get('rate')));
    }
  }, [fetchAuthStatus]);
  useEffect(() => {
    fetchFiles();
  }, [authStatus.connected, authStatus.selectedFolder, authStatus.publicSharingUrl, fetchFiles]);
  // Synchronous Time ticking for Slideshow Clock Overlay
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    clockTimer.current = setInterval(updateTime, 1000);
    return () => {
      if (clockTimer.current) clearInterval(clockTimer.current);
    };
  }, []);
  // Poll for new files if auto-refresh is active
  useEffect(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    if (autoRefresh) {
      pollTimer.current = setInterval(() => {
        fetchFiles(true);
      }, autoRefreshRate);
    }
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [autoRefresh, autoRefreshRate, fetchFiles]);
  // Listen for Escape key to exit slideshow mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && slideshowMode && !isDirectView) {
        setSlideshowMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slideshowMode, isDirectView]);
  // Sync renderedIndex with currentSlideIndex via a smooth transition
  useEffect(() => {
    if (currentSlideIndex !== renderedIndex) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setRenderedIndex(currentSlideIndex);
        setIsFadingOut(false);
      }, 400); // 400ms transition time for beautiful responsiveness
      return () => clearTimeout(timer);
    } else {
      // In case they are already in sync (e.g., initial render)
      setRenderedIndex(currentSlideIndex);
    }
  }, [currentSlideIndex, renderedIndex]);
  // Handle Slideshow Timing Loop
  const handleNextSlide = useCallback(() => {
    if (mediaFiles.length === 0) return;
    setCurrentSlideIndex(prev => (prev + 1) % mediaFiles.length);
  }, [mediaFiles.length]);
  const handlePrevSlide = useCallback(() => {
    if (mediaFiles.length === 0) return;
    setCurrentSlideIndex(prev => (prev - 1 + mediaFiles.length) % mediaFiles.length);
  }, [mediaFiles.length]);
  // Use a string signature to prevent polling from resetting the timer if the files are the same
  const mediaFilesSignature = useMemo(() => mediaFiles.map(f => f.id).join(','), [mediaFiles]);
  useEffect(() => {
    if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
    // Pause image slideshow during active train departure alert
    if (kpcData) return;

    if (isPlaying && slideshowMode && mediaFiles.length > 0) {
      if (mediaFiles[currentSlideIndex]?.isVideo) {
         // Rely primarily on the video's onEnded event.
         // Set a generous fallback timeout in case the video stalls or fails to play.
         const duration = mediaFiles[currentSlideIndex].durationMillis || 30000;
         autoPlayTimer.current = setTimeout(() => {
           handleNextSlide();
         }, duration + 10000); // 10s padding for buffering/errors
      } else {
        autoPlayTimer.current = setTimeout(() => {
          handleNextSlide();
        }, transitionSpeed);
      }
    }
    return () => {
      if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
    };
  }, [isPlaying, slideshowMode, transitionSpeed, currentSlideIndex, handleNextSlide, mediaFilesSignature, kpcData]);
  // Disconnect Google Drive
  const handleDisconnect = async () => {
    if (confirm('Tem certeza que deseja desconectar o Google Drive?')) {
      try {
        const res = await fetch('/api/auth/disconnect');
        if (res.ok) {
          fetchAuthStatus();
          alert('Pasta do Google Drive removida.');
        }
      } catch (e) {
        console.error('Error disconnecting:', e);
      }
    }
  };
  // Save Public Sharing Link
  const handleSavePublicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicLinkInput.trim()) return;
    setIsSubmittingLink(true);
    try {
      const res = await fetch('/api/drive/public-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: publicLinkInput.trim() }),
      });
      if (res.ok) {
        setPublicLinkInput('');
        await fetchAuthStatus();
        alert('Link público configurado com sucesso! Se você já estiver autenticado em uma conta (mesmo com 2FA), as imagens serão exibidas ao vivo.');
      } else {
        const data = await res.json();
        alert(data.error || 'Falha ao salvar o link de compartilhamento.');
      }
    } catch (err: any) {
      alert(`Erro ao salvar o link de compartilhamento: ${err.message}`);
    } finally {
      setIsSubmittingLink(false);
    }
  };
  // Size formatter helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };
  // Beautiful File icon mapper
  const renderFileIcon = (file: MediaFile) => {
    if (file.isImage) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    const mime = file.mimeType.toLowerCase();
    if (mime.includes('pdf')) return <FileText className="w-5 h-5 text-rose-400" />;
    if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    if (mime.includes('word') || mime.includes('document')) return <FileText className="w-5 h-5 text-blue-400" />;
    if (mime.includes('javascript') || mime.includes('typescript') || mime.includes('json') || mime.includes('html')) return <FileCode className="w-5 h-5 text-amber-400" />;
    return <File className="w-5 h-5 text-slate-400" />;
  };
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white" id="main-container">
      {/* 1. TOP NAVIGATION BAR */}
      {!slideshowMode && (
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 transition-all px-4 sm:px-6" id="app-header">
          <div className="max-w-7xl mx-auto flex h-16 items-center justify-between">
            {/* Left side brand */}
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600/10 text-blue-500 rounded-lg border border-blue-500/20 shadow-inner">
                <Cloud className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
                  Google Drive Live Canvas
                </h1>
                <p className="text-xs text-slate-400 font-mono hidden sm:block">
                  {authStatus.isDemo 
                    ? '• Modo Demonstração' 
                    : (authStatus.publicSharingUrl 
                        ? '• Conectado via Link Público' 
                        : '')}
                </p>
              </div>
            </div>
            {/* Right side controls */}
            <div className="flex items-center space-x-2">
              {/* Dynamic Connection Indicator */}
              <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center space-x-1.5 border ${
                authStatus.isDemo 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${authStatus.isDemo ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`} />
                <span>{authStatus.isDemo ? 'Demo' : 'Sincronizado'}</span>
              </div>
              {/* Configure Connection */}
              {!authStatus.isDemo && (
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-600 hover:text-white rounded-lg text-rose-400 transition border border-rose-500/20 flex items-center space-x-1.5 text-xs font-bold"
                  title="Desconectar Pasta"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair</span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}
      {/* 2. MAIN HUB SCREEN */}
      {!slideshowMode ? (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col space-y-6" id="dashboard-body">
          {/* Info banner for Demo Mode */}
          {authStatus.isDemo && (
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950/40 rounded-xl p-5 border border-indigo-500/10 shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0" id="demo-banner">
              <div className="absolute right-0 top-0 -mr-16 -mt-16 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-start space-x-3.5">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-indigo-200">Você está navegando no Modo de Demonstração!</h3>
                  <p className="text-sm text-slate-400 max-w-2xl mt-0.5">
                    Este site não tem uma pasta do Google Drive conectada. Cole o link de uma pasta pública do Google Drive na barra lateral para começar.
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* Core App Grid: 1/3 Controls and 2/3 List & Slider */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="app-grid">
            {/* Col 1: Configuration & Settings panel (4 Cols) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Box A: Folder Details / Live Slideshow Starter */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm" id="folder-status-card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                      <Folder className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Diretório Ativo</span>
                      <h2 className="font-bold text-slate-100 text-base line-clamp-1">
                        {resolvedFolderName || 'Pasta de Demonstração'}
                      </h2>
                    </div>
                  </div>
                </div>
                {/* Statistics List */}
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-b border-slate-800/80 py-4">
                  <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
                    <span className="text-xs text-slate-500 block">Total de Arquivos</span>
                    <span className="text-xl font-mono font-bold text-slate-200 mt-1 block">
                      {files.length}
                    </span>
                  </div>
                  <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
                    <span className="text-xs text-slate-500 block">Imagens (Slides)</span>
                    <span className="text-xl font-mono font-bold text-emerald-400 mt-1 block">
                      {mediaFiles.length}
                    </span>
                  </div>
                </div>
                {/* Public Link Integration */}
                <div className="my-5 pb-4 border-b border-slate-800/80">
                  {authStatus.publicSharingUrl ? (
                    <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-400 flex items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse mr-2" />
                          Link Público Ativo
                        </span>
                        <button
                          onClick={handleDisconnect}
                          className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          Remover Link
                        </button>
                      </div>
                      <p className="text-[10px] font-mono text-slate-400 truncate select-all" title={authStatus.publicSharingUrl}>
                        {authStatus.publicSharingUrl}
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSavePublicLink} className="space-y-2">
                      <label className="text-xs text-slate-400 font-semibold block">
                        Conectar via Link de Pasta do Google Drive
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="Cole o link de uma pasta pública do Google Drive..."
                          value={publicLinkInput}
                          onChange={(e) => setPublicLinkInput(e.target.value)}
                          className="flex-1 text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                        />
                        <button
                          type="submit"
                          disabled={isSubmittingLink || !publicLinkInput.trim()}
                          className="px-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold rounded-lg text-xs transition shrink-0"
                        >
                          {isSubmittingLink ? 'Salvando...' : 'Aplicar'}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        💡 <b>Dica:</b> A pasta deve estar configurada como "Qualquer pessoa com o link pode ver". Se houver erro, a <button type="button" onClick={() => setShowCredentialsHelp(true)} className="text-blue-400 hover:underline">chave de API do Google</button> pode não estar configurada no servidor.
                      </p>
                    </form>
                  )}
                </div>
                {/* Slideshow Actions */}
                <div className="mt-5 space-y-2.5">
                  <button
                    onClick={() => {
                      if (mediaFiles.length === 0) {
                        alert('Esta pasta não contém nenhuma imagem para exibir no slideshow.');
                        return;
                      }
                      setSlideshowMode(true);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold rounded-xl text-sm transition-all shadow-lg hover:shadow-blue-500/10 flex items-center justify-center space-x-2 group"
                  >
                    <Maximize2 className="w-4 h-4 group-hover:scale-110 transition" />
                    <span>Iniciar Porta-Retrato Digital</span>
                  </button>
                  <button
                    onClick={() => {
                      const url = new URL(window.location.href);
                      url.searchParams.set('view', '1');
                      url.searchParams.set('speed', transitionSpeed.toString());
                      url.searchParams.set('effect', transitionEffect);
                      url.searchParams.set('filename', showFileName.toString());
                      url.searchParams.set('clock', showClock.toString());
                      url.searchParams.set('ui', showUiInSlideshow.toString());
                      url.searchParams.set('refresh', autoRefresh.toString());
                      url.searchParams.set('rate', autoRefreshRate.toString());
                      navigator.clipboard.writeText(url.toString());
                      alert('Link copiado para a área de transferência! Envie para quem você quiser para acessar diretamente no modo de visualização com as configurações atuais.');
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center space-x-2 border border-slate-700 hover:border-slate-600"
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span>Copiar Link de Visualização Direta</span>
                  </button>
                  <p className="text-center text-[11px] text-slate-500 italic mt-2">
                    Perfeito para telas inteiras, TVs, monitores de escritório ou tablets.
                  </p>
                </div>
              </div>
              {/* Box B: Display Options & Slideshow Properties */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm space-y-5" id="slideshow-options-card">
                <h3 className="font-bold text-sm tracking-wide text-slate-300 uppercase border-b border-slate-800/80 pb-2 flex items-center space-x-1.5">
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Ajustes do Porta-Retrato</span>
                </h3>
                {/* Slide Transition Speed */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-semibold block">Tempo de Transição</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[3000, 5000, 10000, 30000, 120000].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setTransitionSpeed(speed)}
                        className={`py-1.5 px-1 rounded-lg text-xs font-mono font-semibold transition ${
                          transitionSpeed === speed 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {speed >= 60000 ? `${speed / 60000}m` : `${speed / 1000}s`}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Transition Effect Style */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-semibold block">Estilo de Transição</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['fade', 'zoom', 'slide'] as const).map((effect) => (
                      <button
                        key={effect}
                        onClick={() => setTransitionEffect(effect)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold capitalize transition ${
                          transitionEffect === effect 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {effect === 'fade' ? 'Suave' : effect === 'zoom' ? 'Zoom' : 'Slide'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Slideshow Toggles */}
                <div className="space-y-3 pt-2">
                  {/* Toggle Show Clock */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-xs text-slate-400 group-hover:text-slate-300 transition">Exibir Relógio UTC</span>
                    <input 
                      type="checkbox" 
                      checked={showClock}
                      onChange={(e) => setShowClock(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500/30 w-4 h-4 cursor-pointer"
                    />
                  </label>
                  {/* Toggle Show Filename */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-xs text-slate-400 group-hover:text-slate-300 transition">Exibir Título da Imagem</span>
                    <input 
                      type="checkbox" 
                      checked={showFileName}
                      onChange={(e) => setShowFileName(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500/30 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
                {/* Polling / Auto-refresh rate config */}
                <div className="border-t border-slate-800/80 pt-4 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400 group-hover:text-slate-300 transition">Atualização Automática</span>
                      <span className="text-[10px] text-slate-500">Detecta novas fotos sozinhas</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500/30 w-4 h-4 cursor-pointer"
                    />
                  </label>
                  {autoRefresh && (
                    <div className="space-y-1.5 animate-fadeIn">
                      <span className="text-[10px] text-slate-500 block">Frequência de Varredura</span>
                      <select
                        value={autoRefreshRate}
                        onChange={(e) => setAutoRefreshRate(Number(e.target.value))}
                        className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-300 rounded-lg p-2 focus:ring-blue-500/30 focus:border-blue-500/50"
                      >
                        <option value={10000}>A cada 10 segundos</option>
                        <option value={30000}>A cada 30 segundos</option>
                        <option value={60000}>A cada 1 minuto</option>
                        <option value={300000}>A cada 5 minutos</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Train Departure Alert Schedule Config */}
                <div className="border-t border-slate-800/80 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-300 font-bold block">Aviso de Trens / KPC</span>
                      <span className="text-[10px] text-slate-500">Pausa imagens e mostra alerta aos 15 min</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTestAlertActive(!testAlertActive)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                        testAlertActive
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {testAlertActive ? 'Desativar Teste' : '🧪 Testar Alerta (15m)'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {trainSchedules.map((scheduleStr) => (
                      <span
                        key={scheduleStr}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono font-semibold text-slate-300"
                      >
                        <span>{scheduleStr}h</span>
                        <button
                          type="button"
                          onClick={() => setTrainSchedules(trainSchedules.filter(s => s !== scheduleStr))}
                          className="text-slate-500 hover:text-rose-400 ml-1 font-bold"
                          title="Remover horário"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <input
                      type="time"
                      value={newScheduleInput}
                      onChange={(e) => setNewScheduleInput(e.target.value)}
                      className="text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2 focus:ring-blue-500/30 focus:border-blue-500/50 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newScheduleInput && !trainSchedules.includes(newScheduleInput)) {
                          setTrainSchedules([...trainSchedules, newScheduleInput].sort());
                          setNewScheduleInput('');
                        }
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700 shrink-0"
                    >
                      Adicionar Horário
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* Col 2: Live Files list & Preview screen (8 Cols) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Section A: Live Image Carousel preview */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm flex flex-col h-72 sm:h-96 relative group" id="quick-preview-panel">
                {kpcData ? (
                  <div className="flex-1 bg-gradient-to-br from-slate-950 via-red-950/90 to-black p-6 flex flex-col items-center justify-center text-center relative overflow-hidden border border-red-500/40">
                    <div className="p-3 bg-red-600/20 border border-red-500/50 rounded-full text-amber-300 mb-2 animate-pulse">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-mono text-red-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      Aviso de Trem Ativo (Faltam &lt; 15 min)
                    </span>
                    <h4 className="font-bold text-slate-100 text-base sm:text-lg max-w-md mb-2">
                      {kpcData.message}
                    </h4>
                    <div className="bg-black/80 border-2 border-amber-500/50 px-6 sm:px-8 py-2 rounded-2xl my-2 shadow-2xl backdrop-blur-md">
                      <span className="text-[10px] text-amber-400 font-mono uppercase tracking-widest block mb-0.5">Tempo Restante para Partida</span>
                      <span className="text-3xl sm:text-5xl font-mono font-black text-amber-300 tracking-wider">
                        {kpcData.formattedTimer}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Exibição de fotos pausada até as {kpcData.targetTime}h
                    </p>
                    <button
                      onClick={() => setSlideshowMode(true)}
                      className="mt-3 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-lg"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Ver Alerta em Tela Cheia</span>
                    </button>
                  </div>
                ) : mediaFiles.length > 0 ? (
                  <>
                    {/* Live Slide */}
                    <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center">
                      <div
                        className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out ${
                          isFadingOut ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-none'
                        }`}
                        style={{
                          transform: !isFadingOut && transitionEffect === 'zoom' ? 'scale(1.02)' : undefined,
                        }}
                      >
                        {mediaFiles[renderedIndex]?.isVideo ? (
                          <video
                            src={mediaFiles[renderedIndex]?.downloadUrl || ''}
                            className="max-h-full max-w-full object-contain bg-black"
                            autoPlay
                            controls
                            muted
                            playsInline
                            loop
                          />
                        ) : mediaFiles[renderedIndex]?.isPdf ? (
                          <iframe
                            src={mediaFiles[renderedIndex]?.downloadUrl}
                            className="w-full h-full border-none bg-white"
                          />
                        ) : (
                          <img
                            src={mediaFiles[renderedIndex]?.downloadUrl || '/placeholder.jpg'}
                            alt={mediaFiles[renderedIndex]?.name}
                            className="max-h-full max-w-full object-contain"
                            id="preview-img-tag"
                          />
                        )}
                      </div>
                      {/* Dark overlay gradients */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 flex flex-col justify-end z-10" id="preview-text-overlay">
                        <span className="text-[11px] font-mono uppercase text-blue-400 tracking-wider">Miniatura de Slideshow</span>
                        <h4 className="font-bold text-slate-100 text-sm sm:text-base line-clamp-1 mt-0.5">
                          {mediaFiles[renderedIndex]?.name}
                        </h4>
                      </div>
                    </div>
                    {/* Quick navigation arrows on hover */}
                    <div className="absolute inset-y-0 left-0 right-0 flex justify-between items-center px-4 opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none">
                      <button
                        onClick={handlePrevSlide}
                        className="p-1.5 bg-black/60 rounded-full hover:bg-black/80 text-white transition pointer-events-auto shadow-md"
                        title="Imagem anterior"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleNextSlide}
                        className="p-1.5 bg-black/60 rounded-full hover:bg-black/80 text-white transition pointer-events-auto shadow-md"
                        title="Próxima imagem"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                    {/* Footer Carousel controllers */}
                    <div className="bg-slate-900 px-4 py-3 border-t border-slate-800 flex items-center justify-between" id="preview-controllers">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setIsPlaying(!isPlaying)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition"
                        >
                          {isPlaying ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
                        </button>
                        <span className="text-xs text-slate-400 font-mono">
                          Slide {currentSlideIndex + 1} de {mediaFiles.length}
                        </span>
                      </div>
                      <button
                        onClick={() => setSlideshowMode(true)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Tela Inteira</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center text-center p-6" id="no-images-view">
                    <ImageIcon className="w-12 h-12 text-slate-700 mb-3" />
                    <h4 className="font-bold text-slate-400">Nenhuma Imagem Localizada</h4>
                    <p className="text-xs text-slate-600 max-w-sm mt-1">
                      Adicione fotos (JPEG, PNG, WEBP) à pasta selecionada para ver as transições automáticas.
                    </p>
                  </div>
                )}
              </div>
              {/* Section B: General Files and Documents List Table */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm" id="files-list-panel">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-base text-slate-200">
                      Arquivos do Diretório
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Visualização de todos os formatos presentes na pasta
                    </p>
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition border border-slate-800 bg-slate-900 disabled:opacity-50"
                    title="Recarregar lista"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                {/* File Error Alert Banner */}
                {fileError && (
                  <div className="mb-4 bg-rose-950/40 border border-rose-500/50 text-rose-200 p-5 rounded-xl flex flex-col items-center justify-center text-center space-y-3 shadow-lg" id="file-error-banner">
                    <Info className="w-8 h-8 text-rose-400 shrink-0" />
                    <div className="text-sm">
                      <span className="font-bold block text-rose-300 text-base mb-2">Erro de Acesso ao Google Drive</span> 
                      <p className="leading-relaxed max-w-lg mx-auto">{fileError}</p>
                    </div>
                  </div>
                )}
                {isLoadingFiles ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500" id="loading-spinner">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="text-xs font-mono">Sincronizando arquivos...</span>
                  </div>
                ) : files.length > 0 ? (
                  <div className="overflow-x-auto" id="files-table-container">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider font-bold">
                          <th className="pb-3 pt-1">Nome</th>
                          <th className="pb-3 pt-1 hidden sm:table-cell">Mime-Type</th>
                          <th className="pb-3 pt-1 text-right">Tamanho</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {files.map((file) => (
                          <tr 
                            key={file.id}
                            onClick={() => setSelectedDoc(file)}
                            className="hover:bg-slate-800/40 cursor-pointer text-slate-300 hover:text-white transition group"
                          >
                            <td className="py-3 pr-2 flex items-center space-x-3 max-w-[200px] sm:max-w-[320px]">
                              <div className="p-1.5 bg-slate-950/60 rounded-md border border-slate-800 group-hover:border-slate-700 shrink-0">
                                {renderFileIcon(file)}
                              </div>
                              <span className="truncate font-medium text-sm">
                                {file.name}
                              </span>
                            </td>
                            <td className="py-3 hidden sm:table-cell text-xs text-slate-500 font-mono">
                              {file.mimeType.split(';')[0]}
                            </td>
                            <td className="py-3 text-right text-xs text-slate-400 font-mono">
                              {formatBytes(file.size)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center text-slate-600" id="empty-directory-view">
                    <Folder className="w-10 h-10 text-slate-700 mb-2" />
                    <span className="text-sm font-medium">Pasta vazia ou sem acesso</span>
                    <p className="text-xs max-w-xs mt-1">
                      Adicione arquivos ao diretório no OneDrive para visualizá-los aqui.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      ) : (
        // 3. IMMERSIVE FULL-SCREEN PORTRAIT SLIDESHOW SCREEN
        <div className="fixed inset-0 bg-black z-50 flex flex-col justify-between select-none overflow-hidden" id="full-slideshow-canvas">
          {kpcData ? (
            <div className="absolute inset-0 z-50 bg-gradient-to-br from-slate-950 via-red-950/95 to-black flex flex-col items-center justify-center p-6 sm:p-12 text-center animate-fadeIn select-none">
              {/* Alert Ring Icon */}
              <div className="relative mb-6 sm:mb-8">
                <div className="absolute inset-0 rounded-full bg-red-600/30 animate-ping blur-xl" />
                <div className="relative p-5 sm:p-7 bg-red-600/20 border-2 border-red-500/60 rounded-full text-red-400 shadow-2xl backdrop-blur-md">
                  <AlertTriangle className="w-16 h-16 sm:w-20 sm:h-20 text-amber-300 animate-pulse" />
                </div>
              </div>

              {/* Title & Badge */}
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 font-mono text-xs sm:text-sm font-bold uppercase tracking-widest mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
                <span>Alerta de Partida de Trem</span>
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-100 max-w-4xl tracking-tight leading-tight mb-3">
                {kpcData.message}
              </h1>

              <p className="text-xs sm:text-sm md:text-base text-slate-400 max-w-xl mb-8">
                A exibição de fotos foi pausada temporariamente para o alerta. As imagens voltarão a ser exibidas normalmente assim que passar a hora de partida.
              </p>

              {/* GIANT CRONÔMETRO COUNTDOWN TIMER */}
              <div className="bg-black/80 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-10 md:p-12 shadow-2xl backdrop-blur-2xl flex flex-col items-center space-y-2 max-w-2xl w-full my-2">
                <span className="text-xs sm:text-sm text-amber-400 uppercase font-mono tracking-widest font-bold">
                  Tempo Restante para a Partida
                </span>
                <div className="text-6xl sm:text-8xl md:text-9xl font-mono font-black text-amber-300 tracking-wider drop-shadow-[0_0_35px_rgba(245,158,11,0.5)] my-2">
                  {kpcData.formattedTimer}
                </div>
                <span className="text-xs sm:text-sm text-slate-300 font-mono">
                  Horário de Partida: <b>{kpcData.targetTime}h</b>
                </span>
              </div>

              {/* Optional Exit Button */}
              {!isDirectView && (
                <button
                  onClick={() => setSlideshowMode(false)}
                  className="mt-8 px-5 py-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 text-xs font-semibold transition flex items-center space-x-2"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span>Sair da Tela Cheia</span>
                </button>
              )}
            </div>
          ) : mediaFiles.length > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              {/* Dynamic transitions mapped with custom animations */}
              <div 
                className={`absolute inset-0 flex items-center justify-center p-2 sm:p-4 transition-all duration-500 ease-in-out ${
                  isFadingOut 
                    ? 'opacity-0 blur-sm' 
                    : 'opacity-100 blur-none'
                }`}
                style={{
                  transform: isFadingOut
                    ? (transitionEffect === 'zoom' ? 'scale(0.95)' : transitionEffect === 'slide' ? 'translateX(-30px)' : 'none')
                    : (transitionEffect === 'zoom' ? 'scale(1.02)' : 'none'),
                }}
              >
                {mediaFiles[renderedIndex]?.isVideo ? (
                  <video
                    src={mediaFiles[renderedIndex]?.downloadUrl || ''}
                    className="max-h-full max-w-full object-contain shadow-2xl bg-black"
                    autoPlay
                    controls
                    muted
                    playsInline
                    onEnded={isPlaying ? handleNextSlide : undefined}
                    onError={(e) => {
                      console.error('Video error:', e);
                      // Skip to next slide if video fails
                      if (isPlaying) setTimeout(handleNextSlide, 3000);
                    }}
                  />
                ) : mediaFiles[renderedIndex]?.isPdf ? (
                  <iframe
                    src={mediaFiles[renderedIndex]?.downloadUrl}
                    className="w-full h-full border-none bg-white shadow-2xl"
                  />
                ) : (
                  <img
                    src={mediaFiles[renderedIndex]?.downloadUrl || '/placeholder.jpg'}
                    alt={mediaFiles[renderedIndex]?.name}
                    className="max-h-full max-w-full object-contain shadow-2xl"
                    id="active-slideshow-img"
                  />
                )}
              </div>
              {/* Preload Next Media */}
              <div className="hidden" aria-hidden="true" style={{ display: 'none' }}>
                {mediaFiles[(currentSlideIndex + 1) % mediaFiles.length]?.isVideo ? (
                  <video src={mediaFiles[(currentSlideIndex + 1) % mediaFiles.length]?.downloadUrl || ''} preload="metadata" muted />
                ) : (
                  <img src={mediaFiles[(currentSlideIndex + 1) % mediaFiles.length]?.downloadUrl || ''} />
                )}
              </div>
              <div 
                className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 sm:p-10 flex flex-col sm:flex-row sm:items-end justify-between space-y-4 sm:space-y-0 transition-opacity duration-500 ${
                  showUiInSlideshow ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                }`}
                id="slideshow-hud-overlay"
              >
                {/* Filename caption */}
                {showFileName ? (
                  <div className="max-w-2xl">
                    <span className="text-xs text-blue-400 font-mono tracking-wider block uppercase mb-1">
                      {resolvedFolderName || authStatus.selectedFolder?.name || 'OneDrive Live Panel'}
                    </span>
                    <h2 className="text-lg sm:text-2xl font-bold text-slate-100 line-clamp-1">
                      {mediaFiles[renderedIndex]?.name}
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      Atualizado em: {new Date(mediaFiles[renderedIndex]?.lastModified).toLocaleString('pt-BR')} • {formatBytes(mediaFiles[renderedIndex]?.size)}
                    </p>
                  </div>
                ) : (
                  <div className="h-4" />
                )}
                {/* Clock Overlay */}
                {showClock && (
                  <div className="flex items-center space-x-3.5 bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/5 shadow-inner shrink-0 sm:self-end">
                    <Clock className="w-5 h-5 text-blue-400 animate-spin" style={{ animationDuration: '6s' }} />
                    <div className="text-right">
                      <span className="text-xl sm:text-2xl font-mono font-bold tracking-wider text-slate-200">
                        {currentTime}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">
                        UTC-Local
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {/* Top Controls Quick Overlay */}
              <div 
                className={`absolute top-4 right-4 z-30 flex items-center space-x-2 bg-black/60 backdrop-blur-md p-1.5 rounded-xl border border-white/5 transition-opacity duration-500 ${
                  showUiInSlideshow ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                }`}
                id="slideshow-hud-top"
              >
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
                  title={isPlaying ? 'Pausar' : 'Iniciar'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
                </button>
                <button
                  onClick={handlePrevSlide}
                  className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
                  title="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-1 text-slate-400">
                  {currentSlideIndex + 1}/{mediaFiles.length}
                </span>
                <button
                  onClick={handleNextSlide}
                  className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
                  title="Próximo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="h-4 w-px bg-white/10 mx-1" />
                {!isDirectView && (
                  <button
                    onClick={() => setSlideshowMode(false)}
                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition flex items-center space-x-1 text-xs font-bold px-3"
                    title="Sair da tela cheia"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Sair</span>
                  </button>
                )}
              </div>
              {/* Quick UI auto-hide overlay sensor */}
              <div 
                className="absolute inset-x-0 top-0 h-24 cursor-pointer"
                onClick={() => setShowUiInSlideshow(!showUiInSlideshow)}
                title="Clique para alternar barras de controle"
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
              <ImageIcon className="w-16 h-16 text-slate-700 mb-4" />
              <h2 className="text-slate-300 font-bold text-lg">Sem Imagens para o Slideshow</h2>
              <button
                onClick={() => setSlideshowMode(false)}
                className="mt-4 px-4 py-2 bg-blue-600 rounded-lg text-white font-semibold text-sm"
              >
                Voltar ao Painel
              </button>
            </div>
          )}
        </div>
      )}
      {/* 5. MODAL: GOOGLE API KEY INSTRUCTIONS */}
      {showCredentialsHelp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" id="credentials-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-100">
                    Como gerar a Chave de API do Google
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Necessária para buscar arquivos em pastas públicas do Google Drive
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowCredentialsHelp(false)}
                className="text-slate-500 hover:text-slate-300 text-xl font-bold font-mono transition"
              >
                &times;
              </button>
            </div>
            {/* Steps Instruction */}
            <div className="space-y-5 text-sm leading-relaxed text-slate-300 max-h-[440px] overflow-y-auto pr-2" id="modal-steps-container">
              <div className="bg-blue-950/20 border border-blue-500/10 rounded-xl p-4 flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300">
                  Para que o site consiga listar e baixar os arquivos da pasta que você forneceu, precisamos de uma Chave de API pública com o Google Drive ativado. Nenhuma autenticação (OAuth) é necessária, pois a pasta é pública.
                </div>
              </div>
              {/* Step 1 */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-200 flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-blue-400 flex items-center justify-center font-mono text-xs">1</span>
                  <span>Acesse o Google Cloud Console</span>
                </h4>
                <p className="text-xs text-slate-400 pl-7">
                  Vá para o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center">Google Cloud Console <ExternalLink className="w-3 h-3 ml-0.5" /></a> e crie um novo projeto (ou selecione um já existente).
                </p>
              </div>
              {/* Step 2 */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-200 flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-blue-400 flex items-center justify-center font-mono text-xs">2</span>
                  <span>Ative a API do Google Drive</span>
                </h4>
                <p className="text-xs text-slate-400 pl-7">
                  No menu lateral esquerdo, vá em <b>APIs e Serviços</b> &gt; <b>Biblioteca</b>. Pesquise por "Google Drive API", clique no resultado e depois em <b>Ativar</b>.
                </p>
              </div>
              {/* Step 3 */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-200 flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-blue-400 flex items-center justify-center font-mono text-xs">3</span>
                  <span>Crie as Credenciais</span>
                </h4>
                <p className="text-xs text-slate-400 pl-7">
                  Ainda em <b>APIs e Serviços</b>, clique em <b>Credenciais</b> no menu da esquerda. Depois clique no botão no topo <b>+ CRIAR CREDENCIAIS</b> e escolha <b>Chave de API</b>. Copie a chave gerada.
                </p>
              </div>
              {/* Step 4 */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-200 flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-blue-400 flex items-center justify-center font-mono text-xs">4</span>
                  <span>Configure no App</span>
                </h4>
                <p className="text-xs text-slate-400 pl-7">
                  Insira a chave no painel de <b>Secrets / Variáveis de Ambiente</b> do Google AI Studio com o seguinte nome:
                </p>
                <div className="pl-7 mt-2">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 font-mono text-xs inline-block">
                    <span className="text-[10px] text-slate-500 block uppercase font-sans mb-1">Nome da Variável:</span>
                    GOOGLE_API_KEY
                  </div>
                </div>
              </div>
            </div>
            {/* Modal action footer */}
            <div className="mt-7 pt-4 border-t border-slate-800/80 flex justify-end">
              <button
                onClick={() => setShowCredentialsHelp(false)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/10 rounded-lg text-sm font-bold transition-all"
              >
                Entendi, Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 6. MODAL: DETAILED FILE INSPECTOR (For documents and metadata) */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" id="file-inspector-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setSelectedDoc(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-xl font-bold font-mono"
            >
              &times;
            </button>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                {renderFileIcon(selectedDoc)}
              </div>
              <div>
                <h3 className="font-bold text-slate-200 text-base line-clamp-2 px-2">
                  {selectedDoc.name}
                </h3>
                <span className="text-xs text-slate-500 font-mono mt-1 block">
                  ID: {selectedDoc.id}
                </span>
              </div>
              {/* Attributes Grid */}
              <div className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-left font-mono space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Formato:</span>
                  <span className="text-slate-300 truncate max-w-[200px]">{selectedDoc.mimeType.split(';')[0]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tamanho:</span>
                  <span className="text-slate-300">{formatBytes(selectedDoc.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Última Modif.:</span>
                  <span className="text-slate-300">{new Date(selectedDoc.lastModified).toLocaleString('pt-BR')}</span>
                </div>
              </div>
              {/* Action Buttons */}
              <div className="w-full flex space-x-2 pt-2">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="flex-1 py-2.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-semibold transition"
                >
                  Fechar
                </button>
                {selectedDoc.downloadUrl ? (
                  <a
                    href={selectedDoc.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg text-center shadow-lg shadow-blue-500/10 flex items-center justify-center space-x-1"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Baixar Arquivo</span>
                  </a>
                ) : (
                  <a
                    href={selectedDoc.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg text-center border border-slate-700/50 flex items-center justify-center space-x-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ver no Google Drive</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* FOOTER */}
      {!slideshowMode && (
        <footer className="border-t border-slate-900 bg-slate-950 py-5 px-4 text-center text-xs text-slate-500" id="app-footer">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="font-mono">Google Drive Canvas • 2026</span>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowCredentialsHelp(true)}
                className="hover:text-slate-400 transition underline underline-offset-2"
              >
                Como configurar a API
              </button>
              <span className="text-slate-700">•</span>
              <span className="text-slate-600 font-mono">Status: {authStatus.isDemo ? 'Ativo em Demo' : 'Conectado a Pasta Pública'}</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
