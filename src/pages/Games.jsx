import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../routes/AuthContext';
import { subscribeGames } from '../services/gameService';
import { subscribeMyPredictions } from '../services/predictionService';
import { subscribePoolSettings } from '../services/settingsService';
import { dayKey, dayLabel, toMillis } from '../utils/dates';
import GameCard from '../components/GameCard';
import PredictionForm from '../components/PredictionForm';
import Loading from '../components/Loading';

const STATUS_FILTERS = [
  { key: 'all',      label: 'Todos' },
  { key: 'upcoming', label: 'Próximos' },
  { key: 'today',    label: 'Hoje' },
  { key: 'live',     label: 'Ao vivo' },
  { key: 'finished', label: 'Encerrados' }
];

export default function Games() {
  const { user, profile } = useAuth();
  const [games, setGames]   = useState(null);
  const [preds, setPreds]   = useState(null);
  const [settings, setSettings] = useState(null);
  const [filter, setFilter] = useState('all');
  const [view, setView]     = useState('group');      // 'group' | 'chrono'
  const [activeGroup, setActiveGroup] = useState(null);

  useEffect(() => {
    setPreds(null);
    const u1 = subscribeGames(setGames);
    const u2 = subscribeMyPredictions(user.uid, setPreds);
    return () => { u1(); u2(); };
  }, [user.uid]);

  useEffect(() => {
    if (!profile?.activePoolId) {
      setSettings(null);
      return;
    }
    const unsub = subscribePoolSettings(profile.activePoolId, setSettings);
    return unsub;
  }, [profile?.activePoolId]);

  const predMap = useMemo(() => {
    const m = new Map();
    (preds || []).forEach(p => m.set(p.gameId, p));
    return m;
  }, [preds]);

  /* lista de grupos disponíveis */
  const groups = useMemo(() => {
    if (!games) return [];
    const s = new Set(games.map(g => g.group).filter(Boolean));
    return Array.from(s).sort();
  }, [games]);

  /* lista filtrada por status */
  const filtered = useMemo(() => {
    if (!games) return [];
    const todayKey = dayKey(new Date());
    const now = Date.now();
    return games.filter(g => {
      const ms = toMillis(g.startTime);
      if (filter === 'upcoming') return ms > now && g.status !== 'finished';
      if (filter === 'today')    return dayKey(g.startTime) === todayKey;
      if (filter === 'live')     return g.status === 'live';
      if (filter === 'finished') return g.status === 'finished';
      return true;
    });
  }, [games, filter]);

  /* agrupado por grupo (view === 'group') */
  const byGroup = useMemo(() => {
    let list = filtered;
    if (activeGroup) list = list.filter(g => g.group === activeGroup);
    const map = new Map();
    list.forEach(g => {
      const grp = g.group || 'Fase Final';
      if (!map.has(grp)) map.set(grp, []);
      map.get(grp).push(g);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, activeGroup]);

  /* agrupado por data (view === 'chrono') */
  const byChrono = useMemo(() => {
    const map = new Map();
    filtered.forEach(g => {
      const k = dayKey(g.startTime);
      if (!map.has(k)) map.set(k, { label: dayLabel(g.startTime), items: [] });
      map.get(k).items.push(g);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const stats = useMemo(() => {
    if (!games) return null;
    const now = Date.now();
    return {
      total:    games.length,
      feitos:   preds?.length || 0,
      live:     games.filter(g => g.status === 'live').length,
      proximos: games.filter(g => toMillis(g.startTime) > now && g.status !== 'finished').length
    };
  }, [games, preds]);

  if (games === null || preds === null) return <Loading />;

  return (
    <div className="space-y-4">

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Jogos',    val: stats.total,    color: 'text-white' },
            { label: 'Palpites', val: stats.feitos,   color: 'text-green-light' },
            { label: 'Próximos', val: stats.proximos, color: 'text-white' },
            { label: 'Ao Vivo',  val: stats.live,     color: stats.live > 0 ? 'text-red-400' : 'text-slate' }
          ].map(s => (
            <div key={s.label} className="card bg-surface-2 p-3 text-center">
              <p className={`font-display text-2xl ${s.color}`}>{s.val}</p>
              <p className="text-[10px] text-slate uppercase tracking-wider font-semibold">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toggle de visualização */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView('group')}
          className={view === 'group' ? 'tab-btn-active' : 'tab-btn-idle'}
        >
          Por grupo
        </button>
        <button
          onClick={() => setView('chrono')}
          className={view === 'chrono' ? 'tab-btn-active' : 'tab-btn-idle'}
        >
          Cronológico
        </button>

        {/* Filtro de status */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar ml-auto">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={filter === f.key ? 'tab-btn-active' : 'tab-btn-idle'}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-filtro de grupo (apenas em view=group) */}
      {view === 'group' && groups.length > 1 && (
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 no-scrollbar pb-1">
          <button onClick={() => setActiveGroup(null)}
            className={!activeGroup ? 'tab-btn-active' : 'tab-btn-idle'}>
            Todos
          </button>
          {groups.map(g => (
            <button key={g} onClick={() => setActiveGroup(g)}
              className={activeGroup === g ? 'tab-btn-active' : 'tab-btn-idle'}>
              Grupo {g}
            </button>
          ))}
        </div>
      )}

      {/* ── VIEW: POR GRUPO ── */}
      {view === 'group' && (
        byGroup.length === 0
          ? <Empty />
          : byGroup.map(([grp, list]) => (
              <Section key={grp} title={grp === 'Fase Final' ? 'FASE FINAL' : `GRUPO ${grp}`} icon={grp === 'Fase Final' ? '⚡' : grp} count={list.length}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {list.map(game => (
                    <GameCard key={game.id} game={game}>
                      <PredictionForm game={game} prediction={predMap.get(game.id)} settings={settings} />
                    </GameCard>
                  ))}
                </div>
              </Section>
            ))
      )}

      {/* ── VIEW: CRONOLÓGICO ── */}
      {view === 'chrono' && (
        byChrono.length === 0
          ? <Empty />
          : byChrono.map(([key, { label, items }]) => (
              <Section key={key} title={label.toUpperCase()} icon="📅" count={items.length}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map(game => (
                    <GameCard key={game.id} game={game}>
                      <PredictionForm game={game} prediction={predMap.get(game.id)} settings={settings} />
                    </GameCard>
                  ))}
                </div>
              </Section>
            ))
      )}
    </div>
  );
}

function Section({ title, icon, count, children }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-7 h-7 rounded-lg bg-green/20 flex items-center justify-center shrink-0">
          <span className="font-display text-sm text-green-light">{icon}</span>
        </div>
        <h3 className="font-display text-base text-white tracking-wider">{title}</h3>
        <div className="flex-1 h-px bg-white/8" />
        <span className="text-[11px] text-slate">{count} jogos</span>
      </div>
      {children}
    </section>
  );
}

function Empty() {
  return <div className="card bg-surface-2 p-10 text-center text-slate">Nenhum jogo encontrado.</div>;
}
