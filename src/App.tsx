import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Cloud, 
  Folder, 
  FolderOpen, 
  FolderPlus,
  Building2,
  MapPin,
  Copy,
  Pencil,
  Trash2,
  Plus,
  X,
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
  AlertTriangle,
  Volume2,
  VolumeX,
  Train,
  Radio,
  Bell,
  ListPlus,
  CheckCircle2,
  Maximize,
  Minimize,
  Scaling
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
interface TrainAlert {
  id: string;
  prefix: string;
  time: string;
  status?: string;
  active?: boolean;
}
interface Sede {
  id: string;
  name: string;
  folderUrl: string;
  folderId: string;
  description?: string;
  trainAlerts?: TrainAlert[];
  createdAt: string;
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
  // Sedes Management States
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [activeSede, setActiveSede] = useState<Sede | null>(null);
  const [isSedeModalOpen, setIsSedeModalOpen] = useState(false);
  const [editingSede, setEditingSede] = useState<Sede | null>(null);
  const [sedeNameInput, setSedeNameInput] = useState('');
  const [sedeUrlInput, setSedeUrlInput] = useState('');
  const [sedeDescInput, setSedeDescInput] = useState('');
  const [isSavingSede, setIsSavingSede] = useState(false);
  const [sedeError, setSedeError] = useState<string | null>(null);
  const [copiedSedeId, setCopiedSedeId] = useState<string | null>(null);

  // Train Formation Alerts States
  const [trainAlerts, setTrainAlerts] = useState<TrainAlert[]>([]);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [selectedSedeForAlerts, setSelectedSedeForAlerts] = useState<Sede | null>(null);
  const [alertPrefixInput, setAlertPrefixInput] = useState('');
  const [alertTimeInput, setAlertTimeInput] = useState('');
  const [alertStatusInput, setAlertStatusInput] = useState('Formação Prevista');
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);
  const [showTrainAlertsTicker, setShowTrainAlertsTicker] = useLocalStorage('app_showTrainAlertsTicker', true);

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
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoFitMode, setVideoFitMode] = useLocalStorage<'cover' | 'contain' | 'fill'>('app_videoFitMode', 'cover');
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

  const toggleNativeFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => setIsNativeFullscreen(true)).catch(err => console.log('Fullscreen error:', err));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsNativeFullscreen(false)).catch(err => console.log('Exit fullscreen error:', err));
      }
    }
  };
  // Offline caching states
  const [downloadProgress, setDownloadProgress] = useState<{ total: number; loaded: number }>({ total: 0, loaded: 0 });
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'completed' | 'error'>('idle');
  const [activeBlobUrls, setActiveBlobUrls] = useState<Record<string, string>>({});
  const activeBlobUrlsRef = useRef<Record<string, string>>({});
  // UI Detail States
  const [selectedDoc, setSelectedDoc] = useState<MediaFile | null>(null);
  const [showCredentialsHelp, setShowCredentialsHelp] = useState(false);
  const [autoRefresh, setAutoRefresh] = useLocalStorage('app_autoRefresh', true);
  const [autoRefreshRate, setAutoRefreshRate] = useLocalStorage('app_autoRefreshRate', 60000); // 1 minute default
  const [currentTime, setCurrentTime] = useState('');
  // Active Refs for Slideshow Auto-play
  const autoPlayTimer = useRef<NodeJS.Timeout | null>(null);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);
  const clockTimer = useRef<NodeJS.Timeout | null>(null);
  // Filter files to images/videos only for the slideshow
  const mediaFiles = useMemo(() => files.filter(f => f.isImage || f.isVideo || f.isPdf), [files]);
  // State for simulated/preview alert mode in modal or dashboard
  const [isTestingAlert, setIsTestingAlert] = useState(false);

  // KPC Fixed Train Formation Schedule (12:00, 17:00, 19:50)
  const kpcAlerts = useMemo<TrainAlert[]>(() => [
    { id: 'kpc-1200', prefix: 'FORMAÇÃO KPC 12H', time: '12:00', status: 'Partida Programada', active: true },
    { id: 'kpc-1700', prefix: 'FORMAÇÃO KPC 17H', time: '17:00', status: 'Partida Programada', active: true },
    { id: 'kpc-1950', prefix: 'FORMAÇÃO KPC 19:50H', time: '19:50', status: 'Partida Programada', active: true },
  ], []);

  // Helper to calculate exact remaining time for a train alert
  const getAlertTimeRemaining = useCallback((timeStr: string) => {
    if (!timeStr) return null;
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return null;
    const targetHours = parseInt(parts[0], 10);
    const targetMinutes = parseInt(parts[1], 10);
    if (isNaN(targetHours) || isNaN(targetMinutes)) return null;

    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHours, targetMinutes, 0, 0);

    let diffMs = target.getTime() - now.getTime();

    // Midnight crossing adjustment
    if (diffMs < -12 * 60 * 60 * 1000) {
      target.setDate(target.getDate() + 1);
      diffMs = target.getTime() - now.getTime();
    } else if (diffMs > 12 * 60 * 60 * 1000) {
      target.setDate(target.getDate() - 1);
      diffMs = target.getTime() - now.getTime();
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    // STRICT 15-MINUTE RULE: Urgent ONLY when <= 15 minutes remaining (900s) and up to 3 minutes past departure (-180s)
    const isUrgent = totalSeconds >= -180 && totalSeconds <= 15 * 60;

    const absSecs = Math.abs(totalSeconds);
    const mins = Math.floor(absSecs / 60);
    const secs = absSecs % 60;
    const formattedCountdown = `${totalSeconds < 0 ? '-' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    return {
      totalSeconds,
      mins,
      secs,
      formattedCountdown,
      isUrgent,
      targetTimeString: timeStr
    };
  }, []);

  // Consolidate all train alerts across loaded alerts, active Sede, all Sedes, and KPC schedule
  const allActiveTrainAlerts = useMemo(() => {
    const map = new Map<string, TrainAlert>();

    // 1. KPC Fixed Schedule
    kpcAlerts.forEach(a => map.set(a.id, a));

    // 2. All Sedes
    (sedes || []).forEach(s => {
      (s.trainAlerts || []).forEach(a => {
        if (a && a.id) map.set(a.id, a);
      });
    });

    // 3. Active Sede
    (activeSede?.trainAlerts || []).forEach(a => {
      if (a && a.id) map.set(a.id, a);
    });

    // 4. Current trainAlerts state
    (trainAlerts || []).forEach(a => {
      if (a && a.id) map.set(a.id, a);
    });

    return Array.from(map.values());
  }, [trainAlerts, activeSede, sedes, kpcAlerts]);

  // Compute active train alerts that are strictly in the urgent 15-minute window
  const urgentAlerts = useMemo(() => {
    // If user clicked simulation preview, generate a test alert
    if (isTestingAlert) {
      return [{
        alert: {
          id: 'test-preview',
          prefix: 'TREM-TESTE 15MIN',
          time: '14:30',
          status: 'TESTE DE TELA CHEIA (15 MINUTOS)',
          active: true
        },
        remaining: {
          totalSeconds: 840, // 14 mins remaining
          mins: 14,
          secs: 0,
          formattedCountdown: '14:00',
          isUrgent: true,
          targetTimeString: '14:30'
        }
      }];
    }

    if (allActiveTrainAlerts.length === 0) return [];

    return allActiveTrainAlerts
      .filter(a => a.active !== false)
      .map(alert => {
        const remaining = getAlertTimeRemaining(alert.time);
        return { alert, remaining };
      })
      .filter((item): item is { alert: TrainAlert; remaining: NonNullable<ReturnType<typeof getAlertTimeRemaining>> } => 
        item.remaining !== null && item.remaining.isUrgent
      )
      .sort((a, b) => a.remaining.totalSeconds - b.remaining.totalSeconds);
  }, [allActiveTrainAlerts, currentTime, getAlertTimeRemaining, isTestingAlert]);

  // KPC Banner only when in 15-minute window
  const kpcData = useMemo(() => {
    const kpcUrgent = urgentAlerts.find(u => u.alert.id.startsWith('kpc-'));
    if (kpcUrgent) {
      return {
        message: `Atenção: ${kpcUrgent.alert.prefix} em ${kpcUrgent.remaining.mins} min!`,
        timer: kpcUrgent.remaining.formattedCountdown
      };
    }
    return null;
  }, [urgentAlerts]);

  // Fetch Sedes
  const fetchSedes = useCallback(async () => {
    try {
      const res = await fetch('/api/sedes');
      if (res.ok) {
        const data = await res.json();
        setSedes(data.sedes || []);
      }
    } catch (e) {
      console.error('Erro ao buscar sedes:', e);
    }
  }, []);

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

  // Fetch Files in Selected Folder or Sede
  const fetchFiles = useCallback(async (silent = false, sedeIdOverride?: string) => {
    if (!silent) setIsLoadingFiles(true);
    setFileError(null);
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const targetSedeId = sedeIdOverride || activeSede?.id || searchParams.get('sede');
      const url = targetSedeId 
        ? `/api/drive/files?sedeId=${encodeURIComponent(targetSedeId)}` 
        : '/api/drive/files';

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setFileError(data.error);
        }
        setFiles(data.files || []);
        setResolvedFolderName(data.folderName || '');

        if (Array.isArray(data.trainAlerts)) {
          setTrainAlerts(data.trainAlerts);
        } else if (data.sede?.trainAlerts) {
          setTrainAlerts(data.sede.trainAlerts);
        }
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
  }, [activeSede]);

  // Train Formation Alerts Action Handlers
  const handleOpenAlertsModal = (sede: Sede, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedSedeForAlerts(sede);
    setAlertPrefixInput('');
    setAlertTimeInput('');
    setAlertStatusInput('Formação Prevista');
    setIsAlertsModalOpen(true);
  };

  const handleAddAlertToSede = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSedeForAlerts || !alertPrefixInput.trim() || !alertTimeInput.trim()) return;

    const newAlert: TrainAlert = {
      id: 'alert-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 5),
      prefix: alertPrefixInput.trim().toUpperCase(),
      time: alertTimeInput.trim(),
      status: alertStatusInput.trim() || 'Formação Prevista',
      active: true,
    };

    const updatedAlerts = [...(selectedSedeForAlerts.trainAlerts || []), newAlert];

    setIsSavingAlerts(true);
    try {
      const res = await fetch(`/api/sedes/${selectedSedeForAlerts.id}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainAlerts: updatedAlerts }),
      });

      if (res.ok) {
        const data = await res.json();
        setSedes(data.sedes || []);
        const updatedSede = (data.sedes || []).find((s: Sede) => s.id === selectedSedeForAlerts.id);
        if (updatedSede) {
          setSelectedSedeForAlerts(updatedSede);
          if (activeSede?.id === updatedSede.id) {
            setActiveSede(updatedSede);
            setTrainAlerts(updatedSede.trainAlerts || []);
          }
        }
        setAlertPrefixInput('');
        setAlertTimeInput('');
      }
    } catch (err) {
      console.error('Erro ao salvar alerta de trem:', err);
    } finally {
      setIsSavingAlerts(false);
    }
  };

  const handleToggleAlertStatus = async (alertId: string) => {
    if (!selectedSedeForAlerts) return;
    const currentAlerts = selectedSedeForAlerts.trainAlerts || [];
    const updatedAlerts = currentAlerts.map(a => a.id === alertId ? { ...a, active: a.active === false ? true : false } : a);

    try {
      const res = await fetch(`/api/sedes/${selectedSedeForAlerts.id}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainAlerts: updatedAlerts }),
      });

      if (res.ok) {
        const data = await res.json();
        setSedes(data.sedes || []);
        const updatedSede = (data.sedes || []).find((s: Sede) => s.id === selectedSedeForAlerts.id);
        if (updatedSede) {
          setSelectedSedeForAlerts(updatedSede);
          if (activeSede?.id === updatedSede.id) {
            setActiveSede(updatedSede);
            setTrainAlerts(updatedSede.trainAlerts || []);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao alterar status do alerta:', err);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!selectedSedeForAlerts) return;
    const currentAlerts = selectedSedeForAlerts.trainAlerts || [];
    const updatedAlerts = currentAlerts.filter(a => a.id !== alertId);

    try {
      const res = await fetch(`/api/sedes/${selectedSedeForAlerts.id}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainAlerts: updatedAlerts }),
      });

      if (res.ok) {
        const data = await res.json();
        setSedes(data.sedes || []);
        const updatedSede = (data.sedes || []).find((s: Sede) => s.id === selectedSedeForAlerts.id);
        if (updatedSede) {
          setSelectedSedeForAlerts(updatedSede);
          if (activeSede?.id === updatedSede.id) {
            setActiveSede(updatedSede);
            setTrainAlerts(updatedSede.trainAlerts || []);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao excluir alerta:', err);
    }
  };

  // Sede Actions
  const handleSaveSede = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sedeNameInput.trim() || !sedeUrlInput.trim()) return;

    setIsSavingSede(true);
    setSedeError(null);

    try {
      const res = await fetch('/api/sedes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSede?.id,
          name: sedeNameInput.trim(),
          folderUrl: sedeUrlInput.trim(),
          description: sedeDescInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setSedeError(data.error || 'Erro ao salvar sede.');
      } else {
        setSedes(data.sedes || []);
        setIsSedeModalOpen(false);
        setEditingSede(null);
        setSedeNameInput('');
        setSedeUrlInput('');
        setSedeDescInput('');
      }
    } catch (err: any) {
      setSedeError(err.message || 'Erro ao salvar sede.');
    } finally {
      setIsSavingSede(false);
    }
  };

  const handleDeleteSede = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Deseja realmente remover esta sede?')) return;

    try {
      const res = await fetch(`/api/sedes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setSedes(data.sedes || []);
        if (activeSede?.id === id) {
          setActiveSede(null);
        }
      }
    } catch (err) {
      console.error('Erro ao deletar sede:', err);
    }
  };

  const handleOpenSedeSlideshow = (sede: Sede, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveSede(sede);
    fetchFiles(false, sede.id);
    setSlideshowMode(true);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const handleSelectSedeDashboard = (sede: Sede) => {
    setActiveSede(sede);
    fetchFiles(false, sede.id);
  };

  const handleCopySedeLink = (sede: Sede, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?sede=${sede.id}&view=1&videofit=${videoFitMode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedSedeId(sede.id);
      setTimeout(() => setCopiedSedeId(null), 2500);
    }).catch(err => console.error('Erro ao copiar link:', err));
  };

  const handleOpenCreateSedeModal = () => {
    setEditingSede(null);
    setSedeNameInput('');
    setSedeUrlInput('');
    setSedeDescInput('');
    setSedeError(null);
    setIsSedeModalOpen(true);
  };

  const handleOpenEditSedeModal = (sede: Sede, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSede(sede);
    setSedeNameInput(sede.name);
    setSedeUrlInput(sede.folderUrl);
    setSedeDescInput(sede.description || '');
    setSedeError(null);
    setIsSedeModalOpen(true);
  };

  // Trigger manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchFiles(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Load initial status and files
  useEffect(() => {
    fetchAuthStatus();
    fetchSedes();
    // Check URL for direct view mode or target sede
    const searchParams = new URLSearchParams(window.location.search);
    const searchSede = searchParams.get('sede');
    if (searchParams.get('view') === '1' || searchParams.get('view') === 'true' || searchSede) {
      if (searchSede) {
        fetchFiles(false, searchSede);
      }
      setSlideshowMode(true);
      setIsDirectView(true);
      if (searchParams.has('speed')) setTransitionSpeed(Number(searchParams.get('speed')));
      if (searchParams.has('effect')) setTransitionEffect(searchParams.get('effect') as any);
      if (searchParams.has('filename')) setShowFileName(searchParams.get('filename') === 'true');
      if (searchParams.has('clock')) setShowClock(searchParams.get('clock') === 'true');
      if (searchParams.has('ui')) setShowUiInSlideshow(searchParams.get('ui') === 'true');
      if (searchParams.has('refresh')) setAutoRefresh(searchParams.get('refresh') === 'true');
      if (searchParams.has('rate')) setAutoRefreshRate(Number(searchParams.get('rate')));
      if (searchParams.has('videofit')) setVideoFitMode(searchParams.get('videofit') as any);
    }
  }, [fetchAuthStatus, fetchSedes]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsNativeFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

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
  }, [isPlaying, slideshowMode, transitionSpeed, currentSlideIndex, handleNextSlide, mediaFilesSignature]);

  // Utility to resolve the fastest media URL (local blob URL if cached, remote downloadUrl if not yet cached)
  const getMediaSrc = useCallback((file: MediaFile | undefined) => {
    if (!file) return '';
    if (!file.downloadUrl) return '';
    return activeBlobUrls[file.downloadUrl] || file.downloadUrl;
  }, [activeBlobUrls]);

  // 1. Background Caching Effect: Proactively downloads all media files into Cache Storage
  useEffect(() => {
    if (mediaFiles.length === 0) return;
    
    let active = true;
    const cacheStorageName = 'tv-slideshow-media-v1';
    
    const runBackgroundCaching = async () => {
      if (typeof window === 'undefined' || !('caches' in window)) return;
      
      setDownloadProgress({ total: mediaFiles.length, loaded: 0 });
      setDownloadStatus('downloading');
      
      try {
        const cache = await caches.open(cacheStorageName);
        let count = 0;
        
        // Count already cached files
        for (const file of mediaFiles) {
          if (!file.downloadUrl) continue;
          const cachedResponse = await cache.match(file.downloadUrl);
          if (cachedResponse) {
            count++;
          }
        }
        if (active) setDownloadProgress({ total: mediaFiles.length, loaded: count });
        
        // Download rest sequentially so we don't clog up TV network threads
        for (const file of mediaFiles) {
          if (!active) break;
          if (!file.downloadUrl) continue;
          
          const cachedResponse = await cache.match(file.downloadUrl);
          if (!cachedResponse) {
            try {
              const res = await fetch(file.downloadUrl);
              if (res.ok) {
                await cache.put(file.downloadUrl, res);
                count++;
                if (active) setDownloadProgress({ total: mediaFiles.length, loaded: count });
              }
            } catch (err) {
              console.error('Failed to pre-cache file in background:', file.name, err);
            }
          }
        }
        
        if (active) setDownloadStatus('completed');
      } catch (err) {
        console.error('Error in background caching:', err);
        if (active) setDownloadStatus('error');
      }
    };
    
    runBackgroundCaching();
    
    return () => {
      active = false;
    };
  }, [mediaFilesSignature]);

  // 2. Active Slide Window Blob Manager: Generates blob URLs on-demand for current and adjacent slides
  useEffect(() => {
    if (mediaFiles.length === 0) return;
    
    let active = true;
    const cacheStorageName = 'tv-slideshow-media-v1';
    
    const updateActiveBlobs = async () => {
      if (typeof window === 'undefined' || !('caches' in window)) return;
      
      // We want to keep active blob URLs in RAM for current, next, and previous slides only
      const indicesToLoad = new Set<number>();
      indicesToLoad.add(renderedIndex);
      indicesToLoad.add(currentSlideIndex);
      indicesToLoad.add((currentSlideIndex + 1) % mediaFiles.length);
      indicesToLoad.add((currentSlideIndex - 1 + mediaFiles.length) % mediaFiles.length);
      
      const neededUrls = new Set<string>();
      indicesToLoad.forEach(idx => {
        const file = mediaFiles[idx];
        if (file && file.downloadUrl) {
          neededUrls.add(file.downloadUrl);
        }
      });
      
      const cache = await caches.open(cacheStorageName);
      const currentBlobs = activeBlobUrlsRef.current;
      const newBlobUrls: Record<string, string> = {};
      let hasChanges = false;
      
      // Revoke and clean up blob URLs that are no longer in our active sliding window (avoids RAM issues on Smart TVs)
      for (const url of Object.keys(currentBlobs)) {
        if (!neededUrls.has(url)) {
          URL.revokeObjectURL(currentBlobs[url]);
          hasChanges = true;
        } else {
          newBlobUrls[url] = currentBlobs[url];
        }
      }
      
      // Fetch or create Blob URLs for all active window items
      for (const url of neededUrls) {
        if (!newBlobUrls[url]) {
          try {
            let res = await cache.match(url);
            if (!res) {
              // Fallback fetch if background caching hasn't reached it yet
              res = await fetch(url);
              if (res.ok) {
                await cache.put(url, res.clone());
              }
            }
            if (res && res.ok) {
              const blob = await res.blob();
              const blobUrl = URL.createObjectURL(blob);
              newBlobUrls[url] = blobUrl;
              hasChanges = true;
            }
          } catch (err) {
            console.error('Error generating active blob URL for:', url, err);
          }
        }
      }
      
      if (active) {
        activeBlobUrlsRef.current = newBlobUrls;
        if (hasChanges) {
          setActiveBlobUrls({ ...newBlobUrls });
        }
      }
    };
    
    updateActiveBlobs();
    
    return () => {
      active = false;
    };
  }, [renderedIndex, currentSlideIndex, mediaFilesSignature]);

  // 3. Complete Cleanup on Unmount (prevents any memory leaks of Object URLs)
  useEffect(() => {
    return () => {
      const currentBlobs = activeBlobUrlsRef.current;
      for (const url of Object.keys(currentBlobs)) {
        try {
          URL.revokeObjectURL(currentBlobs[url]);
        } catch (e) {
          console.error('Failed to revoke URL on unmount:', e);
        }
      }
    };
  }, []);

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

          {/* Urgent Train Departure Banner on Dashboard */}
          {urgentAlerts.length > 0 && (
            <div className="bg-amber-500/15 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-amber-500 text-slate-950 rounded-xl font-bold animate-bounce shadow-lg shrink-0">
                  <Train className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase font-black tracking-widest text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-mono">
                      ⚠️ MODO TELA CHEIA 15 MINUTOS ATIVO
                    </span>
                    <span className="text-xs text-amber-300 font-mono font-bold animate-pulse">
                      Partida em {urgentAlerts[0].remaining.formattedCountdown}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white mt-1">
                    Prefixo: {urgentAlerts[0].alert.prefix} — Horário: {urgentAlerts[0].alert.time}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Fotos e vídeos estão ocultos na exibição. O painel exibirá somente o cronômetro até a partida.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSlideshowMode(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-xl transition shrink-0 flex items-center justify-center space-x-2"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Abrir Apresentação em Tela Cheia</span>
              </button>
            </div>
          )}

          {/* Sedes & Locais Manager Section */}
          <section className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-xl relative overflow-hidden" id="sedes-manager-section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-100 text-lg flex items-center gap-2">
                    <span>Minhas Sedes & Locais</span>
                    <span className="text-xs font-mono font-normal bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                      {sedes.length} {sedes.length === 1 ? 'sede' : 'sedes'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cadastre pastas de diferentes sedes e acesse a exibição de cada uma com 1 clique.
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpenCreateSedeModal}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-lg hover:shadow-indigo-500/10 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Nova Sede</span>
              </button>
            </div>

            {/* Sedes Cards Grid */}
            {sedes.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center space-y-3 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 mt-4">
                <div className="p-3 bg-slate-800/60 rounded-full text-slate-400">
                  <FolderPlus className="w-8 h-8" />
                </div>
                <div className="max-w-md">
                  <h3 className="font-semibold text-slate-200 text-sm">Nenhuma sede cadastrada ainda</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Adicione sua primeira sede e insira o link da pasta do Google Drive correspondente a ela.
                  </p>
                </div>
                <button
                  onClick={handleOpenCreateSedeModal}
                  className="mt-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Primeira Sede</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                {sedes.map((s) => {
                  const isCurrentActive = activeSede?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSedeDashboard(s)}
                      className={`group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                        isCurrentActive
                          ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30'
                          : 'bg-slate-950/60 hover:bg-slate-800/50 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-2.5">
                            <div className={`p-2.5 rounded-lg border shrink-0 ${
                              isCurrentActive 
                                ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' 
                                : 'bg-slate-800 border-slate-700 text-slate-300 group-hover:text-blue-400'
                            }`}>
                              <Folder className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-100 text-sm group-hover:text-white line-clamp-1">
                                {s.name}
                              </h3>
                              {s.description && (
                                <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                  {s.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Edit & Delete Action Buttons */}
                          <div className="flex items-center space-x-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                            <button
                              onClick={(e) => handleOpenEditSedeModal(s, e)}
                              className="p-1.5 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 rounded-md transition"
                              title="Editar Sede"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteSede(s.id, e)}
                              className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-md transition"
                              title="Excluir Sede"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Actions for Sede Card */}
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5 flex-wrap sm:flex-nowrap">
                        <button
                          onClick={(e) => handleOpenAlertsModal(s, e)}
                          className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-semibold transition flex items-center space-x-1.5 shrink-0"
                          title="Gerenciar Alertas de Formação de Trens"
                        >
                          <Train className="w-3.5 h-3.5 text-amber-400" />
                          <span>Alertas ({s.trainAlerts ? s.trainAlerts.filter(a => a.active !== false).length : 0})</span>
                        </button>

                        <button
                          onClick={(e) => handleCopySedeLink(s, e)}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 rounded-lg text-[11px] font-semibold transition flex items-center space-x-1 shrink-0"
                          title="Copiar Link de Exibição Direta para Smart TV"
                        >
                          {copiedSedeId === s.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-bold">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Link TV</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={(e) => handleOpenSedeSlideshow(s, e)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition flex items-center space-x-1.5 shadow shrink-0"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Exibir</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
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
                {/* Offline Cache Status */}
                <div className="mt-4 bg-slate-950/40 rounded-xl p-3 border border-slate-800/80 flex items-center justify-between" id="offline-cache-status-widget">
                  <div className="flex items-center space-x-2.5">
                    {downloadStatus === 'downloading' ? (
                      <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg animate-bounce shrink-0">
                        <Cloud className="w-4 h-4" />
                      </div>
                    ) : downloadStatus === 'completed' ? (
                      <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-slate-800 text-slate-400 rounded-lg shrink-0">
                        <Cloud className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Suporte Offline (TV/Celular)</span>
                      <span className="text-xs text-slate-300 font-semibold">
                        {downloadStatus === 'downloading' 
                          ? `Baixando vídeos: ${downloadProgress.loaded}/${downloadProgress.total}`
                          : downloadStatus === 'completed'
                            ? `Tudo baixado para offline (${downloadProgress.total}/${downloadProgress.total})`
                            : 'Aguardando sincronização...'}
                      </span>
                    </div>
                  </div>
                  {downloadStatus === 'downloading' && (
                    <div className="w-12 bg-slate-800 h-1.5 rounded-full overflow-hidden shrink-0">
                      <div 
                        className="bg-blue-500 h-full transition-all duration-300"
                        style={{ width: `${(downloadProgress.loaded / (downloadProgress.total || 1)) * 100}%` }}
                      />
                    </div>
                  )}
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
                      url.searchParams.set('videofit', videoFitMode);
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
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[5000, 10000, 30000, 60000, 90000, 120000].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setTransitionSpeed(speed)}
                        className={`py-1.5 px-1 rounded-lg text-xs font-mono font-semibold transition ${
                          transitionSpeed === speed 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {speed === 5000 ? '5s' : speed === 10000 ? '10s' : speed === 30000 ? '30s' : speed === 60000 ? '60s' : speed === 90000 ? '90s' : '120s'}
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
                {/* Video Fit Mode */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-semibold flex items-center justify-between">
                    <span>Ajuste do Vídeo (Tela Cheia)</span>
                    <span className="text-[10px] text-cyan-400 font-mono font-bold uppercase">{videoFitMode}</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'cover', label: 'Preencher Tela' },
                      { id: 'fill', label: 'Esticar' },
                      { id: 'contain', label: 'Proporcional' },
                    ].map((fit) => (
                      <button
                        key={fit.id}
                        onClick={() => setVideoFitMode(fit.id as any)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition ${
                          videoFitMode === fit.id 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {fit.label}
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
              </div>
            </div>
            {/* Col 2: Live Files list & Preview screen (8 Cols) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Section A: Live Image Carousel preview */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm flex flex-col h-72 sm:h-96 relative group" id="quick-preview-panel">
                {mediaFiles.length > 0 ? (
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
                            key={getMediaSrc(mediaFiles[renderedIndex])}
                            src={getMediaSrc(mediaFiles[renderedIndex])}
                            className={`bg-black ${
                              videoFitMode === 'cover' 
                                ? 'w-full h-full object-cover' 
                                : videoFitMode === 'fill' 
                                ? 'w-full h-full object-fill' 
                                : 'max-h-full max-w-full object-contain'
                            }`}
                            autoPlay
                            controls
                            playsInline
                            muted={videoMuted}
                            onCanPlay={(e) => {
                              const video = e.currentTarget;
                              const playPromise = video.play();
                              if (playPromise !== undefined) {
                                playPromise.catch(err => {
                                  console.warn("Preview video autoplay unmuted blocked, falling back to muted:", err);
                                  setVideoMuted(true);
                                  video.muted = true;
                                  video.play().catch(err2 => {
                                    console.error("Preview video muted playback failed:", err2);
                                  });
                                });
                              }
                            }}
                            onEnded={handleNextSlide}
                          />
                        ) : mediaFiles[renderedIndex]?.isPdf ? (
                          <iframe
                            src={getMediaSrc(mediaFiles[renderedIndex])}
                            className="w-full h-full border-none bg-white"
                          />
                        ) : (
                          <img
                            src={getMediaSrc(mediaFiles[renderedIndex]) || '/placeholder.jpg'}
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
        <div 
          className="fixed inset-0 bg-black z-50 flex flex-col justify-between select-none overflow-hidden cursor-pointer" 
          id="full-slideshow-canvas"
          onClick={() => {
            if (videoMuted) {
              setVideoMuted(false);
            }
          }}
        >
          {urgentAlerts.length > 0 ? (
            /* URGENT 15-MINUTE TRAIN DEPARTURE TAKEOVER SCREEN - NO IMAGES/VIDEOS EXHIBITED */
            <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col justify-between p-6 sm:p-12 text-white border-8 border-amber-500/80 shadow-[inset_0_0_80px_rgba(245,158,11,0.25)] select-none animate-fadeIn">
              {/* Test mode indicator exit button */}
              {isTestingAlert && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTestingAlert(false);
                  }}
                  className="absolute top-6 right-6 z-[60] bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl shadow-2xl font-bold text-xs flex items-center space-x-2 border border-rose-400/30"
                >
                  <X className="w-4 h-4" />
                  <span>Sair da Simulação de Alerta</span>
                </button>
              )}

              {/* Header Banner */}
              <div className="w-full bg-amber-500/10 border-2 border-amber-500/40 rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md shadow-2xl">
                <div className="flex items-center space-x-4">
                  <div className="p-3 sm:p-4 bg-amber-500 text-slate-950 rounded-2xl animate-bounce shadow-lg">
                    <Train className="w-8 h-8 sm:w-10 sm:h-10 font-bold" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm uppercase font-extrabold tracking-widest text-amber-400 block font-mono">
                      ⚠️ ALERTA DE PARTIDA DE TREM (ATÉ 15 MINUTOS)
                    </span>
                    <h2 className="text-xl sm:text-3xl font-black text-white tracking-wide">
                      {resolvedFolderName || activeSede?.name || 'SEDE OPERACIONAL'}
                    </h2>
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-amber-500/30 px-5 py-2.5 rounded-2xl flex items-center space-x-3 shrink-0">
                  <Bell className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
                  <span className="text-xs font-bold text-amber-200 uppercase font-mono">
                    FORMAÇÃO DE TRENS EM ANDAMENTO
                  </span>
                </div>
              </div>

              {/* CENTER: MASSIVE COUNTDOWN TIMER & TRAIN ALERT DETAILS */}
              <div className="my-auto flex flex-col items-center justify-center text-center space-y-6 sm:space-y-8">
                {/* Prefixo do Trem Badge */}
                <div className="inline-flex items-center space-x-3 sm:space-x-4 bg-amber-500/15 border-2 border-amber-500/50 px-6 sm:px-12 py-3 sm:py-5 rounded-3xl shadow-2xl">
                  <span className="text-sm sm:text-lg uppercase font-black tracking-wider text-amber-300 font-mono">
                    PREFIXO / COMPOSIÇÃO:
                  </span>
                  <span className="text-3xl sm:text-6xl font-black font-mono text-white tracking-wider">
                    {urgentAlerts[0].alert.prefix}
                  </span>
                </div>

                {/* CRONÔMETRO GRANDE */}
                <div className="flex flex-col items-center justify-center">
                  <div className="text-[5.5rem] sm:text-[9rem] md:text-[12rem] lg:text-[14rem] font-mono font-black tracking-tighter leading-none text-amber-400 drop-shadow-[0_10px_35px_rgba(245,158,11,0.4)] animate-pulse">
                    {urgentAlerts[0].remaining.formattedCountdown}
                  </div>
                  <span className="text-sm sm:text-2xl font-black uppercase tracking-widest text-amber-300/90 mt-2 font-mono">
                    {urgentAlerts[0].remaining.totalSeconds < 0 ? 'PARTIDA EM SAÍDA / ATRASO' : 'TEMPO RESTANTE PARA A PARTIDA'}
                  </span>
                </div>

                {/* Details Bar */}
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
                  <div className="bg-slate-900/90 border border-slate-800 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl flex items-center space-x-3 shadow-xl">
                    <Clock className="w-6 h-6 text-amber-400" />
                    <div className="text-left">
                      <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold block">Horário Previsto</span>
                      <span className="text-xl sm:text-2xl font-black font-mono text-white">{urgentAlerts[0].alert.time}</span>
                    </div>
                  </div>

                  {urgentAlerts[0].alert.status && (
                    <div className="bg-cyan-500/10 border border-cyan-500/30 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl flex items-center space-x-3 shadow-xl">
                      <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
                      <div className="text-left">
                        <span className="text-[10px] sm:text-xs text-cyan-300 uppercase font-bold block">Status</span>
                        <span className="text-xl sm:text-2xl font-bold text-cyan-200">{urgentAlerts[0].alert.status}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Additional Urgent Trains in window */}
                {urgentAlerts.length > 1 && (
                  <div className="flex flex-wrap items-center justify-center gap-3 bg-slate-900/80 border border-slate-800 px-6 py-3 rounded-2xl mt-2">
                    <span className="text-xs text-slate-400 font-bold uppercase">Outras partidas em até 15 min:</span>
                    {urgentAlerts.slice(1).map((item) => (
                      <span key={item.alert.id} className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
                        {item.alert.prefix} às {item.alert.time} ({item.remaining.formattedCountdown})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Bar */}
              <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 font-mono border-t border-slate-800/80 pt-4">
                <span>MONITORAÇÃO DE PARTIDAS DE TREM (MODO ALERTA 15 MINUTOS)</span>
                <span className="text-slate-200 font-bold">HORA ATUAL: {currentTime}</span>
              </div>
            </div>
          ) : mediaFiles.length > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              {/* Autoplay blocked sound fallback indicator */}
              {videoMuted && mediaFiles[renderedIndex]?.isVideo && (
                <div 
                  className="absolute top-6 right-6 z-50 bg-indigo-600/90 hover:bg-indigo-500 text-white px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center space-x-3 animate-bounce border border-indigo-400/30 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setVideoMuted(false);
                  }}
                >
                  <VolumeX className="w-5 h-5 text-white animate-pulse" />
                  <div className="flex flex-col">
                    <span className="font-bold text-xs tracking-wide">Vídeo silenciado pelo navegador</span>
                    <span className="text-[10px] text-indigo-200">Toque aqui para ativar o som 🔊</span>
                  </div>
                </div>
              )}
              {/* Dynamic transitions mapped with custom animations */}
              <div 
                className={`absolute inset-0 flex items-center justify-center ${
                  mediaFiles[renderedIndex]?.isVideo && videoFitMode !== 'contain' ? 'p-0' : 'p-2 sm:p-4'
                } transition-all duration-500 ease-in-out ${
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
                    key={getMediaSrc(mediaFiles[renderedIndex])}
                    src={getMediaSrc(mediaFiles[renderedIndex])}
                    className={`shadow-2xl bg-black ${
                      videoFitMode === 'cover' 
                        ? 'w-full h-full object-cover' 
                        : videoFitMode === 'fill' 
                        ? 'w-full h-full object-fill' 
                        : 'max-h-full max-w-full object-contain'
                    }`}
                    autoPlay
                    controls
                    playsInline
                    muted={videoMuted}
                    onCanPlay={(e) => {
                      const video = e.currentTarget;
                      const playPromise = video.play();
                      if (playPromise !== undefined) {
                        playPromise.catch(err => {
                          console.warn("Fullscreen video autoplay unmuted blocked, falling back to muted:", err);
                          setVideoMuted(true);
                          video.muted = true;
                          video.play().catch(err2 => {
                            console.error("Fullscreen video muted playback failed:", err2);
                          });
                        });
                      }
                    }}
                    onEnded={handleNextSlide}
                    onError={(e) => {
                      console.error('Video error:', e);
                      // Skip to next slide if video fails
                      if (isPlaying) setTimeout(handleNextSlide, 3000);
                    }}
                  />
                ) : mediaFiles[renderedIndex]?.isPdf ? (
                  <iframe
                    src={getMediaSrc(mediaFiles[renderedIndex])}
                    className="w-full h-full border-none bg-white shadow-2xl"
                  />
                ) : (
                  <img
                    src={getMediaSrc(mediaFiles[renderedIndex]) || '/placeholder.jpg'}
                    alt={mediaFiles[renderedIndex]?.name}
                    className="max-h-full max-w-full object-contain shadow-2xl"
                    id="active-slideshow-img"
                  />
                )}
              </div>
              {/* Preload Next Media */}
              <div className="hidden" aria-hidden="true" style={{ display: 'none' }}>
                {mediaFiles[(currentSlideIndex + 1) % mediaFiles.length]?.isVideo ? (
                  <video src={getMediaSrc(mediaFiles[(currentSlideIndex + 1) % mediaFiles.length])} preload="auto" muted playsInline />
                ) : (
                  <img src={getMediaSrc(mediaFiles[(currentSlideIndex + 1) % mediaFiles.length])} />
                )}
              </div>
              {/* Train Formation Alerts Ticker Overlay in Slideshow */}
              {showTrainAlertsTicker && trainAlerts.length > 0 && (
                <div className="absolute top-4 left-4 z-40 max-w-lg sm:max-w-xl md:max-w-2xl bg-slate-950/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-amber-500/40 shadow-2xl flex items-center space-x-3 text-white animate-fadeIn">
                  <div className="flex items-center space-x-2 shrink-0 pr-3 border-r border-slate-800">
                    <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg animate-pulse border border-amber-500/30">
                      <Train className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-amber-400 block font-mono">
                        Formação de Trens
                      </span>
                      <span className="text-xs font-bold text-slate-200 truncate max-w-[110px] sm:max-w-none block">
                        {resolvedFolderName || activeSede?.name || 'Sede'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
                    {trainAlerts.filter(a => a.active !== false).length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Nenhum alerta ativo</span>
                    ) : (
                      trainAlerts.filter(a => a.active !== false).map((alert) => (
                        <div 
                          key={alert.id} 
                          className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl shrink-0 shadow-sm"
                        >
                          <span className="text-xs font-black font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {alert.prefix}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-100 flex items-center">
                            <Clock className="w-3 h-3 text-slate-400 mr-1" />
                            {alert.time}
                          </span>
                          {alert.status && (
                            <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                              {alert.status}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Bottom/Top Overlays */}
              {kpcData && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 text-white px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center space-x-4 animate-fadeIn border border-red-500/50">
                  <AlertTriangle className="w-8 h-8 text-yellow-300 animate-pulse" />
                  <div className="flex flex-col">
                    <span className="font-bold text-xl tracking-wide">{kpcData.message}</span>
                    <span className="font-mono text-base text-red-100 flex items-center space-x-2">
                      <span>Tempo restante:</span>
                      <span className="font-bold text-lg bg-black/30 px-2 py-0.5 rounded-md">{kpcData.timer}</span>
                    </span>
                  </div>
                </div>
              )}
              <div 
                className={`absolute inset-x-0 bottom-0 z-30 bg-transparent p-6 sm:p-10 flex flex-col sm:flex-row sm:items-end justify-between space-y-4 sm:space-y-0 transition-opacity duration-500 ${
                  showUiInSlideshow ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                }`}
                id="slideshow-hud-overlay"
              >
                {/* Filename caption */}
                {showFileName ? (
                  <div className="max-w-2xl bg-black/40 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/5 shadow-inner">
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
                    {/* Offline Indicator inside Clock Card */}
                    <div className="flex flex-col items-end border-r border-white/10 pr-3.5 mr-1 hidden sm:flex">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono font-bold">
                        Cache Local (TV)
                      </span>
                      <span className={`text-[11px] font-mono font-semibold flex items-center space-x-1 ${downloadStatus === 'completed' ? 'text-emerald-400' : 'text-blue-400'}`}>
                        {downloadStatus === 'downloading' ? (
                          <>
                            <Cloud className="w-3.5 h-3.5 animate-bounce mr-1" />
                            <span>Baixando {downloadProgress.loaded}/{downloadProgress.total}</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1" />
                            <span>Sincronizado</span>
                          </>
                        )}
                      </span>
                    </div>

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
                className={`absolute top-4 right-4 z-[60] flex items-center space-x-2 bg-black/60 backdrop-blur-md p-1.5 rounded-xl border border-white/5 transition-opacity duration-500 ${
                  showUiInSlideshow ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                }`}
                id="slideshow-hud-top"
              >
                <button
                  onClick={() => setShowTrainAlertsTicker(!showTrainAlertsTicker)}
                  className={`p-2 hover:bg-white/10 rounded-lg transition ${
                    showTrainAlertsTicker ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400'
                  }`}
                  title={showTrainAlertsTicker ? 'Ocultar Alertas de Trens' : 'Exibir Alertas de Trens'}
                >
                  <Train className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const nextMode = videoFitMode === 'cover' ? 'fill' : videoFitMode === 'fill' ? 'contain' : 'cover';
                    setVideoFitMode(nextMode);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition flex items-center space-x-1"
                  title={`Enquadramento do Vídeo: ${videoFitMode === 'cover' ? 'Preencher Tela (Cover)' : videoFitMode === 'fill' ? 'Esticar (Fill)' : 'Proporcional (Contain)'}`}
                >
                  <Scaling className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] uppercase font-mono hidden sm:inline text-cyan-300 font-bold">{videoFitMode}</span>
                </button>
                <button
                  onClick={toggleNativeFullscreen}
                  className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
                  title={isNativeFullscreen ? 'Sair da Tela Cheia do Navegador' : 'Tela Cheia do Navegador'}
                >
                  {isNativeFullscreen ? <Minimize className="w-4 h-4 text-indigo-400" /> : <Maximize className="w-4 h-4 text-indigo-400" />}
                </button>
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
      {/* Sede Creation / Edition Modal */}
      {isSedeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsSedeModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-5">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">
                  {editingSede ? 'Editar Sede' : 'Cadastrar Nova Sede'}
                </h3>
                <p className="text-xs text-slate-400">
                  Associe um nome de identificação ao link da pasta de mídia no Google Drive.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSede} className="space-y-4">
              {sedeError && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{sedeError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nome da Sede *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sede Matriz, Filial SP, Sede Centro..."
                  value={sedeNameInput}
                  onChange={(e) => setSedeNameInput(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Link da Pasta do Google Drive *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={sedeUrlInput}
                  onChange={(e) => setSedeUrlInput(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Certifique-se de que a pasta no Google Drive tem permissão "Qualquer pessoa com o link pode ver".
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Descrição / Local do Monitor (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: TV da Recepção Principal, Painel da Entrada..."
                  value={sedeDescInput}
                  onChange={(e) => setSedeDescInput(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsSedeModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSede || !sedeNameInput.trim() || !sedeUrlInput.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-lg"
                >
                  {isSavingSede ? 'Salvando...' : editingSede ? 'Atualizar Sede' : 'Salvar Sede'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gerenciador de Alertas de Formação de Trens */}
      {isAlertsModalOpen && selectedSedeForAlerts && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsAlertsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-5 pb-4 border-b border-slate-800">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                <Train className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
                  <span>Alertas de Formação de Trens</span>
                </h3>
                <p className="text-xs text-amber-300 font-medium">
                  Sede: <span className="font-bold text-white">{selectedSedeForAlerts.name}</span>
                </p>
              </div>
            </div>

            {/* 15-Minute Rule Explanation & Simulation Bar */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-start space-x-2.5 text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <span>
                  <strong className="text-amber-300 block font-semibold mb-0.5">⚠️ Regra dos 15 Minutos (Modo Alerta Automático):</strong>
                  Quando faltar exatamente 15 minutos (ou menos) para o horário do trem, a apresentação de fotos/vídeos é pausada e o cronômetro grande assume a tela cheia sem imagens.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTestingAlert(true);
                  setSlideshowMode(true);
                  setIsAlertsModalOpen(false);
                }}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shrink-0 text-xs shadow-lg flex items-center space-x-1.5 transition transform hover:scale-105"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simular Alerta 15 Min</span>
              </button>
            </div>

            {/* Add New Alert Form */}
            <form onSubmit={handleAddAlertToSede} className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Cadastrar Novo Alerta</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Prefixo / Composição *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: TR-102, K-88, V-401..."
                    value={alertPrefixInput}
                    onChange={(e) => setAlertPrefixInput(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 uppercase font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Horário Programado *
                  </label>
                  <input
                    type="time"
                    required
                    value={alertTimeInput}
                    onChange={(e) => setAlertTimeInput(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                  {/* Quick Time Offsets */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <span className="text-[10px] text-slate-500 self-center font-bold mr-1">Atalhos:</span>
                    {[
                      { label: '+10m (Ativa 15min)', mins: 10 },
                      { label: '+14m (Ativa 15min)', mins: 14 },
                      { label: '+30m', mins: 30 },
                      { label: '+1h', mins: 60 },
                    ].map(btn => (
                      <button
                        key={btn.mins}
                        type="button"
                        onClick={() => {
                          const d = new Date(Date.now() + btn.mins * 60 * 1000);
                          const hh = String(d.getHours()).padStart(2, '0');
                          const mm = String(d.getMinutes()).padStart(2, '0');
                          setAlertTimeInput(`${hh}:${mm}`);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 hover:bg-amber-500/30 transition"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Status / Observação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Formação Prevista, Em Pátio A, Pronto..."
                  value={alertStatusInput}
                  onChange={(e) => setAlertStatusInput(e.target.value)}
                  className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
                
                {/* Status Presets */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Formação Prevista', 'Em Pátio', 'Manobra', 'Pronto p/ Partida', 'Aguardando Maquinista', 'Liberado'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAlertStatusInput(preset)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition ${
                        alertStatusInput === preset 
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingAlerts || !alertPrefixInput.trim() || !alertTimeInput.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-bold rounded-lg text-xs transition shadow flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Alerta</span>
                </button>
              </div>
            </form>

            {/* List of Current Alerts */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Alertas Cadastrados ({selectedSedeForAlerts.trainAlerts?.length || 0})</span>
                <span className="text-[10px] text-slate-500 font-normal">Exibidos em tempo real no painel</span>
              </h4>

              {(!selectedSedeForAlerts.trainAlerts || selectedSedeForAlerts.trainAlerts.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                  Nenhum alerta de trem cadastrado para esta sede ainda. Adicione o primeiro no formulário acima.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {selectedSedeForAlerts.trainAlerts.map((alert) => {
                    const rem = getAlertTimeRemaining(alert.time);
                    return (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                          alert.active !== false 
                            ? 'bg-slate-950 border-slate-800' 
                            : 'bg-slate-950/40 border-slate-900 opacity-60'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-black font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                            {alert.prefix}
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold font-mono text-slate-200">
                                🕒 {alert.time}
                              </span>
                              {alert.status && (
                                <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                                  {alert.status}
                                </span>
                              )}
                              {rem && alert.active !== false && (
                                rem.isUrgent ? (
                                  <span className="text-[10px] font-extrabold font-mono text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full animate-pulse">
                                    ⚠️ Em Tela Cheia ({rem.formattedCountdown})
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
                                    Faltam {rem.mins}m {rem.secs}s
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleToggleAlertStatus(alert.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                              alert.active !== false 
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            {alert.active !== false ? 'Ativo' : 'Pausado'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAlert(alert.id)}
                            className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                            title="Excluir Alerta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 mt-5 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAlertsModalOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition"
              >
                Concluído
              </button>
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
