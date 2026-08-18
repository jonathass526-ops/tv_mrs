import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft,
  Tv, 
  Folder, 
  FolderOpen, 
  Image as ImageIcon, 
  FileText, 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  RefreshCw, 
  Settings, 
  Clock, 
  AlertTriangle, 
  Link as LinkIcon,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Edit2,
  Trash2,
  MonitorPlay,
  Train,
  Bell
} from 'lucide-react';
import { TVDevice, MediaFile, TrainSchedule, TrainAlertInfo, normalizeTrainSchedules } from '../types';
import { calculateTrainAlert } from '../utils/trainAlerts';

interface TvConfigScreenProps {
  tv: TVDevice;
  currentTime: string;
  onBackToHome: () => void;
  onUpdateTv: (updatedTv: TVDevice) => void;
  onOpenSlideshow: (testMode?: 'off' | 'banner' | 'fullscreen') => void;
}

export function TvConfigScreen({
  tv,
  currentTime,
  onBackToHome,
  onUpdateTv,
  onOpenSlideshow
}: TvConfigScreenProps) {
  // Local editable state for this TV
  const [folderLinkInput, setFolderLinkInput] = useState(tv.folderUrl || '');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [resolvedFolderName, setResolvedFolderName] = useState(tv.folderName || '');

  // Train schedule states
  const [prefixInput, setPrefixInput] = useState('KPC');
  const [timeInput, setTimeInput] = useState('');
  const [testAlertMode, setTestAlertMode] = useState<'off' | 'banner' | 'fullscreen'>('off');

  // Preview Carousel State
  const [previewIndex, setPreviewIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(tv.name);
  const [locationInput, setLocationInput] = useState(tv.location || '');

  const mediaFiles = useMemo(() => files.filter(f => f.isImage || f.isVideo || f.isPdf), [files]);
  const schedules = useMemo(() => normalizeTrainSchedules(tv.trainSchedules), [tv.trainSchedules]);

  // Train Departure Alert Logic (90m banner / 15m fullscreen)
  const trainAlert = useMemo<TrainAlertInfo | null>(() => {
    return calculateTrainAlert(
      tv.trainSchedules,
      testAlertMode !== 'off'
        ? {
            active: true,
            mode: testAlertMode,
            prefix: prefixInput || 'KPC',
            time: '12:00',
          }
        : undefined
    );
  }, [currentTime, tv.trainSchedules, testAlertMode, prefixInput]);

  // Fetch files for this TV's folder
  const fetchFiles = async (showLoadingState = true) => {
    if (!tv.folderUrl) {
      setFiles([]);
      setFileError(null);
      return;
    }

    if (showLoadingState) setIsLoadingFiles(true);
    else setIsRefreshing(true);
    setFileError(null);

    try {
      const encodedUrl = encodeURIComponent(tv.folderUrl);
      const res = await fetch(`/api/drive/files?url=${encodedUrl}`);
      const data = await res.json();

      if (data.error) {
        setFileError(data.error);
        setFiles([]);
      } else {
        setFiles(data.files || []);
        if (data.folderName && data.folderName !== tv.folderName) {
          setResolvedFolderName(data.folderName);
          onUpdateTv({
            ...tv,
            folderName: data.folderName,
            folderId: data.folderId || tv.folderId,
            updatedAt: new Date().toISOString()
          });
        }
      }
    } catch (err: any) {
      console.error('Error fetching files:', err);
      setFileError('Erro ao carregar arquivos da pasta. Verifique a conexão e tente novamente.');
    } finally {
      setIsLoadingFiles(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFiles(true);
  }, [tv.folderUrl]);

  // Auto-refresh interval
  useEffect(() => {
    if (!tv.autoRefresh || !tv.folderUrl) return;
    const interval = setInterval(() => {
      fetchFiles(false);
    }, tv.autoRefreshRate || 60000);
    return () => clearInterval(interval);
  }, [tv.autoRefresh, tv.autoRefreshRate, tv.folderUrl]);

  // Preview Carousel Auto-Cycle (Paused ONLY if fullscreen alert active)
  useEffect(() => {
    if (trainAlert?.level === 'fullscreen' || mediaFiles.length <= 1) return;
    const timer = setInterval(() => {
      setPreviewIndex(prev => (prev + 1) % mediaFiles.length);
    }, tv.transitionSpeed || 15000);
    return () => clearInterval(timer);
  }, [mediaFiles.length, tv.transitionSpeed, trainAlert?.level]);

  // Handle Save Google Drive Folder Link
  const handleSavePublicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = folderLinkInput.trim();
    if (!trimmed) {
      onUpdateTv({
        ...tv,
        folderUrl: '',
        folderName: '',
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    setIsSubmittingLink(true);
    setFileError(null);

    try {
      const res = await fetch('/api/drive/validate-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();

      if (data.valid) {
        const updatedTv: TVDevice = {
          ...tv,
          folderUrl: trimmed,
          folderId: data.folderId || undefined,
          folderName: data.folderName || 'Pasta do Google Drive',
          updatedAt: new Date().toISOString(),
        };
        onUpdateTv(updatedTv);
        setResolvedFolderName(data.folderName || 'Pasta do Google Drive');
      } else {
        setFileError(data.error || 'Link inválido. Certifique-se de colar o link de uma pasta compartilhada do Google Drive.');
      }
    } catch (err: any) {
      onUpdateTv({
        ...tv,
        folderUrl: trimmed,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const handleAddSchedule = () => {
    const cleanPrefix = prefixInput.trim().toUpperCase();
    const cleanTime = timeInput.trim();

    if (!cleanPrefix || !cleanTime) return;

    const exists = schedules.some(
      s => s.prefix === cleanPrefix && s.departureTime === cleanTime
    );

    if (!exists) {
      const newSchedule: TrainSchedule = {
        id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        prefix: cleanPrefix,
        departureTime: cleanTime,
      };
      const next = [...schedules, newSchedule].sort((a, b) =>
        a.departureTime.localeCompare(b.departureTime)
      );
      onUpdateTv({
        ...tv,
        trainSchedules: next,
        updatedAt: new Date().toISOString(),
      });
      setTimeInput('');
    }
  };

  const handleRemoveSchedule = (id: string) => {
    const next = schedules.filter(t => t.id !== id);
    onUpdateTv({
      ...tv,
      trainSchedules: next,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCopySmartTvUrl = () => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('tv', tv.id);
    currentUrl.searchParams.set('view', 'slideshow');

    navigator.clipboard.writeText(currentUrl.toString()).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleSaveTvInfo = () => {
    onUpdateTv({
      ...tv,
      name: nameInput.trim() || tv.name,
      location: locationInput.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });
    setIsEditingName(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Left: Back button & TV Name */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToHome}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition border border-slate-700 flex items-center space-x-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Todas as TVs</span>
            </button>

            <div className="h-5 w-px bg-slate-800 hidden sm:block" />

            {isEditingName ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="text-xs bg-slate-950 border border-blue-500 rounded-lg px-2.5 py-1 text-slate-100 font-bold"
                />
                <button
                  onClick={handleSaveTvInfo}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
                >
                  Salvar
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg">
                  <Tv className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-sm sm:text-base font-bold text-slate-100">{tv.name}</h2>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-slate-500 hover:text-slate-300 p-0.5"
                      title="Editar nome"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                  {tv.location && (
                    <span className="text-[11px] text-slate-400 block">{tv.location}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Actions (Copy Smart TV link & Launch Fullscreen Slideshow) */}
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={handleCopySmartTvUrl}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 relative"
              title="Copiar Link para Smart TV"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Link da Smart TV</span>
              {copiedLink && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded shadow">
                  Copiado!
                </span>
              )}
            </button>

            <button
              onClick={() => onOpenSlideshow(testAlertMode)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-blue-600/30 flex items-center space-x-1.5"
            >
              <MonitorPlay className="w-4 h-4 text-amber-300" />
              <span>Modo TV / Tela Cheia</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Active Alert Banner if active */}
        {trainAlert && (
          <div className={`border-2 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl transition-all ${
            trainAlert.level === 'fullscreen'
              ? 'bg-gradient-to-r from-red-950 via-slate-900 to-black border-red-500/80 animate-pulse'
              : 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-950 border-amber-500/70'
          }`}>
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-2xl border ${
                trainAlert.level === 'fullscreen'
                  ? 'bg-red-600/30 border-red-500/60 text-amber-300'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              }`}>
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <span className={`px-2.5 py-0.5 text-[10px] font-mono font-bold rounded uppercase tracking-wider ${
                  trainAlert.level === 'fullscreen'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {trainAlert.level === 'fullscreen'
                    ? '🔴 Alerta Últimos 15 min (Pausa Fotos na TV)'
                    : '🟡 Aviso Topo 90 min (Fotos Continuam em Fundo)'}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-100 mt-1">{trainAlert.message}.</h3>
                <p className="text-xs text-slate-400">
                  Horário de Partida: <b className="text-amber-300 font-mono">{trainAlert.departureTime}h</b>
                </p>
              </div>
            </div>

            <div className="bg-black/90 border border-amber-500/60 px-6 py-2 rounded-2xl text-center shadow-xl shrink-0">
              <span className="text-[10px] text-amber-400 font-mono uppercase block font-bold">Tempo Restante</span>
              <span className="text-3xl sm:text-4xl font-mono font-black text-amber-300 tracking-wider">
                {trainAlert.formattedTimer}
              </span>
            </div>
          </div>
        )}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Settings & Configuration (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Box 1: Google Drive Folder Connection */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Pasta do Google Drive</h3>
                    <span className="text-[11px] text-slate-400">Fotos e vídeos desta TV</span>
                  </div>
                </div>

                {tv.folderUrl && (
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-full">
                    Conectada
                  </span>
                )}
              </div>

              <form onSubmit={handleSavePublicLink} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Link da Pasta Compartilhada
                  </label>
                  <input
                    type="text"
                    value={folderLinkInput}
                    onChange={(e) => setFolderLinkInput(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-3 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSubmittingLink}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 shadow-md shadow-blue-600/20"
                  >
                    {isSubmittingLink ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LinkIcon className="w-3.5 h-3.5" />
                    )}
                    <span>Salvar Link da Pasta</span>
                  </button>

                  {tv.folderUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setFolderLinkInput('');
                        onUpdateTv({
                          ...tv,
                          folderUrl: '',
                          folderName: '',
                          updatedAt: new Date().toISOString(),
                        });
                      }}
                      className="px-3 py-2 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 text-xs font-semibold rounded-xl transition border border-slate-700"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </form>

              {resolvedFolderName && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Pasta Detectada:</span>
                  <span className="font-bold text-slate-200 truncate max-w-[180px]">{resolvedFolderName}</span>
                </div>
              )}
            </div>

            {/* Box 2: Train Departure Alerts (Prefix & Departure Time) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                    <Train className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Avisos de Trens</h3>
                    <span className="text-[11px] text-slate-400">Prefixo + Horário de Partida</span>
                  </div>
                </div>

                {/* Test Selector Dropdown */}
                <div className="flex items-center space-x-1.5">
                  <select
                    value={testAlertMode}
                    onChange={(e) => setTestAlertMode(e.target.value as any)}
                    className="text-[11px] bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 font-semibold"
                  >
                    <option value="off">Sem Teste</option>
                    <option value="banner">🧪 Testar Topo (90m)</option>
                    <option value="fullscreen">🧪 Testar Tela Cheia (15m)</option>
                  </select>
                </div>
              </div>

              {/* Explanatory Rules Info */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/70 space-y-1.5 text-[11px]">
                <div className="flex items-center space-x-2 text-amber-300 font-semibold">
                  <Bell className="w-3.5 h-3.5" />
                  <span>Estágios de Alerta Automático:</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  • <b>90 minutos antes:</b> Aviso pequeno e discreto em cima da tela com o prefixo e cronômetro (fotos continuam passando).
                </p>
                <p className="text-slate-400 leading-relaxed">
                  • <b>Últimos 15 minutos:</b> Aviso grande em tela cheia com cronômetro regressivo (pausa as fotos).
                </p>
                <p className="text-slate-500 text-[10px]">
                  Ao passar a hora de partida, o aviso encerra e as fotos voltam ao normal.
                </p>
              </div>

              {/* Schedules List */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Trens Cadastrados ({schedules.length}):
                </label>
                
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {schedules.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-mono font-bold">
                          {item.prefix}
                        </span>
                        <span className="text-slate-300">
                          Partida às <b className="text-slate-100 font-mono">{item.departureTime}h</b>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSchedule(item.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition"
                        title="Remover trem"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new schedule with Prefix and Departure Time */}
                <div className="grid grid-cols-12 gap-2 pt-2 border-t border-slate-800">
                  <div className="col-span-5">
                    <label className="block text-[10px] text-slate-400 mb-0.5">Prefixo</label>
                    <input
                      type="text"
                      placeholder="Ex: KPC"
                      value={prefixInput}
                      onChange={(e) => setPrefixInput(e.target.value.toUpperCase())}
                      className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 uppercase font-mono font-bold"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[10px] text-slate-400 mb-0.5">Partida</label>
                    <input
                      type="time"
                      value={timeInput}
                      onChange={(e) => setTimeInput(e.target.value)}
                      className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="col-span-3 flex items-end">
                    <button
                      type="button"
                      onClick={handleAddSchedule}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md h-[38px] flex items-center justify-center"
                    >
                      + Trem
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Box 3: Slideshow & Visual Settings */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Ajustes da Apresentação</h3>
                  <span className="text-[11px] text-slate-400">Tempo por foto, efeitos e transição</span>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tempo de Cada Imagem (Segundos)
                  </label>
                  <select
                    value={tv.transitionSpeed / 1000}
                    onChange={(e) => {
                      onUpdateTv({
                        ...tv,
                        transitionSpeed: Number(e.target.value) * 1000,
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                  >
                    <option value={15}>15 segundos</option>
                    <option value={30}>30 segundos</option>
                    <option value={60}>60 segundos (1 minuto)</option>
                    <option value={90}>90 segundos (1 minuto e 30s)</option>
                    <option value={120}>120 segundos (2 minutos)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Efeito de Transição
                  </label>
                  <select
                    value={tv.transitionEffect || 'fade'}
                    onChange={(e) => {
                      onUpdateTv({
                        ...tv,
                        transitionEffect: e.target.value as any,
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                    className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                  >
                    <option value="fade">Desvanecer Suave (Fade)</option>
                    <option value="zoom">Zoom Suave</option>
                    <option value="slide">Deslizamento Lateral</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-xs text-slate-300">Exibir Relógio no Slideshow</span>
                  <input
                    type="checkbox"
                    checked={tv.showClock}
                    onChange={(e) => {
                      onUpdateTv({
                        ...tv,
                        showClock: e.target.checked,
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Exibir Nome do Arquivo</span>
                  <input
                    type="checkbox"
                    checked={tv.showFileName}
                    onChange={(e) => {
                      onUpdateTv({
                        ...tv,
                        showFileName: e.target.checked,
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Live Preview Screen & Files (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Live Preview Monitor Screen */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
              <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-mono text-slate-400 ml-2 font-semibold">
                    Pré-visualização da TV ({tv.name})
                  </span>
                </div>

                <button
                  onClick={() => onOpenSlideshow(testAlertMode)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Expandir Tela Cheia</span>
                </button>
              </div>

              {/* Display Canvas with Alert rendering */}
              <div className="h-80 sm:h-96 relative bg-black flex items-center justify-center overflow-hidden">
                {/* 1. Fullscreen Alert Mode in Preview */}
                {trainAlert?.level === 'fullscreen' ? (
                  <div className="w-full h-full bg-gradient-to-br from-slate-950 via-red-950/90 to-black p-6 flex flex-col items-center justify-center text-center border border-red-500/40 animate-fadeIn">
                    <div className="p-3 bg-red-600/20 border border-red-500/50 rounded-full text-amber-300 mb-2 animate-pulse">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <span className="text-[11px] font-mono text-red-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      Alerta &lt; 15 min (Pausa Fotos)
                    </span>
                    <h4 className="font-bold text-slate-100 text-sm sm:text-base max-w-md mb-2">
                      {trainAlert.message}.
                    </h4>
                    <div className="bg-black/80 border-2 border-amber-500/50 px-6 py-2 rounded-2xl my-2 shadow-2xl backdrop-blur-md">
                      <span className="text-[10px] text-amber-400 font-mono uppercase tracking-widest block mb-0.5">Tempo Restante para Partida</span>
                      <span className="text-3xl sm:text-5xl font-mono font-black text-amber-300 tracking-wider">
                        {trainAlert.formattedTimer}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">
                      Partida às {trainAlert.departureTime}h
                    </p>
                  </div>
                ) : mediaFiles.length > 0 ? (
                  /* 2. Slide Carousel with dedicated 90m Top Banner */
                  <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden relative">
                    
                    {/* Top Dedicated Banner (90m alert - above image) */}
                    {trainAlert?.level === 'banner' && (
                      <div className="w-full shrink-0 bg-black border-b-2 border-amber-400 p-2.5 flex items-center justify-between shadow-xl z-20">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-1.5 bg-amber-400 text-slate-950 rounded-lg font-black">
                            <Train className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                              <span className="text-[9px] font-mono font-black text-amber-400 uppercase tracking-wide">
                                AVISO 90 MIN
                              </span>
                            </div>
                            <span className="text-xs font-bold text-white font-mono block">
                              {trainAlert.message} às <b className="text-amber-400">{trainAlert.departureTime}h</b>
                            </span>
                          </div>
                        </div>
                        <div className="bg-slate-950 border border-amber-400 px-2.5 py-1 rounded-lg text-center shadow-lg">
                          <span className="text-xs font-mono font-black text-amber-300">
                            {trainAlert.formattedTimer}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Media Viewport (occupies remaining height without overlap) */}
                    <div className="flex-1 w-full min-h-0 relative flex items-center justify-center p-1 bg-slate-950 overflow-hidden">
                      {mediaFiles[previewIndex]?.isVideo ? (
                        <video
                          src={mediaFiles[previewIndex]?.downloadUrl || ''}
                          muted
                          autoPlay
                          loop
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <img
                          key={mediaFiles[previewIndex]?.id}
                          src={mediaFiles[previewIndex]?.directUrl || mediaFiles[previewIndex]?.downloadUrl || ''}
                          alt={mediaFiles[previewIndex]?.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.currentTarget;
                            const f = mediaFiles[previewIndex];
                            if (f?.downloadUrl && target.src !== window.location.origin + f.downloadUrl) {
                              target.src = f.downloadUrl;
                            } else if (f?.id && !target.src.includes('lh3.googleusercontent.com')) {
                              target.src = `https://lh3.googleusercontent.com/d/${f.id}=w2560-h1440`;
                            }
                          }}
                          className="w-full h-full object-contain transition-all duration-700"
                        />
                      )}

                      {/* Overlay info */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2 truncate max-w-xs">
                          {mediaFiles[previewIndex]?.isVideo && (
                            <span className="bg-blue-500/80 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">VÍDEO</span>
                          )}
                          <span className="text-slate-300 truncate font-mono text-[11px]">
                            {mediaFiles[previewIndex]?.name}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono bg-black/60 px-2 py-0.5 rounded text-[10px]">
                          {previewIndex + 1} / {mediaFiles.length}
                        </span>
                      </div>
                    </div>

                    {/* Next/Prev Buttons */}
                    <button
                      onClick={() => setPreviewIndex((previewIndex - 1 + mediaFiles.length) % mediaFiles.length)}
                      className="absolute left-2 p-1.5 bg-black/50 hover:bg-black/80 rounded-full text-slate-300 transition"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setPreviewIndex((previewIndex + 1) % mediaFiles.length)}
                      className="absolute right-2 p-1.5 bg-black/50 hover:bg-black/80 rounded-full text-slate-300 transition"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  /* No Images State */
                  <div className="text-center p-6 space-y-3">
                    <ImageIcon className="w-12 h-12 text-slate-700 mx-auto" />
                    <p className="text-xs text-slate-400 max-w-xs">
                      {tv.folderUrl
                        ? 'Nenhuma imagem ou vídeo encontrado na pasta vinculada.'
                        : 'Cole o link da pasta do Google Drive ao lado para carregar as fotos.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Files Explorer Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Arquivos Carregados ({mediaFiles.length})
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => fetchFiles(false)}
                  disabled={isRefreshing || !tv.folderUrl}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition text-xs flex items-center space-x-1"
                  title="Atualizar lista de arquivos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="text-[11px]">Atualizar</span>
                </button>
              </div>

              {fileError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
                  {fileError}
                </div>
              )}

              {isLoadingFiles ? (
                <div className="py-10 text-center space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mx-auto" />
                  <span className="text-xs text-slate-400">Buscando arquivos da pasta do Google Drive...</span>
                </div>
              ) : mediaFiles.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1">
                  {mediaFiles.map((file, idx) => (
                    <div
                      key={file.id}
                      onClick={() => setPreviewIndex(idx)}
                      className={`p-2 rounded-xl border transition cursor-pointer flex flex-col justify-between group ${
                        previewIndex === idx
                          ? 'bg-blue-600/10 border-blue-500'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="h-20 w-full bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center mb-1.5 relative">
                        {file.isImage ? (
                          <img
                            src={file.downloadUrl || ''}
                            alt={file.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        ) : (
                          <div className="text-slate-500 font-mono text-[10px] uppercase">
                            {file.isVideo ? 'VÍDEO' : 'DOC'}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-slate-300 truncate block">
                        {file.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  Nenhum arquivo carregado no momento.
                </div>
              )}
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
