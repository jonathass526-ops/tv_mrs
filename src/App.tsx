import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { TVDevice, normalizeTrainSchedules } from './types';
import { TvListScreen } from './components/TvListScreen';
import { TvConfigScreen } from './components/TvConfigScreen';
import { TvSlideshow } from './components/TvSlideshow';
import { NewTvModal } from './components/NewTvModal';

const DEFAULT_TVS: TVDevice[] = [
  {
    id: 'tv_principal',
    name: 'TV Principal',
    location: 'Recepção / Painel Central',
    folderUrl: '',
    trainSchedules: [
      { id: '1', prefix: 'KPC', departureTime: '12:00' },
      { id: '2', prefix: 'KPC', departureTime: '17:00' },
      { id: '3', prefix: 'KPC', departureTime: '19:50' },
    ],
    transitionSpeed: 15000,
    transitionEffect: 'fade',
    showFileName: true,
    showClock: true,
    showUiInSlideshow: true,
    autoRefresh: true,
    autoRefreshRate: 60000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export default function App() {
  const [rawTvs, setTvs] = useLocalStorage<TVDevice[]>('app_tv_devices', DEFAULT_TVS);
  const [currentView, setCurrentView] = useState<'list' | 'config' | 'slideshow'>('list');
  const [selectedTvId, setSelectedTvId] = useState<string>('tv_principal');
  const [slideshowTestMode, setSlideshowTestMode] = useState<'off' | 'banner' | 'fullscreen'>('off');
  const [isNewTvModalOpen, setIsNewTvModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const clockTimer = useRef<NodeJS.Timeout | null>(null);

  // Normalize all stored TVs so trainSchedules is always TrainSchedule[]
  const tvs = useMemo(() => {
    return rawTvs.map(tv => ({
      ...tv,
      trainSchedules: normalizeTrainSchedules(tv.trainSchedules),
    }));
  }, [rawTvs]);

  // Set initial selectedTvId
  useEffect(() => {
    if (tvs.length > 0 && (!selectedTvId || !tvs.some(t => t.id === selectedTvId))) {
      setSelectedTvId(tvs[0].id);
    }
  }, [tvs, selectedTvId]);

  // Clock tick to keep accurate time across cards and alerts
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };

    updateTime();
    clockTimer.current = setInterval(updateTime, 1000);
    return () => {
      if (clockTimer.current) clearInterval(clockTimer.current);
    };
  }, []);

  // Check URL parameters for direct TV bookmarking or direct slideshow boot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tvParam = params.get('tv');
    const viewParam = params.get('view');

    if (tvParam) {
      const foundTv = tvs.find(t => t.id === tvParam);
      if (foundTv) {
        setSelectedTvId(tvParam);
        if (viewParam === 'slideshow') {
          setCurrentView('slideshow');
        } else {
          setCurrentView('config');
        }
      }
    }
  }, [tvs]);

  const selectedTv = useMemo(() => {
    return tvs.find(t => t.id === selectedTvId) || tvs[0] || DEFAULT_TVS[0];
  }, [tvs, selectedTvId]);

  // Handler to create a new TV and IMMEDIATELY open its config screen
  const handleCreateTv = (newTv: TVDevice) => {
    setTvs(prev => [...prev, newTv]);
    setSelectedTvId(newTv.id);
    setIsNewTvModalOpen(false);
    setCurrentView('config'); // Opens Screen 2 immediately
  };

  // Handler to select an existing TV to configure
  const handleSelectTv = (tv: TVDevice) => {
    setSelectedTvId(tv.id);
    setCurrentView('config');
  };

  // Handler to open direct slideshow for a TV
  const handleOpenTvSlideshow = (tv: TVDevice) => {
    setSelectedTvId(tv.id);
    setCurrentView('slideshow');
  };

  // Handler to update an existing TV
  const handleUpdateTv = (updatedTv: TVDevice) => {
    setTvs(prev => prev.map(t => (t.id === updatedTv.id ? updatedTv : t)));
  };

  // Handler to delete a TV
  const handleDeleteTv = (tvId: string) => {
    setTvs(prev => {
      const next = prev.filter(t => t.id !== tvId);
      if (next.length === 0) {
        return DEFAULT_TVS;
      }
      return next;
    });
    if (selectedTvId === tvId) {
      setSelectedTvId(tvs[0]?.id || 'tv_principal');
      setCurrentView('list');
    }
  };

  // Handler to duplicate a TV
  const handleDuplicateTv = (tv: TVDevice) => {
    const duplicated: TVDevice = {
      ...tv,
      id: `tv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: `${tv.name} (Cópia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTvs(prev => [...prev, duplicated]);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 font-sans antialiased text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* 1. SCREEN 1: LISTA / GERENCIADOR DE TODAS AS TVS */}
      {currentView === 'list' && (
        <TvListScreen
          tvs={tvs}
          currentTime={currentTime}
          onSelectTv={handleSelectTv}
          onOpenTvSlideshow={handleOpenTvSlideshow}
          onAddNewTv={() => setIsNewTvModalOpen(true)}
          onDeleteTv={handleDeleteTv}
          onDuplicateTv={handleDuplicateTv}
        />
      )}

      {/* 2. SCREEN 2: TELA DE CONFIGURAÇÃO DA TV SELECIONADA */}
      {currentView === 'config' && selectedTv && (
        <TvConfigScreen
          tv={selectedTv}
          currentTime={currentTime}
          onBackToHome={() => setCurrentView('list')}
          onUpdateTv={handleUpdateTv}
          onOpenSlideshow={(testMode = 'off') => {
            setSlideshowTestMode(testMode);
            setCurrentView('slideshow');
          }}
        />
      )}

      {/* 3. FULLSCREEN SLIDESHOW ENGINE FOR THE SELECTED TV */}
      {currentView === 'slideshow' && selectedTv && (
        <TvSlideshow
          tv={selectedTv}
          currentTime={currentTime}
          initialTestMode={slideshowTestMode}
          onExit={() => setCurrentView('config')}
        />
      )}

      {/* Modal to Add New TV */}
      <NewTvModal
        isOpen={isNewTvModalOpen}
        onClose={() => setIsNewTvModalOpen(false)}
        onCreate={handleCreateTv}
      />
    </div>
  );
}
