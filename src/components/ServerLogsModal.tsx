import React, { useState, useEffect, useCallback } from 'react';
import { 
  Terminal, 
  X, 
  Copy, 
  Check, 
  RefreshCw, 
  Trash2, 
  ExternalLink,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Radio
} from 'lucide-react';

interface ServerLog {
  id: string;
  timestamp: string;
  type: 'info' | 'warn' | 'error' | 'stream';
  message: string;
  details?: any;
}

interface ServerLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ServerLogsModal({ isOpen, onClose }: ServerLogsModalProps) {
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/debug/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Erro ao buscar logs do servidor:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Auto-refresh every 3 seconds while modal is open
  useEffect(() => {
    if (!isOpen || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, fetchLogs]);

  const handleClearLogs = async () => {
    try {
      await fetch('/api/debug/logs', { method: 'DELETE' });
      setLogs([]);
    } catch (e) {
      console.error('Erro ao limpar logs:', e);
    }
  };

  const handleCopyLogs = () => {
    const text = logs
      .map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message} ${l.details ? JSON.stringify(l.details) : ''}`)
      .join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const filteredLogs = logs.filter(log => {
    const matchesType = filterType === 'all' || log.type === filterType;
    const matchesSearch = !searchQuery.trim() || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-100">Logs do Servidor em Tempo Real</h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
                  {logs.length} registros
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Acompanhe as requisições de vídeos e imagens vindas das Smart TVs
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyLogs}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-sm"
              title="Copiar todos os logs formatados"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Logs'}</span>
            </button>

            <a
              href="/api/debug/logs/text"
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              title="Abrir em aba de texto puro"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-3 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-0.5">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  filterType === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todos ({logs.length})
              </button>
              <button
                onClick={() => setFilterType('stream')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  filterType === 'stream' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Streams
              </button>
              <button
                onClick={() => setFilterType('info')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  filterType === 'info' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Info
              </button>
              <button
                onClick={() => setFilterType('warn')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  filterType === 'warn' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Avisos
              </button>
              <button
                onClick={() => setFilterType('error')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  filterType === 'error' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Erros
              </button>
            </div>

            <input
              type="text"
              placeholder="Buscar em mensagens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 w-48 sm:w-64"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl border text-[11px] font-mono transition ${
                autoRefresh 
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400' 
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              <span>{autoRefresh ? 'Auto 3s' : 'Pausado'}</span>
            </button>

            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
              title="Atualizar agora"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleClearLogs}
              className="p-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 rounded-xl transition"
              title="Limpar logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Logs Console Box */}
        <div className="flex-1 min-h-[350px] max-h-[550px] p-4 bg-slate-950 overflow-y-auto font-mono text-xs space-y-2 select-text">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16 space-y-2">
              <Terminal className="w-8 h-8 opacity-40" />
              <p>Nenhum log encontrado para o filtro atual.</p>
              <span className="text-[11px] text-slate-600">
                Inicie a reprodução na Smart TV para ver os registros de conexão em tempo real.
              </span>
            </div>
          ) : (
            filteredLogs.map((log) => {
              let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
              let Icon = Radio;

              if (log.type === 'stream') {
                badgeColor = 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50';
                Icon = Radio;
              } else if (log.type === 'info') {
                badgeColor = 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50';
                Icon = CheckCircle2;
              } else if (log.type === 'warn') {
                badgeColor = 'bg-amber-950/60 text-amber-300 border-amber-700/50';
                Icon = AlertTriangle;
              } else if (log.type === 'error') {
                badgeColor = 'bg-red-950/60 text-red-300 border-red-700/50';
                Icon = XCircle;
              }

              return (
                <div 
                  key={log.id} 
                  className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:bg-slate-900 transition flex flex-col space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase flex items-center gap-1 ${badgeColor}`}>
                        <Icon className="w-3 h-3" />
                        {log.type}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {log.timestamp.substring(11, 19)}
                      </span>
                    </div>
                  </div>

                  <div className="text-slate-200 break-words font-medium">
                    {log.message}
                  </div>

                  {log.details && (
                    <div className="bg-slate-950/80 p-2 rounded text-[11px] text-slate-400 overflow-x-auto border border-slate-800/40">
                      {typeof log.details === 'object' 
                        ? JSON.stringify(log.details, null, 2)
                        : String(log.details)
                      }
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Dica: Copie os logs e cole aqui no chat se precisar de análise detalhada.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition font-medium"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
