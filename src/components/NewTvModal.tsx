import React, { useState } from 'react';
import { Tv, X, FolderPlus, Clock, Sparkles, Train } from 'lucide-react';
import { TVDevice, TrainSchedule } from '../types';

interface NewTvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (tv: TVDevice) => void;
}

const DEFAULT_SCHEDULES: TrainSchedule[] = [
  { id: '1', prefix: 'KPC', departureTime: '12:00' },
  { id: '2', prefix: 'KPC', departureTime: '17:00' },
  { id: '3', prefix: 'KPC', departureTime: '19:50' },
];

export function NewTvModal({ isOpen, onClose, onCreate }: NewTvModalProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [folderUrl, setFolderUrl] = useState('');
  const [trainSchedules, setTrainSchedules] = useState<TrainSchedule[]>(DEFAULT_SCHEDULES);
  const [prefixInput, setPrefixInput] = useState('KPC');
  const [timeInput, setTimeInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddSchedule = () => {
    const cleanPrefix = prefixInput.trim().toUpperCase();
    const cleanTime = timeInput.trim();

    if (!cleanPrefix) {
      setError('Por favor, informe o prefixo do trem (ex: KPC, G32).');
      return;
    }
    if (!cleanTime) {
      setError('Por favor, selecione o horário de partida do trem.');
      return;
    }

    const exists = trainSchedules.some(
      s => s.prefix === cleanPrefix && s.departureTime === cleanTime
    );

    if (!exists) {
      const newSchedule: TrainSchedule = {
        id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        prefix: cleanPrefix,
        departureTime: cleanTime,
      };
      setTrainSchedules([...trainSchedules, newSchedule].sort((a, b) => a.departureTime.localeCompare(b.departureTime)));
      setTimeInput('');
      setError(null);
    }
  };

  const handleRemoveSchedule = (id: string) => {
    setTrainSchedules(trainSchedules.filter(t => t.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Por favor, informe um nome para a TV (ex: TV Recepção).');
      return;
    }

    const newTv: TVDevice = {
      id: `tv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: trimmedName,
      location: location.trim() || undefined,
      folderUrl: folderUrl.trim(),
      trainSchedules: trainSchedules.length > 0 ? trainSchedules : DEFAULT_SCHEDULES,
      transitionSpeed: 15000,
      transitionEffect: 'fade',
      showFileName: true,
      showClock: true,
      showUiInSlideshow: true,
      videoAudioEnabled: true,
      videoVolume: 1.0,
      autoRefresh: true,
      autoRefreshRate: 60000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onCreate(newTv);
    setName('');
    setLocation('');
    setFolderUrl('');
    setTrainSchedules(DEFAULT_SCHEDULES);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Adicionar Nova TV</h3>
              <p className="text-xs text-slate-400">Configure uma nova tela para exibição e avisos de trens</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nome da TV / Display <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Ex: TV Recepção, TV Refeitório, TV Pátio"
              className="w-full text-sm bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 transition placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Localização / Setor (Opcional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Bloco A - Entrada Principal"
              className="w-full text-sm bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 transition placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Link da Pasta do Google Drive (Opcional)
            </label>
            <div className="relative">
              <input
                type="text"
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-100 rounded-xl pl-9 pr-3.5 py-2.5 focus:outline-none focus:border-blue-500 transition placeholder:text-slate-600 font-mono"
              />
              <FolderPlus className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
          </div>

          {/* Cadastro de Trens com Prefixo e Horário */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Avisos de Trens (Prefixo & Partida)
              </span>
              <span className="text-[10px] text-slate-500">90m topo • 15m tela cheia</span>
            </div>

            <div className="flex flex-wrap gap-1.5 items-center">
              {trainSchedules.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono font-semibold text-slate-200"
                >
                  <span className="text-amber-400 font-bold">{item.prefix}</span>
                  <span className="text-slate-400">às</span>
                  <span>{item.departureTime}h</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSchedule(item.id)}
                    className="text-slate-500 hover:text-rose-400 ml-1 font-bold"
                    title="Remover trem"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>

            {/* Form to add train with Prefix + Departure Time */}
            <div className="grid grid-cols-12 gap-2 pt-1">
              <div className="col-span-5">
                <label className="block text-[10px] text-slate-400 mb-0.5">Prefixo</label>
                <input
                  type="text"
                  placeholder="Ex: KPC"
                  value={prefixInput}
                  onChange={(e) => setPrefixInput(e.target.value.toUpperCase())}
                  className="w-full text-xs bg-slate-900 border border-slate-800 text-slate-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 uppercase font-mono font-bold"
                />
              </div>
              <div className="col-span-4">
                <label className="block text-[10px] text-slate-400 mb-0.5">Partida</label>
                <input
                  type="time"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  className="w-full text-xs bg-slate-900 border border-slate-800 text-slate-100 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div className="col-span-3 flex items-end">
                <button
                  type="button"
                  onClick={handleAddSchedule}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700 h-[33px] flex items-center justify-center"
                >
                  + Trem
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-blue-600/30 flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Criar e Abrir Configuração</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
