import { useEffect, useState } from 'react';
import { useAuth } from '../routes/AuthContext';
import { subscribeRanking, compareRanking, combinedPoints } from '../services/rankingService';
import { subscribeLiveGames } from '../services/gameService';
import { subscribePoolSettings, calcPrizes } from '../services/settingsService';
import RankingTable from '../components/RankingTable';
import Loading from '../components/Loading';

const SORTS = [
  { key: 'points',  label: 'Pontos' },
  { key: 'exact',   label: '🎯 Cravadas' },
  { key: 'results', label: '✓ Acertos' }
];

export default function Ranking() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState(null);
  const [liveGames, setLiveGames] = useState([]);
  const [settings, setSettings] = useState(null);
  const [sortBy, setSortBy] = useState('points');

  useEffect(() => {
    return subscribeLiveGames(setLiveGames);
  }, []);

  useEffect(() => {
    if (!profile?.activePoolId) {
      setSettings(null);
      return;
    }
    const unsub = subscribePoolSettings(profile.activePoolId, setSettings);
    return unsub;
  }, [profile?.activePoolId]);

  useEffect(() => {
    if (!profile?.activePoolId) return;
    setRows(null);
    const unsub = subscribeRanking(profile.activePoolId, setRows);
    return unsub;
  }, [profile?.activePoolId]);

  const isLive = liveGames.length > 0;
  const prizes = settings && rows ? calcPrizes(settings, rows.length) : null;

  if (rows === null) return <Loading />;

  const ranked = [...rows].sort(compareRanking);
  const top3 = ranked.slice(0, 3);
  const myPos = ranked.findIndex(u => u.uid === user.uid) + 1;
  const myRow = rows.find(u => u.uid === user.uid);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white tracking-wider">RANKING</h2>
          <p className="text-sm text-slate">Atualiza em tempo real durante os jogos.</p>
        </div>
        {isLive && (
          <span className="chip bg-red-500/20 text-red-400 animate-pulse shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block mr-1" />AO VIVO
          </span>
        )}
      </div>

      {/* Premiação */}
      {prizes && settings && (
        <div className="card bg-surface-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display text-sm text-white tracking-wider">💰 PREMIAÇÃO</h3>
              <p className="text-[11px] text-slate">
                {rows.length} participante{rows.length !== 1 ? 's' : ''} × {settings.currency} {settings.betAmount}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl text-green-light">{settings.currency} {prizes.total}</p>
              <p className="text-[10px] text-slate">montante total</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { pos: '1º', emoji: '🥇', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30', amount: prizes.first,  pct: settings.prize1 },
              { pos: '2º', emoji: '🥈', color: 'text-slate',      bg: 'bg-white/8 border-white/10',            amount: prizes.second, pct: settings.prize2 },
              { pos: '3º', emoji: '🥉', color: 'text-amber-600',  bg: 'bg-amber-900/20 border-amber-700/30',   amount: prizes.third,  pct: settings.prize3 }
            ].map(p => (
              <div key={p.pos} className={`rounded-xl border p-3 text-center ${p.bg}`}>
                <p className="text-base">{p.emoji} {p.pos}</p>
                <p className={`font-display text-xl mt-1 ${p.color}`}>{settings.currency} {p.amount}</p>
                <p className="text-[10px] text-slate">{p.pct}% do total</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jogos ao vivo */}
      {isLive && (
        <div className="card bg-red-950/30 border-red-800/30 p-4">
          <p className="text-[11px] text-red-400 font-bold uppercase tracking-wider mb-2">Jogos agora</p>
          <ul className="space-y-1.5">
            {liveGames.map(g => (
              <li key={g.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-white truncate">{g.homeTeam} × {g.awayTeam}</span>
                <span className="font-display text-lg text-white tabular-nums shrink-0">
                  {Number.isInteger(g.homeScore) ? g.homeScore : '-'}
                  <span className="text-slate mx-1">×</span>
                  {Number.isInteger(g.awayScore) ? g.awayScore : '-'}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate mt-2">Pontos refletem o placar atual. Mudam a cada gol.</p>
        </div>
      )}

      {/* Pódio */}
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[1, 0, 2].map(idx => {
            const u = top3[idx];
            if (!u) return <div key={idx} />;
            const heights = ['h-28', 'h-20', 'h-16'];
            const colors = ['bg-yellow-500/80', 'bg-slate/40', 'bg-amber-700/60'];
            const txtColors = ['text-yellow-400', 'text-slate', 'text-amber-600'];
            return (
              <div key={u.uid} className="flex flex-col items-center">
                <div className="card bg-surface-2 p-2.5 w-full text-center mb-1.5">
                  <p className={`font-display text-xl ${txtColors[idx]}`}>{combinedPoints(u)}</p>
                  <p className="text-[10px] text-slate">pts</p>
                  <p className="font-bold text-xs text-white truncate mt-0.5">{u.displayName}</p>
                  {prizes && <p className={`text-[10px] font-bold mt-0.5 ${txtColors[idx]}`}>{settings.currency} {[prizes.first, prizes.second, prizes.third][idx]}</p>}
                </div>
                <div className={`${colors[idx]} ${heights[idx]} w-full rounded-t-xl flex items-end justify-center pb-1.5 font-display text-lg text-white`}>
                  {idx + 1}º
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Minha posição */}
      {profile && (
        <div className={`card p-4 ${isLive ? 'bg-red-950/20 border-red-800/30' : 'bg-surface-2'}`}>
          <p className="text-[11px] text-slate uppercase tracking-wider font-bold mb-1">Sua posição</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-4xl text-white">{myPos ? `${myPos}º` : '—'}</p>
              <p className="text-sm text-slate">{profile.displayName}</p>
            </div>
            <div className="text-right space-y-1">
              <p className="font-display text-3xl text-green-light">{combinedPoints(myRow)} <span className="text-base text-slate">pts</span></p>
              <div className="flex gap-3 justify-end text-xs">
                <span className="text-yellow-400 font-bold">🎯 {myRow?.exactScores || 0} cravadas</span>
                <span className="text-white/60">✓ {myRow?.correctResults || 0} acertos</span>
              </div>
              {(myRow?.knockoutPoints || 0) > 0 && (
                <p className="text-[11px] text-slate">{myRow?.totalPoints || 0} comuns + <span className="text-green-light font-semibold">{myRow.knockoutPoints} mata-mata 🏆</span></p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ordenação */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-slate font-bold uppercase tracking-wider shrink-0">Ordenar:</span>
        {SORTS.map(s => (
          <button key={s.key} onClick={() => setSortBy(s.key)}
            className={sortBy === s.key ? 'tab-btn-active' : 'tab-btn-idle'}>
            {s.label}
          </button>
        ))}
      </div>

      <RankingTable rows={rows} currentUid={user.uid} sortBy={sortBy} />

      <p className="text-[11px] text-slate text-center px-2">
        Desempate: 1) mais pontos · 2) mais cravadas · 3) placar mais perto (menor erro de gols) · 4) mais palpites. Persistindo o empate, o prêmio é dividido.
      </p>
    </div>
  );
}
