import { useEffect, useMemo, useState } from 'react';
import { subscribeGames } from '../services/gameService';
import { subscribePoolPredictionsForGame } from '../services/predictionService';
import { getPoolMembers } from '../services/poolService';
import { subscribePoolSettings } from '../services/settingsService';
import { isLocked } from '../utils/locks';
import { formatTime, formatDate } from '../utils/dates';
import { useBella } from '../routes/BellaContext';
import { useAuth } from '../routes/AuthContext';
import { getFullName } from '../utils/teamNames';
import { scorePrediction } from '../utils/scoring';
import Loading from '../components/Loading';

export default function Predictions() {
  const { bella } = useBella();
  const { profile } = useAuth();
  const [games, setGames]               = useState(null);
  const [users, setUsers]               = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedGame, setSelectedGame]   = useState(null);
  const [selectedUser, setSelectedUser]   = useState('');
  const [preds, setPreds]               = useState([]);
  const [settings, setSettings]         = useState(null);

  // Carrega jogos
  useEffect(() => {
    const unsub = subscribeGames(g => {
      setGames(g);
      setSelectedGame(cur => {
        if (cur) return cur;
        const locked = g.filter(x => isLocked(x.startTime));
        return locked[locked.length - 1]?.id || g[0]?.id || null;
      });
    });
    return unsub;
  }, []);

  // Carrega participantes do bolao ativo.
  useEffect(() => {
    if (!profile?.activePoolId) return;
    let cancelled = false;
    setSelectedUser('');
    getPoolMembers(profile.activePoolId)
      .then((list) => {
        if (!cancelled) {
          setUsers([...list].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')));
        }
      })
      .catch(() => { if (!cancelled) setUsers([]); });
    return () => { cancelled = true; };
  }, [profile?.activePoolId]);

  useEffect(() => {
    if (!profile?.activePoolId) {
      setSettings(null);
      return;
    }
    const unsub = subscribePoolSettings(profile.activePoolId, setSettings);
    return unsub;
  }, [profile?.activePoolId]);

  // Palpites do jogo selecionado
  useEffect(() => {
    if (!selectedGame || !profile?.activePoolId) {
      setPreds([]);
      return;
    }
    const unsub = subscribePoolPredictionsForGame(profile.activePoolId, selectedGame, setPreds);
    return unsub;
  }, [profile?.activePoolId, selectedGame]);

  // Grupos disponíveis
  const groups = useMemo(() => {
    if (!games) return [];
    const s = new Set(games.map(g => g.group).filter(Boolean));
    return Array.from(s).sort();
  }, [games]);

  // Jogos filtrados pelo grupo
  const gamesInGroup = useMemo(() => {
    if (!games) return [];
    if (!selectedGroup) return games;
    if (selectedGroup === '__final__') return games.filter(g => !g.group);
    return games.filter(g => g.group === selectedGroup);
  }, [games, selectedGroup]);

  // Ao trocar grupo, reseta para o primeiro jogo do grupo
  useEffect(() => {
    if (gamesInGroup.length > 0) setSelectedGame(gamesInGroup[0].id);
  }, [selectedGroup]); // eslint-disable-line

  const currentGame = useMemo(
    () => games?.find(g => g.id === selectedGame) || null,
    [games, selectedGame]
  );

  // Filtra palpites pelo participante selecionado
  const filteredPreds = useMemo(() => {
    const memberIds = new Set(users.map(u => u.uid));
    const poolPreds = preds.filter(p => memberIds.has(p.userId));
    const list = selectedUser ? poolPreds.filter(p => p.userId === selectedUser) : poolPreds;
    return list.map(p => ({ ...p, poolScore: predictionScoreForGame(p, currentGame, settings) }));
  }, [currentGame, preds, selectedUser, settings, users]);

  function teamLabel(code, name) {
    return bella ? getFullName(code, name) : (code || name);
  }

  if (games === null) return <Loading />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl text-white tracking-wider">PALPITES</h2>
        <p className="text-sm text-slate">Aparecem para todos assim que alguém palpitar.</p>
      </div>

      {/* Filtros */}
      <div className="card bg-surface-2 p-4 space-y-4">

        {/* Grupo */}
        <div>
          <label className="text-[11px] font-bold text-slate uppercase tracking-wider mb-1.5 block">Grupo</label>
          <select className="input" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
            <option value="">Todos os grupos</option>
            {groups.map(g => <option key={g} value={g}>Grupo {g}</option>)}
            <option value="__final__">Fase Final</option>
          </select>
        </div>

        {/* Jogo */}
        <div>
          <label className="text-[11px] font-bold text-slate uppercase tracking-wider mb-1.5 block">Jogo</label>
          <select className="input" value={selectedGame || ''} onChange={e => setSelectedGame(e.target.value)}>
            <option value="">Selecione um jogo...</option>
            {gamesInGroup.map(g => (
              <option key={g.id} value={g.id}>
                {teamLabel(g.homeTeamCode, g.homeTeam)} × {teamLabel(g.awayTeamCode, g.awayTeam)}
                {' — '}{formatDate(g.startTime)} {formatTime(g.startTime)}
              </option>
            ))}
          </select>
        </div>

        {/* Participante — menu suspenso */}
        <div>
          <label className="text-[11px] font-bold text-slate uppercase tracking-wider mb-1.5 block">Participante</label>
          <select className="input" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
            <option value="">Todos os participantes</option>
            {users.map(u => (
              <option key={u.uid} value={u.uid}>{u.displayName} (@{u.username})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Card do jogo selecionado */}
      {currentGame && (
        <div className="card bg-surface-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] text-slate uppercase tracking-wider font-semibold">
              {currentGame.stage}{currentGame.group ? ` · Grupo ${currentGame.group}` : ''}
            </span>
            <span className={`chip ${
              currentGame.status === 'live'     ? 'bg-red-500/20 text-red-400 animate-pulse' :
              currentGame.status === 'finished' ? 'bg-white/8 text-slate' :
              'bg-green/20 text-green-light'
            }`}>
              {currentGame.status === 'live'     ? '● AO VIVO' :
               currentGame.status === 'finished' ? 'Encerrado' :
               formatTime(currentGame.startTime)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <FlagBox flag={currentGame.homeTeamFlag} code={currentGame.homeTeamCode} />
              <p className="text-xs font-bold text-white text-center">
                {teamLabel(currentGame.homeTeamCode, currentGame.homeTeam)}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center" style={{ width: 120 }}>
              {Number.isInteger(currentGame.homeScore) && Number.isInteger(currentGame.awayScore) ? (
                <div className="flex items-center justify-center gap-2 w-full">
                  <span className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center font-display text-xl text-white">
                    {currentGame.homeScore}
                  </span>
                  <span className="w-4 text-center font-display text-base text-slate">×</span>
                  <span className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center font-display text-xl text-white">
                    {currentGame.awayScore}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 w-full">
                  <span className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center font-display text-xl text-white/20">-</span>
                  <span className="w-4 text-center font-display text-base text-slate">×</span>
                  <span className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center font-display text-xl text-white/20">-</span>
                </div>
              )}
              <p className="text-[10px] text-slate mt-1">{formatDate(currentGame.startTime)}</p>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <FlagBox flag={currentGame.awayTeamFlag} code={currentGame.awayTeamCode} />
              <p className="text-xs font-bold text-white text-center">
                {teamLabel(currentGame.awayTeamCode, currentGame.awayTeam)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de palpites */}
      {currentGame && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-white/8 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate uppercase tracking-wider">
              {filteredPreds.length} palpite{filteredPreds.length !== 1 ? 's' : ''}
            </h3>
            {currentGame.status === 'live' && (
              <span className="text-[11px] text-red-400 animate-pulse font-semibold">● ao vivo</span>
            )}
            {currentGame.status === 'finished' && (
              <span className="text-[11px] text-slate">resultado final</span>
            )}
          </div>

          {filteredPreds.length === 0 && (
            <div className="p-8 text-center text-slate text-sm">Nenhum palpite encontrado.</div>
          )}

          <ul>
            {filteredPreds
              .slice().sort((a, b) => (b.poolScore.points || 0) - (a.poolScore.points || 0))
              .map(p => (
                <li key={p.id} className="px-4 py-3 border-b border-white/5 last:border-0 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate text-sm">{p.displayName}</p>
                    <p className="text-[11px] text-slate">@{p.username}</p>
                  </div>
                  <div className="font-display text-lg text-white/80 tabular-nums">
                    {p.homePrediction}<span className="text-slate mx-0.5">×</span>{p.awayPrediction}
                  </div>
                  <div className="w-20 text-right">
                    <PointsBadge
                      points={p.poolScore.points || 0}
                      exact={p.poolScore.exactScoreHit}
                      result={p.poolScore.resultHit}
                      isLive={currentGame.status === 'live'}
                      isFinished={currentGame.status === 'finished'}
                    />
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FlagBox({ flag, code }) {
  return (
    <div className="w-9 h-9 rounded-lg bg-white/8 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
      {flag
        ? <img src={flag} alt={code} className="w-full h-full object-cover" loading="lazy" />
        : <span className="text-[9px] text-slate">{code}</span>
      }
    </div>
  );
}

function predictionScoreForGame(prediction, game, settings) {
  if (
    !game ||
    !Number.isInteger(game.homeScore) ||
    !Number.isInteger(game.awayScore)
  ) {
    return { points: 0, exactScoreHit: false, resultHit: false };
  }
  return scorePrediction(
    { home: prediction.homePrediction, away: prediction.awayPrediction },
    { home: game.homeScore, away: game.awayScore },
    settings
  );
}

function PointsBadge({ points, exact, result, isLive, isFinished }) {
  const pulse = isLive ? 'animate-pulse' : '';
  if (!isLive && !isFinished) return <span className="chip bg-white/8 text-slate">aguardando</span>;
  if (exact)  return <span className={`chip bg-yellow-500/20 text-yellow-400 ${pulse}`}>🎯 +{points}</span>;
  if (result) return <span className={`chip bg-green/20 text-green-light ${pulse}`}>✓ +{points}</span>;
  return <span className="chip bg-white/8 text-slate">{isFinished ? '0 pts' : 'sem pts'}</span>;
}
