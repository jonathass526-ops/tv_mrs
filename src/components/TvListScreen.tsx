import React, { useState, useMemo } from 'react';
import { 
  Tv, 
  Plus, 
  Settings, 
  Maximize2, 
  Copy, 
  Check, 
  Trash2, 
  Clock, 
  Folder, 
  AlertTriangle, 
  ExternalLink,
  Layers,
  Sparkles,
  RefreshCw,
  MonitorPlay,
  Train,
  CloudCheck,
  Terminal
} from 'lucide-react';
import { TVDevice, TrainAlertInfo, normalizeTrainSchedules } from '../types';
import { calculateTrainAlert } from '../utils/trainAlerts';
import { ServerLogsModal } from './ServerLogsModal';

interface TvListScreenProps {
  tvs: TVDevice[];
  currentTime: string;
  onSelectTv: (tv: TVDevice) => void;
  onOpenTvSlideshow: (tv: TVDevice) => void;
  onAddNewTv: () => void;
  onDeleteTv: (tvId: string) => void;
  onDuplicateTv: (tv: TVDevice) => void;
}

export function TvListScreen({
  tvs,
  currentTime,
  onSelectTv,
  onOpenTvSlideshow,
  onAddNewTv,
  onDeleteTv,
  onDuplicateTv
}: TvListScreenProps) {
  const [copiedTvId, setCopiedTvId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showLogsModal, setShowLogsModal] = useState(false);

  // Calculate live train alert for a given TV
  const getTvAlert = (tv: TVDevice): TrainAlertInfo | null => {
    return calculateTrainAlert(tv.trainSchedules);
  };

  const handleCopyTvLink = (tvId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('tv', tvId);
    currentUrl.searchParams.set('view', 'slideshow');
    
    navigator.clipboard.writeText(currentUrl.toString()).then(() => {
      setCopiedTvId(tvId);
      setTimeout(() => setCopiedTvId(null), 2500);
    });
  };

  const filteredTvs = useMemo(() => {
    if (!searchFilter.trim()) return tvs;
    const query = searchFilter.toLowerCase();
    return tvs.filter(tv => 
      tv.name.toLowerCase().includes(query) || 
      (tv.location && tv.location.toLowerCase().includes(query)) ||
      (tv.folderName && tv.folderName.toLowerCase().includes(query))
    );
  }, [tvs, searchFilter]);

  // Overall Stats
  const stats = useMemo(() => {
    const totalTvs = tvs.length;
    const tvsWithFolder = tvs.filter(t => !!t.folderUrl).length;
    const activeAlerts = tvs.filter(t => !!getTvAlert(t)).length;
    return { totalTvs, tvsWithFolder, activeAlerts };
  }, [tvs, currentTime]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 text-white">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">Central de Telas & TVs</h1>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-mono font-semibold">
                  Multi-Display
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Gerencie apresentações de imagens e avisos de trens por tela
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-1.5 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-emerald-400 text-xs font-mono">
              <CloudCheck className="w-3.5 h-3.5" />
              <span>Nuvem Firebase Conectada</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center space-x-2 text-slate-300 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentTime || '--:--:--'}</span>
            </div>

            <button
              onClick={() => setShowLogsModal(true)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-medium transition flex items-center space-x-1.5"
              title="Visualizar logs e requisições do servidor"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Logs do Servidor</span>
            </button>

            <button
              onClick={onAddNewTv}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-blue-600/30 flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Nova TV</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Metric Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total de Telas</span>
              <div className="text-2xl font-bold text-slate-100">{stats.totalTvs}</div>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Tv className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pastas Conectadas</span>
              <div className="text-2xl font-bold text-emerald-400">{stats.tvsWithFolder} / {stats.totalTvs}</div>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Folder className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Avisos em Andamento</span>
              <div className={`text-2xl font-bold ${stats.activeAlerts > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>
                {stats.activeAlerts} {stats.activeAlerts === 1 ? 'trem' : 'trens'}
              </div>
            </div>
            <div className={`p-3 rounded-xl border ${stats.activeAlerts > 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Action Header & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h2 className="text-base font-bold text-slate-100">Painéis e Displays Cadastrados</h2>
            <p className="text-xs text-slate-400">Clique em qualquer TV para abrir suas configurações ou iniciar o slideshow</p>
          </div>

          {tvs.length > 3 && (
            <input
              type="text"
              placeholder="Buscar TV ou setor..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="text-xs bg-slate-900 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 max-w-xs"
            />
          )}
        </div>

        {/* TVs Grid */}
        {filteredTvs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTvs.map((tv) => {
              const alertInfo = getTvAlert(tv);
              const hasFolder = !!tv.folderUrl;
              const schedules = normalizeTrainSchedules(tv.trainSchedules);

              return (
                <div
                  key={tv.id}
                  id={`tv-card-${tv.id}`}
                  onClick={() => onSelectTv(tv)}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition group relative cursor-pointer hover:shadow-blue-500/5"
                >
                  {/* Top TV Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-slate-800 text-blue-400 group-hover:bg-blue-600/20 group-hover:text-blue-300 rounded-xl transition border border-slate-700/60">
                          <Tv className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-100 text-sm group-hover:text-blue-300 transition">
                            {tv.name}
                          </h3>
                          {tv.location ? (
                            <span className="text-[11px] text-slate-400 block">{tv.location}</span>
                          ) : (
                            <span className="text-[11px] text-slate-500 block">Sem localização definida</span>
                          )}
                        </div>
                      </div>

                      {/* Status Tag */}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          hasFolder
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {hasFolder ? 'Pronta' : 'Aguardando Pasta'}
                      </span>
                    </div>

                    {/* Active Train Alert Notice */}
                    {alertInfo && (
                      <div className={`mb-3 p-2.5 rounded-xl flex items-center justify-between text-xs transition-all ${
                        alertInfo.level === 'fullscreen'
                          ? 'bg-red-950/80 border border-red-500/50 text-red-200 animate-pulse'
                          : 'bg-amber-950/70 border border-amber-500/50 text-amber-200'
                      }`}>
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                          <span className="font-bold">
                            {alertInfo.message} ({alertInfo.level === 'fullscreen' ? '<15m' : '90m'})
                          </span>
                        </div>
                        <span className="font-mono font-bold text-amber-300 bg-black/60 px-1.5 py-0.5 rounded">
                          {alertInfo.formattedTimer}
                        </span>
                      </div>
                    )}

                    {/* Folder Status */}
                    <div className="text-xs text-slate-400 bg-slate-950/60 rounded-xl p-3 mb-3 border border-slate-800/60 space-y-1.5">
                      <div className="flex items-center space-x-2 text-slate-300">
                        <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="font-medium truncate">
                          {tv.folderName || (hasFolder ? 'Pasta do Google Drive Vinculada' : 'Nenhuma pasta configurada')}
                        </span>
                      </div>

                      {/* Train Alert Times with Prefix */}
                      <div className="pt-1">
                        <span className="text-[10px] text-slate-500 uppercase font-mono block mb-1">
                          Avisos de Trens (90m topo • 15m tela cheia):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {schedules.length > 0 ? (
                            schedules.map((item) => (
                              <span
                                key={item.id}
                                className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] font-mono text-slate-300 flex items-center space-x-1"
                              >
                                <span className="text-amber-400 font-bold">{item.prefix}</span>
                                <span>{item.departureTime}h</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">Nenhum trem cadastrado</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    {/* Mode TV Fullscreen Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTvSlideshow(tv);
                      }}
                      className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-md shadow-blue-600/20"
                    >
                      <MonitorPlay className="w-3.5 h-3.5 text-amber-300" />
                      <span>Modo TV</span>
                    </button>

                    {/* Configure Settings Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTv(tv);
                      }}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition border border-slate-700 flex items-center space-x-1"
                      title="Configurar TV"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Configurar</span>
                    </button>

                    {/* Copy Direct Link Button */}
                    <button
                      type="button"
                      onClick={(e) => handleCopyTvLink(tv.id, e)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition border border-slate-700"
                      title="Copiar Link para Smart TV"
                    >
                      {copiedTvId === tv.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Delete TV Button (only if more than 1 TV) */}
                    {tvs.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Tem certeza que deseja excluir "${tv.name}"?`)) {
                            onDeleteTv(tv.id);
                          }
                        }}
                        className="p-2 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 rounded-xl transition border border-slate-700"
                        title="Excluir TV"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-8 space-y-4">
            <Tv className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">Nenhuma TV encontrada</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Adicione uma nova TV para começar a exibir apresentações e alertas em seus displays.
            </p>
            <button
              onClick={onAddNewTv}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition inline-flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Primeira TV</span>
            </button>
          </div>
        )}

      </main>

      {/* Server Logs Real-Time Diagnostics Modal */}
      <ServerLogsModal
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
      />
    </div>
  );
}
