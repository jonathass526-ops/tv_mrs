import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Minimize2, 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  Clock, 
  Folder, 
  Train, 
  Bell, 
  Sparkles, 
  FlaskConical,
  Loader2,
  Video as VideoIcon
} from 'lucide-react';
import { TVDevice, MediaFile, TrainAlertInfo } from '../types';
import { calculateTrainAlert } from '../utils/trainAlerts';

interface TvSlideshowProps {
  tv: TVDevice;
  currentTime: string;
  initialTestMode?: 'off' | 'banner' | 'fullscreen';
  onExit: () => void;
}

export function TvSlideshow({ tv, currentTime, initialTestMode = 'off', onExit }: TvSlideshowProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [renderedIndex, setRenderedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [testMode, setTestMode] = useState<'off' | 'banner' | 'fullscreen'>(initialTestMode);

  // Video Streaming & Watchdog State
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoElapsedSeconds, setVideoElapsedSeconds] = useState(0);
  const [videoHasStarted, setVideoHasStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoTickRef = useRef<NodeJS.Timeout | null>(null);

  const autoPlayTimer = useRef<NodeJS.Timeout | null>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const mediaFiles = useMemo(() => files.filter(f => f.isImage || f.isVideo || f.isPdf), [files]);
  const currentMedia = mediaFiles[renderedIndex] || null;

  // Train Departure Alert Logic (90m top banner / 15m full screen / test mode)
  const trainAlert = useMemo<TrainAlertInfo | null>(() => {
    const firstSchedule = tv.trainSchedules?.[0];
    const prefix = typeof firstSchedule === 'string' ? 'KPC' : firstSchedule?.prefix || 'KPC';
    const departureTime = typeof firstSchedule === 'string' ? firstSchedule : firstSchedule?.departureTime || '12:00';

    return calculateTrainAlert(
      tv.trainSchedules,
      testMode !== 'off'
        ? {
            active: true,
            mode: testMode,
            prefix: prefix,
            time: departureTime,
          }
        : undefined
    );
  }, [currentTime, tv.trainSchedules, testMode]);

  // Fetch files for this TV's folder
  const fetchFiles = useCallback(async () => {
    if (!tv.folderUrl) return;
    try {
      const encodedUrl = encodeURIComponent(tv.folderUrl);
      const res = await fetch(`/api/drive/files?url=${encodedUrl}`);
      const data = await res.json();
      if (data.files && Array.isArray(data.files)) {
        setFiles(data.files);
      }
    } catch (e) {
      console.error('Failed to load files for slideshow:', e);
    }
  }, [tv.folderUrl]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Periodic Auto-refresh
  useEffect(() => {
    if (!tv.autoRefresh || !tv.folderUrl) return;
    const interval = setInterval(() => {
      fetchFiles();
    }, tv.autoRefreshRate || 60000);
    return () => clearInterval(interval);
  }, [tv.autoRefresh, tv.autoRefreshRate, tv.folderUrl, fetchFiles]);

  // Slide navigation with smooth fade transition
  const handleNextSlide = useCallback(() => {
    if (mediaFiles.length <= 1) return;
    setIsFadingOut(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % mediaFiles.length);
      setRenderedIndex(prev => (prev + 1) % mediaFiles.length);
      setIsFadingOut(false);
    }, 450);
  }, [mediaFiles.length]);

  const handlePrevSlide = useCallback(() => {
    if (mediaFiles.length <= 1) return;
    setIsFadingOut(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + mediaFiles.length) % mediaFiles.length);
      setRenderedIndex(prev => (prev - 1 + mediaFiles.length) % mediaFiles.length);
      setIsFadingOut(false);
    }, 450);
  }, [mediaFiles.length]);

  // Slideshow Auto-Play Engine for Images (PAUSES when video or full alert is active)
  useEffect(() => {
    if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);

    // If fullscreen train alert is active, pause image cycling
    if (trainAlert?.level === 'fullscreen') return;

    // If current media is a video, duration is controlled by video playback & 30s watchdog
    if (currentMedia?.isVideo) return;

    if (isPlaying && mediaFiles.length > 1) {
      autoPlayTimer.current = setTimeout(() => {
        handleNextSlide();
      }, tv.transitionSpeed || 15000);
    }

    return () => {
      if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
    };
  }, [isPlaying, mediaFiles.length, tv.transitionSpeed, handleNextSlide, currentIndex, trainAlert?.level, currentMedia]);

  // Video Streaming 30-Second Start Watchdog
  useEffect(() => {
    if (videoTimeoutRef.current) clearTimeout(videoTimeoutRef.current);
    if (videoTickRef.current) clearInterval(videoTickRef.current);

    if (currentMedia?.isVideo && isPlaying && trainAlert?.level !== 'fullscreen') {
      setIsVideoLoading(true);
      setVideoHasStarted(false);
      setVideoElapsedSeconds(0);

      // Tick seconds for UI countdown / feedback
      videoTickRef.current = setInterval(() => {
        setVideoElapsedSeconds(prev => prev + 1);
      }, 1000);

      // 30-second watchdog: if video hasn't started playing within 30s, advance to next file
      videoTimeoutRef.current = setTimeout(() => {
        console.warn(`[Watchdog] Vídeo "${currentMedia.name}" não iniciou após 30 segundos de conexão com Google Drive. Pulando para o próximo slide...`);
        if (videoTickRef.current) clearInterval(videoTickRef.current);
        handleNextSlide();
      }, 30000);
    } else {
      setIsVideoLoading(false);
      setVideoHasStarted(false);
    }

    return () => {
      if (videoTimeoutRef.current) clearTimeout(videoTimeoutRef.current);
      if (videoTickRef.current) clearInterval(videoTickRef.current);
    };
  }, [renderedIndex, currentMedia?.id, currentMedia?.isVideo, isPlaying, trainAlert?.level, handleNextSlide]);

  // Video play/pause synchronization
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying && trainAlert?.level !== 'fullscreen') {
      videoRef.current.play().catch(err => {
        console.warn('Vídeo auto-play pausado pelo navegador:', err);
      });
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, trainAlert?.level, renderedIndex]);

  // Video event handlers
  const handleVideoPlaying = () => {
    setIsVideoLoading(false);
    setVideoHasStarted(true);
    if (videoTimeoutRef.current) clearTimeout(videoTimeoutRef.current);
    if (videoTickRef.current) clearInterval(videoTickRef.current);
  };

  const handleVideoError = (e: any) => {
    console.error(`Erro no stream de vídeo "${currentMedia?.name}":`, e);
    setIsVideoLoading(false);
    if (videoTimeoutRef.current) clearTimeout(videoTimeoutRef.current);
    if (videoTickRef.current) clearInterval(videoTickRef.current);
    // Move to next slide on error after 1.5 seconds so screen does not lock
    setTimeout(() => {
      handleNextSlide();
    }, 1500);
  };

  // Mouse move / interaction handler to show controls temporarily on mouse activity
  const handleUserActivity = () => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleUserActivity();
      if (e.key === 'Escape') {
        onExit();
      } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        handleNextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        handlePrevSlide();
      } else if (e.key === ' ' || e.key === 'p' || e.key === 'P' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.key === 't' || e.key === 'T') {
        // Cycle test modes for quick debugging on TV
        setTestMode(prev => prev === 'off' ? 'banner' : prev === 'banner' ? 'fullscreen' : 'off');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit, handleNextSlide, handlePrevSlide]);

  return (
    <div 
      className={`fixed inset-0 z-50 bg-black flex flex-col justify-between select-none overflow-hidden transition-all duration-300 ${
        showControls ? 'cursor-default' : 'cursor-none'
      }`}
      onMouseMove={handleUserActivity}
      onClick={handleUserActivity}
      id="tv-slideshow-container"
    >
      {/* 1. CRITICAL 15-MIN TRAIN ALERT TAKEOVER SCREEN */}
      {trainAlert?.level === 'fullscreen' ? (
        <div className="absolute inset-0 z-50 bg-gradient-to-br from-slate-950 via-red-950/95 to-black flex flex-col items-center justify-center p-6 sm:p-12 text-center animate-fadeIn select-none">
          {/* Animated Glowing Ring */}
          <div className="relative mb-6 sm:mb-8">
            <div className="absolute inset-0 rounded-full bg-red-600/30 animate-ping blur-xl" />
            <div className="relative p-6 sm:p-8 bg-red-600/20 border-2 border-red-500/60 rounded-full text-red-400 shadow-2xl backdrop-blur-md">
              <AlertTriangle className="w-16 h-16 sm:w-24 sm:h-24 text-amber-300 animate-pulse" />
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 font-mono text-xs sm:text-sm font-bold uppercase tracking-widest mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
            <span>Alerta de Partida de Trem</span>
            {testMode !== 'off' && (
              <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.5 rounded font-black ml-1">
                TESTE
              </span>
            )}
          </div>

          {/* Main Alert Message with dynamic Prefix */}
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-slate-100 max-w-5xl tracking-tight leading-tight mb-3">
            {trainAlert.message}.
          </h1>

          <p className="text-xs sm:text-base text-slate-300 max-w-xl mb-6 font-mono">
            Horário de Partida programado para às <b className="text-amber-300 text-base sm:text-lg">{trainAlert.departureTime}h</b>
          </p>

          {/* GIANT CRONÔMETRO COUNTDOWN */}
          <div className="bg-black/85 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-12 shadow-2xl backdrop-blur-2xl flex flex-col items-center space-y-2 max-w-2xl w-full my-2">
            <span className="text-xs sm:text-sm text-amber-400 uppercase font-mono tracking-widest font-bold">
              Tempo Restante para a Partida
            </span>
            <div className="text-6xl sm:text-8xl md:text-9xl font-mono font-black text-amber-300 tracking-wider drop-shadow-[0_0_40px_rgba(245,158,11,0.5)] my-2">
              {trainAlert.formattedTimer}
            </div>
            <span className="text-xs sm:text-sm text-slate-400">
              As fotos voltarão a ser exibidas automaticamente assim que o trem partir.
            </span>
          </div>

          {/* Bottom quick controls in alert mode on hover */}
          <div className={`mt-6 flex items-center space-x-3 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 hover:opacity-100'
          }`}>
            <button
              onClick={() => setTestMode(prev => prev === 'fullscreen' ? 'off' : 'fullscreen')}
              className="px-4 py-2 bg-slate-900/90 hover:bg-slate-800 text-amber-300 rounded-xl border border-amber-500/50 text-xs font-semibold flex items-center space-x-1.5"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>{testMode !== 'off' ? 'Desativar Teste' : 'Testar Alerta'}</span>
            </button>

            <button
              onClick={onExit}
              className="px-5 py-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 text-xs font-semibold transition flex items-center space-x-2"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Sair do Modo TV</span>
            </button>
          </div>
        </div>
      ) : (
        /* 2. REGULAR SLIDESHOW (With dedicated top alert bar above image if active) */
        <div className="w-full h-full flex flex-col bg-black overflow-hidden relative">
          
          {/* DEDICATED TOP BAR: 90-MIN ALERT (Occupies space ABOVE the image, not overlapping) */}
          {trainAlert?.level === 'banner' && (
            <div 
              id="top-train-alert-banner"
              className="w-full shrink-0 bg-slate-950 border-b-4 border-amber-400 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xl z-40"
            >
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="p-2 sm:p-2.5 bg-amber-400 text-slate-950 rounded-xl shadow-md font-black flex items-center justify-center">
                  <Train className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-[11px] sm:text-xs font-mono font-black text-amber-400 uppercase tracking-wider bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/40">
                      AVISO DE FORMAÇÃO / PARTIDA (90 MIN)
                    </span>
                    {testMode !== 'off' && (
                      <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.5 rounded font-black uppercase">
                        MODO TESTE
                      </span>
                    )}
                  </div>
                  <h2 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-tight leading-tight">
                    {trainAlert.message} às <span className="text-amber-400 underline decoration-amber-400/50">{trainAlert.departureTime}h</span>.
                  </h2>
                </div>
              </div>

              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="text-right hidden sm:block">
                  <span className="text-[10px] sm:text-xs text-slate-300 font-mono block uppercase font-bold tracking-wider">Tempo Restante</span>
                  <span className="text-xs sm:text-sm text-amber-400 font-mono font-black">Partida às {trainAlert.departureTime}h</span>
                </div>
                <div className="bg-black border-2 border-amber-400 px-4 sm:px-6 py-1.5 sm:py-2 rounded-xl text-center shadow-inner">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-mono font-black text-amber-300 tracking-wider">
                    {trainAlert.formattedTimer}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* MAIN MEDIA VIEWPORT (Fills 100% of the remaining height below the banner) */}
          <div className="flex-1 w-full min-h-0 relative flex items-center justify-center bg-black overflow-hidden">
            
            {mediaFiles.length > 0 ? (
              <div 
                className={`w-full h-full flex items-center justify-center p-2 transition-all duration-500 ease-in-out ${
                  isFadingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                } ${tv.transitionEffect === 'zoom' ? 'animate-pulse' : ''}`}
              >
                {currentMedia?.isImage ? (
                  <img
                    src={currentMedia.downloadUrl || ''}
                    alt={currentMedia.name}
                    className="w-full h-full object-contain pointer-events-none drop-shadow-2xl"
                  />
                ) : currentMedia?.isVideo ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <video
                      ref={videoRef}
                      key={currentMedia.id}
                      src={currentMedia.downloadUrl || ''}
                      autoPlay
                      muted
                      playsInline
                      preload="auto"
                      onPlaying={handleVideoPlaying}
                      onTimeUpdate={() => {
                        if (!videoHasStarted) handleVideoPlaying();
                      }}
                      onWaiting={() => setIsVideoLoading(true)}
                      onError={handleVideoError}
                      onEnded={handleNextSlide}
                      className="w-full h-full object-contain"
                    />

                    {/* Google Direct Stream Connection Watchdog Indicator (if connecting) */}
                    {isVideoLoading && !videoHasStarted && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20 transition-all duration-300">
                        <div className="bg-slate-950/90 border border-blue-500/40 rounded-2xl p-6 shadow-2xl flex flex-col items-center space-y-3 max-w-sm text-center">
                          <div className="relative flex items-center justify-center">
                            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                            <VideoIcon className="w-4 h-4 text-blue-300 absolute" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-100">
                              Transmitindo Vídeo do Google Drive
                            </h3>
                            <p className="text-xs text-slate-400 mt-1 font-mono">
                              Conexão direta sem download na TV
                            </p>
                          </div>
                          
                          {/* 30s Watchdog Countdown Bar */}
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-2">
                            <div 
                              className="bg-blue-500 h-full transition-all duration-1000 ease-linear"
                              style={{ width: `${Math.min(100, (videoElapsedSeconds / 30) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            Aguardando início: <b className="text-blue-400">{30 - videoElapsedSeconds}s</b> restante
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 font-mono text-xl">
                    {currentMedia?.name}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 max-w-md">
                <Folder className="w-16 h-16 text-slate-700 mb-4 animate-bounce" />
                <h2 className="text-xl font-bold text-slate-200 mb-2">Nenhuma mídia vinculada</h2>
                <p className="text-xs text-slate-400 mb-6">
                  Cole o link da pasta do Google Drive nas configurações da TV para exibir as fotos.
                </p>
                <button
                  onClick={onExit}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition border border-slate-700"
                >
                  Voltar para Configuração
                </button>
              </div>
            )}

            {/* Top Corner Info Bar (Clock & TV Name) - Visible only on mouse movement / interaction */}
            <div 
              className={`absolute top-4 inset-x-6 flex items-center justify-between z-30 transition-all duration-300 pointer-events-none ${
                showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
              }`}
            >
              <div className="flex items-center space-x-2 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 shadow-lg pointer-events-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-200 tracking-wide">{tv.name}</span>
              </div>

              {tv.showClock && (
                <div className="flex items-center space-x-2 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-slate-100 font-mono font-bold text-xs sm:text-sm shadow-lg pointer-events-auto">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{currentTime}</span>
                </div>
              )}
            </div>

            {/* Bottom Controls & File Name Bar - Visible ONLY on mouse move */}
            <div 
              className={`absolute bottom-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-30 flex flex-col sm:flex-row items-center justify-between gap-3 transition-all duration-300 ${
                showControls 
                  ? 'opacity-100 translate-y-0 pointer-events-auto' 
                  : 'opacity-0 translate-y-4 pointer-events-none'
              }`}
            >
              {tv.showFileName && currentMedia ? (
                <div className="text-xs font-mono text-slate-200 truncate max-w-md bg-black/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 shadow-lg">
                  {currentMedia.name}
                </div>
              ) : <div />}

              {/* Floating Slide Navigation & Playback Controls */}
              <div className="flex items-center space-x-2.5 bg-black/90 hover:bg-black/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 shadow-2xl transition-all duration-300">
                
                {/* Test Alert Mode Switcher */}
                <div className="flex items-center space-x-1.5 pr-2.5 border-r border-white/20">
                  <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                  <select
                    value={testMode}
                    onChange={(e) => setTestMode(e.target.value as any)}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:border-amber-400 font-semibold cursor-pointer transition"
                    title="Alternar Modo de Teste"
                  >
                    <option value="off">Modo Normal</option>
                    <option value="banner">🧪 Testar Topo (90m)</option>
                    <option value="fullscreen">🧪 Testar Tela Cheia (15m)</option>
                  </select>
                </div>

                {mediaFiles.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevSlide}
                      className="p-2 text-slate-200 hover:text-white bg-white/5 hover:bg-white/15 active:scale-95 transition rounded-xl"
                      title="Slide Anterior (Seta Esquerda)"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition active:scale-95 ${
                        isPlaying 
                          ? 'bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40' 
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/30'
                      }`}
                      title={isPlaying ? 'Pausar Slideshow (P ou Espaço)' : 'Retomar Slideshow (P ou Espaço)'}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4" />
                          <span className="hidden sm:inline">Pausar</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span className="hidden sm:inline">Reproduzir</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleNextSlide}
                      className="p-2 text-slate-200 hover:text-white bg-white/5 hover:bg-white/15 active:scale-95 transition rounded-xl"
                      title="Próximo Slide (Seta Direita / Espaço)"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    <span className="text-xs font-mono font-bold text-slate-300 px-2 bg-white/5 py-1 rounded-lg">
                      {renderedIndex + 1} / {mediaFiles.length}
                    </span>

                    <div className="h-4 w-px bg-white/20" />
                  </>
                )}

                <button
                  onClick={onExit}
                  className="px-2.5 py-1.5 text-slate-300 hover:text-rose-300 bg-white/5 hover:bg-rose-500/20 active:scale-95 transition rounded-xl flex items-center space-x-1 text-xs font-semibold"
                  title="Sair da Tela Cheia (Esc)"
                >
                  <Minimize2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
