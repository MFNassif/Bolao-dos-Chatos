import { compareRanking } from '../services/rankingService';

export default function RankingTable({ rows, currentUid, sortBy = 'points' }) {
  const sorted = [...rows].sort((a, b) => {
    // Os botoes de ordenar usam o stat escolhido como chave; em empate, cai na
    // cadeia oficial. "Pontos" usa a cadeia completa (ordem de premiacao).
    if (sortBy === 'exact') return (b.exactScores || 0) - (a.exactScores || 0) || compareRanking(a, b);
    if (sortBy === 'results') return (b.correctResults || 0) - (a.correctResults || 0) || compareRanking(a, b);
    return compareRanking(a, b);
  });

  if (!sorted.length) {
    return <div className="card p-10 text-center text-slate">Nenhum participante pontuando ainda.</div>;
  }

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[36px_1fr_52px_52px_52px] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate bg-surface-2 border-b border-white/8">
        <span>#</span>
        <span>Participante</span>
        <span className="text-center">Acertos</span>
        <span className="text-center">Cravadas</span>
        <span className="text-right">Pts</span>
      </div>
      <ul>
        {sorted.map((u, idx) => {
          const pos = idx + 1;
          const isMe = u.uid === currentUid;
          const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : null;
          return (
            <li key={u.uid}
              className={`grid grid-cols-[36px_1fr_52px_52px_52px] px-4 py-3 items-center border-b border-white/5 last:border-0 transition ${isMe ? 'bg-green/8' : 'hover:bg-white/3'}`}
            >
              <span className="font-display text-lg text-slate">{medal || pos}</span>
              <div className="min-w-0 pr-2">
                <p className="font-semibold text-white truncate text-sm">
                  {u.displayName}
                  {isMe && <span className="ml-1 text-[10px] text-green-light font-bold">(você)</span>}
                </p>
                <p className="text-[11px] text-slate truncate">@{u.username}</p>
              </div>
              <p className="text-center text-sm font-semibold text-white/70">{u.correctResults || 0}</p>
              <p className="text-center text-sm font-bold text-yellow-400">{u.exactScores || 0}</p>
              <p className="text-right font-display text-xl text-green-light">{u.totalPoints || 0}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
