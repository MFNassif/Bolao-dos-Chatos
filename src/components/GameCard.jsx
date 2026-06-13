import { useEffect, useMemo, useState } from 'react';
import { formatTime, formatDate } from '../utils/dates';
import { isLocked, lockTimeMs, formatCountdown } from '../utils/locks';
import { useBella } from '../routes/BellaContext';
import { getFullName } from '../utils/teamNames';

export default function GameCard({ game, children }) {
  const { bella } = useBella();
  const locked = isLocked(game.startTime);
  const [countdown, setCountdown] = useState(() =>
    formatCountdown(lockTimeMs(game.startTime) - Date.now())
  );

  useEffect(() => {
    if (locked) return;
    const t = setInterval(
      () => setCountdown(formatCountdown(lockTimeMs(game.startTime) - Date.now())),
      30000
    );
    return () => clearInterval(t);
  }, [game.startTime, locked]);

  const statusInfo = useMemo(() => {
    if (game.status === 'finished') return { label: 'Encerrado',  cls: 'bg-white/8 text-slate' };
    if (game.status === 'live')     return { label: '● AO VIVO', cls: 'bg-red-500/20 text-red-400 animate-pulse' };
    return { label: formatTime(game.startTime), cls: 'bg-green/20 text-green-light' };
  }, [game.status, game.startTime]);

  const hasScore =
    Number.isInteger(game.homeScore) &&
    Number.isInteger(game.awayScore);

  const homeName = bella ? getFullName(game.homeTeamCode, game.homeTeam) : (game.homeTeamCode || game.homeTeam);
  const awayName = bella ? getFullName(game.awayTeamCode, game.awayTeam) : (game.awayTeamCode || game.awayTeam);

  return (
    <article className="card bg-surface-2 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] text-slate font-semibold uppercase tracking-wider truncate pr-2">
          {game.stage}{game.group ? ` · Grupo ${game.group}` : ''}
        </span>
        <span className={`chip shrink-0 ${statusInfo.cls}`}>{statusInfo.label}</span>
      </div>

      {bella ? (
        /* ── MODO DIVA: vertical ── */
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Flag flag={game.homeTeamFlag} code={game.homeTeamCode} />
            <p className="flex-1 text-sm font-bold text-white">{homeName}</p>
            <span className={`font-display text-2xl w-8 text-right ${hasScore ? 'text-white' : 'text-white/20'}`}>
              {hasScore ? game.homeScore : '—'}
            </span>
          </div>
          <div className="flex items-center gap-3 py-0.5">
            <div className="w-9 flex items-center justify-center">
              <span className="font-display text-sm text-slate">×</span>
            </div>
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-[10px] text-slate">{formatDate(game.startTime)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Flag flag={game.awayTeamFlag} code={game.awayTeamCode} />
            <p className="flex-1 text-sm font-bold text-white">{awayName}</p>
            <span className={`font-display text-2xl w-8 text-right ${hasScore ? 'text-white' : 'text-white/20'}`}>
              {hasScore ? game.awayScore : '—'}
            </span>
          </div>
        </div>
      ) : (
        /* ── MODO NORMAL: 3 colunas simétricas ──
           A coluna do centro tem largura fixa para que o × fique sempre
           na mesma posição horizontal que o × do PredictionForm abaixo. */
        <div className="flex items-center gap-2">
          {/* Mandante — ocupa metade do espaço lateral */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <Flag flag={game.homeTeamFlag} code={game.homeTeamCode} size="lg" />
            <p className="text-xs font-bold text-white text-center leading-tight">{homeName}</p>
          </div>

          {/* Centro fixo — mesmo container usado pelo PredictionForm */}
          <div className="flex flex-col items-center justify-center" style={{ width: 120 }}>
            {hasScore ? (
              <div className="flex items-center justify-center gap-2 w-full">
                <span className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center font-display text-xl text-white">
                  {game.homeScore}
                </span>
                <span className="w-4 text-center font-display text-base text-slate">×</span>
                <span className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center font-display text-xl text-white">
                  {game.awayScore}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 w-full">
                <span className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center font-display text-xl text-white/20">-</span>
                <span className="w-4 text-center font-display text-base text-slate">×</span>
                <span className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center font-display text-xl text-white/20">-</span>
              </div>
            )}
            <p className="text-[10px] text-slate mt-1.5">{formatDate(game.startTime)}</p>
          </div>

          {/* Visitante */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <Flag flag={game.awayTeamFlag} code={game.awayTeamCode} size="lg" />
            <p className="text-xs font-bold text-white text-center leading-tight">{awayName}</p>
          </div>
        </div>
      )}

      {/* Palpite — mesmo layout de largura que o centro acima */}
      {children && (
        <div className="mt-4 pt-3 border-t border-white/8 flex justify-center">
          {children}
        </div>
      )}

      {/* Status */}
      {!locked && game.status === 'scheduled' && (
        <p className="text-[10px] text-slate mt-3 text-center">
          Bloqueia em <span className="text-white font-semibold">{countdown}</span>
        </p>
      )}
      {locked && game.status === 'scheduled' && (
        <p className="text-[10px] text-red-400 font-semibold mt-3 text-center">🔒 Palpites bloqueados</p>
      )}
    </article>
  );
}

function Flag({ flag, code, size = 'md' }) {
  const sz = size === 'lg' ? 'w-10 h-10 rounded-xl' : 'w-9 h-9 rounded-lg';
  return (
    <div className={`${sz} bg-white/8 border border-white/10 overflow-hidden flex items-center justify-center shrink-0`}>
      {flag
        ? <img src={flag} alt={code} className="w-full h-full object-cover" loading="lazy" />
        : <span className="text-[9px] font-bold text-slate">{code?.slice(0, 3)}</span>
      }
    </div>
  );
}
