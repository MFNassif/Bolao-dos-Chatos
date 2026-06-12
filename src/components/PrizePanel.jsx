import { useEffect, useState } from 'react';
import { subscribeSettings, calcPrizes } from '../services/settingsService';

export default function PrizePanel() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    return subscribeSettings(setSettings);
  }, []);

  if (!settings) return null;

  const participants = settings.participantCount || 0;
  const prizes = calcPrizes(settings, participants);

  const positions = [
    { pos: '1º', emoji: '🥇', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30', amount: prizes.first, pct: settings.prize1 },
    { pos: '2º', emoji: '🥈', color: 'text-slate',      bg: 'bg-white/8 border-white/10',            amount: prizes.second, pct: settings.prize2 },
    { pos: '3º', emoji: '🥉', color: 'text-amber-600',  bg: 'bg-amber-900/20 border-amber-700/30',   amount: prizes.third,  pct: settings.prize3 }
  ];

  return (
    <div className="card bg-surface-2 p-4 space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base text-white tracking-wider">💰 PREMIAÇÃO</h3>
          <p className="text-[11px] text-slate">
            {participants} participante{participants !== 1 ? 's' : ''} · {settings.currency} {settings.betAmount}/cada
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl text-green-light">{settings.currency} {prizes.total}</p>
          <p className="text-[10px] text-slate uppercase tracking-wider">montante total</p>
        </div>
      </div>

      {/* Posições */}
      <div className="grid grid-cols-3 gap-2">
        {positions.map(({ pos, emoji, color, bg, amount, pct }) => (
          <div key={pos} className={`rounded-xl border p-3 text-center ${bg}`}>
            <p className="text-lg">{emoji}</p>
            <p className={`font-display text-xl mt-1 ${color}`}>{settings.currency} {amount}</p>
            <p className="text-[10px] text-slate">{pct}% · {pos}</p>
          </div>
        ))}
      </div>

      {prizes.total === 0 && (
        <p className="text-[11px] text-slate text-center">
          Valor definido pelo admin nas configurações.
        </p>
      )}
    </div>
  );
}
