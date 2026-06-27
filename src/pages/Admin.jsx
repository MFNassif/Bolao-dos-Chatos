import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeGames } from '../services/gameService';
import { setGameResult, setGameTeams, recalculatePoolScores, recalculateAllPools, setUserRole, removeUserFromPool } from '../services/adminService';
import { DEFAULT_POOL_SETTINGS, subscribePoolSettings, savePoolSettings, subscribeAppSettings, saveAppSettings } from '../services/settingsService';
import { createPool, getPoolMembers, getPoolsForAdmin, joinPoolWithPassword } from '../services/poolService';
import { useAuth } from '../routes/AuthContext';
import { formatDateTime } from '../utils/dates';
import { stageLabel } from '../utils/stages';
import Loading from '../components/Loading';

const TABS = [
  { key: 'settings', label: '⚙ Config' },
  { key: 'pools',    label: '🏆 Bolões' },
  { key: 'games',    label: '⚽ Jogos' },
  { key: 'users',    label: '👥 Usuários' },
  { key: 'logs',     label: '📋 Logs' }
];

export default function Admin() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState('settings');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function run(label, fn) {
    setBusy(true); setMsg(null);
    try {
      const result = await fn();
      setMsg({ type: 'success', text: result?.message || `${label}: ok.` });
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || `Erro em ${label}.` });
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 4500);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl text-white tracking-wider">ADMIN</h2>
        <p className="text-sm text-slate">Configurações, bolões, jogos, usuários e logs.</p>
      </div>

      {/* Ações rápidas */}
      <div className="card bg-surface-2 p-4 space-y-3">
        <h3 className="text-[11px] text-slate font-bold uppercase tracking-wider">Ações rápidas</h3>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className="btn-gold" onClick={() => run('Recalcular', async () => {
            const r = await recalculateAllPools();
            return { message: `Recálculo de todos os bolões: ${r.members} membros · ${r.pools} bolões.` };
          })}>
            Recalcular pontuação
          </button>
        </div>
        {msg && (
          <p className={`text-sm font-semibold ${msg.type === 'success' ? 'text-green-light' : 'text-red-400'}`}>
            {msg.text}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 no-scrollbar pb-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={tab === t.key ? 'tab-btn-active' : 'tab-btn-idle'}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <div className="space-y-4">
          <AppLockSettings busy={busy} onRun={run} />
          <SettingsAdmin busy={busy} onRun={run} activePoolId={profile?.activePoolId} activePoolName={profile?.activePoolName} />
        </div>
      )}
      {tab === 'pools'    && <PoolsAdmin busy={busy} onRun={run} user={user} profile={profile} />}
      {tab === 'games'    && <GamesAdmin busy={busy} onRun={run} />}
      {tab === 'users'    && <UsersAdmin busy={busy} onRun={run} activePoolId={profile?.activePoolId} currentUid={user?.uid} />}
      {tab === 'logs'     && <LogsAdmin />}
    </div>
  );
}

// ─── Bloqueio global de palpites ───────────────────────────────────────────────
function AppLockSettings({ busy, onRun }) {
  const [settings, setSettings] = useState(null);
  useEffect(() => subscribeAppSettings(setSettings), []);
  if (!settings) return <Loading />;

  const enabled = settings.lockOneHourBefore !== false;

  async function toggle() {
    await onRun('Bloqueio de palpite', async () => {
      await saveAppSettings({ lockOneHourBefore: !enabled });
      return {
        message: !enabled
          ? 'Bloqueio ligado: palpites fecham 1h antes do jogo.'
          : 'Bloqueio desligado: palpites podem ser editados até o início do jogo.'
      };
    });
  }

  return (
    <div className="card bg-surface-2 p-4 space-y-3">
      <div>
        <h3 className="font-display text-base text-white tracking-wider">🔒 BLOQUEIO DE PALPITES</h3>
        <p className="text-xs text-slate mt-1">Configuração global — vale para todos os bolões.</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Bloquear 1 hora antes do jogo</p>
          <p className="text-[11px] text-slate mt-0.5">
            {enabled
              ? 'Ligado: o palpite trava 1h antes do início do jogo.'
              : 'Desligado: dá para editar o palpite até o horário de início do jogo.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          onClick={toggle}
          title={enabled ? 'Desligar bloqueio' : 'Ligar bloqueio'}
          className={`relative w-12 h-7 rounded-full transition shrink-0 disabled:opacity-50 ${enabled ? 'bg-green' : 'bg-white/15'}`}
        >
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${enabled ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────
function SettingsAdmin({ busy, onRun, activePoolId, activePoolName }) {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!activePoolId) return;
    setSettings(null);
    setForm(null);
    const unsub = subscribePoolSettings(activePoolId, s => {
      setSettings(s);
      setForm(s);
    });
    return unsub;
  }, [activePoolId]);

  if (!form) return <Loading />;

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSave() {
    await onRun('Salvar configurações', async () => {
      const prizeTotal = (form.prize1 || 0) + (form.prize2 || 0) + (form.prize3 || 0);
      if (prizeTotal !== 100) throw new Error(`A soma dos premios precisa ser 100%. Atual: ${prizeTotal}%.`);
      const scoringChanged =
        Number(form.exactScorePoints) !== Number(settings?.exactScorePoints ?? DEFAULT_POOL_SETTINGS.exactScorePoints) ||
        Number(form.correctResultPoints) !== Number(settings?.correctResultPoints ?? DEFAULT_POOL_SETTINGS.correctResultPoints);
      await savePoolSettings(activePoolId, form);
      if (scoringChanged) await recalculatePoolScores(activePoolId);
      return { message: scoringChanged ? 'Configurações salvas e pontuação recalculada!' : 'Configurações salvas!' };
    });
  }

  const total = (form.betAmount || 0) * 10; // preview com 10 pessoas
  const prizes = {
    first:  Math.round(total * (form.prize1 || 70) / 100),
    second: Math.round(total * (form.prize2 || 20) / 100),
    third:  Math.round(total * (form.prize3 || 10) / 100)
  };

  return (
    <div className="space-y-4">
      <div className="card bg-surface-2 p-4 space-y-4">
        <h3 className="font-display text-base text-white tracking-wider">💰 CONFIGURAÇÕES DO BOLÃO</h3>
        <p className="text-xs text-slate">Editando: <span className="text-white font-semibold">{activePoolName || activePoolId}</span></p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate font-bold uppercase tracking-wider block mb-1">Valor por participante</label>
            <div className="flex items-center gap-2">
              <select className="input !py-2 !px-2 max-w-[60px]" value={form.currency} onChange={e => set('currency', e.target.value)}>
                <option>R$</option><option>$</option><option>€</option>
              </select>
              <input type="number" className="input !py-2" min="0" step="1" value={form.betAmount}
                onChange={e => set('betAmount', Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div>
          <p className="text-[11px] text-slate font-bold uppercase tracking-wider mb-2">Distribuição dos prêmios (%)</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'prize1', label: '🥇 1º lugar', color: 'text-yellow-400' },
              { key: 'prize2', label: '🥈 2º lugar', color: 'text-slate' },
              { key: 'prize3', label: '🥉 3º lugar', color: 'text-amber-600' }
            ].map(({ key, label, color }) => (
              <div key={key}>
                <label className={`text-[11px] font-bold ${color} block mb-1`}>{label}</label>
                <div className="relative">
                  <input type="number" className="input !py-2 !pr-7" min="0" max="100" value={form[key]}
                    onChange={e => set(key, Number(e.target.value))} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate text-xs">%</span>
                </div>
              </div>
            ))}
          </div>
          {(form.prize1 || 0) + (form.prize2 || 0) + (form.prize3 || 0) !== 100 && (
            <p className="text-red-400 text-xs mt-1">⚠️ A soma deve ser 100%. Atual: {(form.prize1 || 0) + (form.prize2 || 0) + (form.prize3 || 0)}%</p>
          )}
        </div>

        <div>
          <p className="text-[11px] text-slate font-bold uppercase tracking-wider mb-2">Pontuacao</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-yellow-400 block mb-1">Placar exato</label>
              <input
                type="number"
                className="input !py-2"
                min="0"
                step="1"
                value={form.exactScorePoints}
                onChange={e => set('exactScorePoints', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-green-light block mb-1">Resultado certo</label>
              <input
                type="number"
                className="input !py-2"
                min="0"
                step="1"
                value={form.correctResultPoints}
                onChange={e => set('correctResultPoints', Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate mt-1">Ao alterar a pontuacao, o ranking dos membros desse bolao e recalculado.</p>
        </div>

        {/* Preview */}
        <div className="bg-white/5 rounded-xl p-3">
          <p className="text-[11px] text-slate mb-2">Preview com 10 participantes:</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div><p className="text-yellow-400 font-display text-lg">{form.currency} {prizes.first}</p><p className="text-slate">1º lugar</p></div>
            <div><p className="text-slate font-display text-lg">{form.currency} {prizes.second}</p><p className="text-slate">2º lugar</p></div>
            <div><p className="text-amber-600 font-display text-lg">{form.currency} {prizes.third}</p><p className="text-slate">3º lugar</p></div>
          </div>
          <p className="text-center text-[11px] text-slate mt-2">Montante total: <span className="text-green-light font-bold">{form.currency} {total}</span></p>
        </div>

        <button className="btn-primary w-full" disabled={busy} onClick={handleSave}>
          Salvar configurações
        </button>
      </div>
    </div>
  );
}

// ─── Games ────────────────────────────────────────────────────────────────────
function PoolsAdmin({ busy, onRun, user, profile }) {
  const [pools, setPools] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPoolsForAdmin()
      .then(list => { if (!cancelled) setPools(list); })
      .catch(() => { if (!cancelled) setPools([]); });
    return () => { cancelled = true; };
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    await onRun('Criar bolao', async () => {
      const created = await createPool({ name, password, admin: user });
      await joinPoolWithPassword({ user, profile, poolName: name, password });
      setPools(list => [...(list || []), { id: created.poolId, poolId: created.poolId, name: created.name }].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setName('');
      setPassword('');
      return { message: `Bolao ${created.name} criado. Voce tambem entrou nele.` };
    });
  }

  if (pools === null) return <Loading />;

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="card bg-surface-2 p-4 space-y-4">
        <div>
          <h3 className="font-display text-base text-white tracking-wider">CRIAR BOLAO</h3>
          <p className="text-xs text-slate mt-1">Nome e senha nao aparecem publicamente.</p>
        </div>
        <div>
          <label className="text-[11px] text-slate font-bold uppercase tracking-wider block mb-1">Nome</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="ex: Amigos da firma" required />
        </div>
        <div>
          <label className="text-[11px] text-slate font-bold uppercase tracking-wider block mb-1">Senha</label>
          <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
        </div>
        <button className="btn-primary w-full" disabled={busy} type="submit">
          Criar bolao
        </button>
      </form>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-white/8">
          <h3 className="text-xs font-bold text-slate uppercase tracking-wider">{pools.length} bolao{pools.length !== 1 ? 'es' : ''}</h3>
        </div>
        {pools.length === 0 ? (
          <div className="p-8 text-center text-slate text-sm">Nenhum bolao criado.</div>
        ) : (
          <ul>
            {pools.map(pool => (
              <li key={pool.id} className="px-4 py-3 border-b border-white/5 last:border-0">
                <p className="font-semibold text-white text-sm">{pool.name}</p>
                <p className="text-[11px] text-slate">id: {pool.id}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function GamesAdmin({ busy, onRun }) {
  const [games, setGames] = useState(null);
  useEffect(() => subscribeGames(next => {
    // Nao deixa um snapshot vazio/erro transitorio apagar uma lista ja boa
    // (isso desmontaria a linha em ediçao e fecharia o editor de placar).
    setGames(prev => (prev && prev.length && (!next || !next.length)) ? prev : next);
  }), []);

  // Lista de seleções (códigos reais com bandeira) para escolher confrontos.
  const teams = useMemo(() => {
    const map = new Map();
    for (const g of games || []) {
      for (const side of ['home', 'away']) {
        const code = g[`${side}TeamCode`];
        if (code && !map.has(code)) map.set(code, { code, name: g[`${side}Team`] || code, flag: g[`${side}TeamFlag`] || '' });
      }
    }
    return [...map.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [games]);

  if (games === null) return <Loading />;
  if (!games.length) return (
    <div className="card bg-surface-2 p-8 text-center text-slate text-sm">
      Nenhum jogo. Dispare o workflow <strong>Sync Games</strong> no GitHub Actions.
    </div>
  );
  return (
    <div className="space-y-3">
      {games.map(g => <GameRow key={g.id} game={g} busy={busy} onRun={onRun} teams={teams} />)}
    </div>
  );
}

const STATUS_LABELS = {
  scheduled: '⏳ Não começou',
  live: '🔴 Ao vivo',
  finished: '✅ Encerrado'
};

function GameRow({ game, busy, onRun, teams = [] }) {
  const [editing, setEditing] = useState(false);
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [status, setStatus] = useState('scheduled');
  const [editingTeams, setEditingTeams] = useState(false);
  const [homeSel, setHomeSel] = useState('__keep__');
  const [awaySel, setAwaySel] = useState('__keep__');
  const isKnockout = !game.group;

  function openTeams() {
    setHomeSel('__keep__');
    setAwaySel('__keep__');
    setEditingTeams(true);
  }

  async function saveTeams() {
    const resolve = (sel) => sel === '__keep__' ? undefined
      : (sel === '__clear__' ? null : (teams.find(t => t.code === sel) || null));
    await onRun('Editar confronto', async () => {
      await setGameTeams({ gameId: game.id, home: resolve(homeSel), away: resolve(awaySel) });
      return { message: 'Confronto atualizado.' };
    });
    setEditingTeams(false);
  }

  // Abre o editor capturando o estado atual do jogo UMA vez. Enquanto edita,
  // os campos sao estado local puro: snapshots em background nao os tocam
  // (era o que travava o preenchimento e exigia trocar de aba).
  function openEditor() {
    setHome(Number.isInteger(game.homeScore) ? String(game.homeScore) : '');
    setAway(Number.isInteger(game.awayScore) ? String(game.awayScore) : '');
    setStatus(game.status || 'scheduled');
    setEditing(true);
  }

  async function save() {
    await onRun('Salvar resultado', async () => {
      await setGameResult({
        gameId: game.id,
        homeScore: home === '' ? null : Number(home),
        awayScore: away === '' ? null : Number(away),
        status
      });
      return { message: 'Resultado salvo. Pontuação e ranking atualizados.' };
    });
    setEditing(false);
  }

  // Atalhos rápidos: iniciar / encerrar sem abrir o editor.
  async function quickStatus(newStatus, successMsg) {
    await onRun('Atualizar jogo', async () => {
      await setGameResult({
        gameId: game.id,
        homeScore: game.homeScore ?? null,
        awayScore: game.awayScore ?? null,
        status: newStatus
      });
      return { message: successMsg };
    });
  }

  // Ao digitar um placar num jogo que ainda não começou, marca como "ao vivo".
  // Sem isso o placar fica salvo mas NÃO conta pontos (jogo scheduled é ignorado).
  function changeScore(setter, raw) {
    const v = raw.replace(/\D+/g, '').slice(0, 2);
    setter(v);
    if (v !== '' && status === 'scheduled') setStatus('live');
  }

  // Vai contar pontos? (placar preenchido e jogo ao vivo/encerrado)
  const willScore = home !== '' && away !== '' && (status === 'live' || status === 'finished');
  const scoresButScheduled = home !== '' && away !== '' && status === 'scheduled';

  return (
    <article className="card bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-white truncate text-sm">{game.homeTeam} × {game.awayTeam}</p>
          <p className="text-[11px] text-slate">{formatDateTime(game.startTime)} · {stageLabel(game.stage)}</p>
        </div>
        <span className={`chip ${game.status === 'finished' ? 'bg-white/8 text-slate' : game.status === 'live' ? 'bg-red-500/20 text-red-400' : 'bg-green/20 text-green-light'}`}>
          {STATUS_LABELS[game.status] || game.status}
        </span>
      </div>

      {Number.isInteger(game.homeScore) && (
        <p className="font-display text-2xl text-white mb-2">{game.homeScore} <span className="text-slate">×</span> {game.awayScore}</p>
      )}

      {editingTeams ? (
        <div className="space-y-2">
          <p className="text-[11px] text-slate font-bold uppercase tracking-wider">Editar confronto</p>
          <div className="flex items-center gap-2 flex-wrap">
            <TeamSelect label={`Mandante (atual: ${game.homeTeam || 'A definir'})`} value={homeSel} onChange={setHomeSel} teams={teams} />
            <span className="text-slate font-display">×</span>
            <TeamSelect label={`Visitante (atual: ${game.awayTeam || 'A definir'})`} value={awaySel} onChange={setAwaySel} teams={teams} />
          </div>
          <p className="text-[11px] text-slate">"Manter" não altera o lado. Escolha uma seleção para definir, ou "A definir" para limpar. Não mexe no placar.</p>
          <div className="flex gap-2">
            <button className="btn-primary text-xs" disabled={busy} onClick={saveTeams}>Salvar confronto</button>
            <button className="btn-ghost text-xs" disabled={busy} onClick={() => setEditingTeams(false)}>Cancelar</button>
          </div>
        </div>
      ) : !editing ? (
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary text-xs" onClick={openEditor} disabled={busy}>Definir placar</button>
          {isKnockout && (
            <button className="btn-ghost text-xs text-blue-300" disabled={busy} onClick={openTeams}>Editar confronto</button>
          )}
          {game.status !== 'live' && (
            <button className="btn-ghost text-xs text-red-400" disabled={busy}
              onClick={() => quickStatus('live', 'Jogo marcado como AO VIVO.')}>Iniciar (ao vivo)</button>
          )}
          {game.status !== 'finished' && (
            <button className="btn-ghost text-xs" disabled={busy}
              onClick={() => quickStatus('finished', 'Jogo ENCERRADO. Pontuação final aplicada.')}>Encerrar</button>
          )}
          {game.status !== 'scheduled' && (
            <button className="btn-ghost text-xs" disabled={busy}
              onClick={() => quickStatus('scheduled', 'Jogo voltou para "não começou".')}>Reabrir</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input inputMode="numeric" className="score-input !w-11 !h-11 !text-lg" value={home} onChange={e => changeScore(setHome, e.target.value)} aria-label="Placar mandante" />
            <span className="text-slate font-display text-xl">×</span>
            <input inputMode="numeric" className="score-input !w-11 !h-11 !text-lg" value={away} onChange={e => changeScore(setAway, e.target.value)} aria-label="Placar visitante" />
            <select className="input !py-2 max-w-[170px]" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="scheduled">⏳ Não começou</option>
              <option value="live">🔴 Ao vivo</option>
              <option value="finished">✅ Encerrado</option>
            </select>
          </div>
          {scoresButScheduled ? (
            <p className="text-[11px] text-yellow-400">⚠️ Salvar como <b>“Não começou”</b> vai <b>apagar o placar</b>. Marque <b>Ao vivo</b> ou <b>Encerrado</b> para registrar o resultado.</p>
          ) : (
            <p className="text-[11px] text-slate">
              {willScore
                ? 'Ao salvar, este placar conta para a pontuação e o ranking é recalculado na hora.'
                : 'O placar conta quando o jogo está ao vivo ou encerrado.'}
            </p>
          )}
          <div className="flex gap-2">
            <button className="btn-primary text-xs" disabled={busy} onClick={save}>Salvar e pontuar</button>
            <button className="btn-ghost text-xs" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </article>
  );
}

function TeamSelect({ label, value, onChange, teams }) {
  return (
    <select className="input !py-2 max-w-[150px]" value={value} onChange={(e) => onChange(e.target.value)} title={label} aria-label={label}>
      <option value="__keep__">Manter atual</option>
      <option value="__clear__">— A definir —</option>
      {teams.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
    </select>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
function UsersAdmin({ busy, onRun, activePoolId, currentUid }) {
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!activePoolId) return;
    let cancelled = false;
    setUsers(null);
    getPoolMembers(activePoolId)
      .then(list => { if (!cancelled) setUsers(list); })
      .catch(() => { if (!cancelled) setUsers([]); });
    return () => { cancelled = true; };
  }, [activePoolId]);

  const filtered = useMemo(() => {
    if (!users) return [];
    if (!q) return users;
    const s = q.toLowerCase();
    return users.filter(u => (u.username || '').toLowerCase().includes(s) || (u.displayName || '').toLowerCase().includes(s));
  }, [users, q]);

  if (users === null) return <Loading />;

  async function toggleRole(u) {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Alterar ${u.displayName} para "${newRole}"?`)) return;
    await onRun('Alterar role', async () => {
      await setUserRole(u.uid, newRole);
      setUsers(list => list.map(x => x.uid === u.uid ? { ...x, role: newRole } : x));
      return { message: `${u.displayName} agora é ${newRole}.` };
    });
  }

  async function removeMember(u) {
    if (u.uid === currentUid) return;
    if (!confirm(`Remover ${u.displayName} deste bolao? Ele perdera acesso aos participantes, ranking e palpites deste grupo.`)) return;
    await onRun('Remover usuario', async () => {
      const result = await removeUserFromPool({ uid: u.uid, poolId: activePoolId, currentUid });
      setUsers(list => list.filter(x => x.uid !== u.uid));
      return { message: `${u.displayName} removido do bolao. ${result.removedPredictions} palpite(s) deixaram de aparecer no grupo.` };
    });
  }

  return (
    <div className="space-y-3">
      <input className="input" placeholder="Buscar usuário..." value={q} onChange={e => setQ(e.target.value)} />
      <p className="text-xs text-slate">Mostrando membros do bolão ativo.</p>
      <div className="card overflow-hidden">
        <ul>
          {filtered.map(u => (
            <li key={u.uid} className="px-4 py-3 border-b border-white/5 last:border-0 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate text-sm">{u.displayName}</p>
                <p className="text-[11px] text-slate">@{u.username} · {u.totalPoints || 0} pts</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`chip ${u.role === 'admin' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/8 text-slate'}`}>{u.role}</span>
                <button className="btn-ghost text-xs px-3 py-2" disabled={busy} onClick={() => toggleRole(u)}>
                  {u.role === 'admin' ? 'Tornar user' : 'Tornar admin'}
                </button>
                <button
                  className="btn-danger text-xs px-3 py-2"
                  disabled={busy || u.uid === currentUid}
                  title={u.uid === currentUid ? 'Voce nao pode remover a si mesmo' : 'Remover deste bolao'}
                  onClick={() => removeMember(u)}
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Logs ────────────────────────────────────────────────────────────────────
function LogsAdmin() {
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'syncLogs'), orderBy('createdAt', 'desc'), limit(50)));
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { setLogs([]); }
    })();
  }, []);
  if (logs === null) return <Loading />;
  if (!logs.length) return <div className="card bg-surface-2 p-8 text-center text-slate">Nenhum log ainda.</div>;
  return (
    <div className="card overflow-hidden">
      <ul>
        {logs.map(l => (
          <li key={l.id} className="px-4 py-3 border-b border-white/5 last:border-0">
            <p className="text-sm font-semibold text-white">{l.type} · {l.success === false ? '❌' : '✅'}</p>
            <p className="text-[11px] text-slate">{l.createdAt?.toDate?.().toLocaleString('pt-BR') || ''}</p>
            {l.message && <p className="text-xs text-white/70 mt-0.5">{l.message}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
