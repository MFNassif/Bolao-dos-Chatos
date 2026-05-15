import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeGames } from '../services/gameService';
import { setGameResult, recalculateAllScores, setUserRole } from '../services/adminService';
import { subscribeSettings, saveSettings, DEFAULT_SETTINGS } from '../services/settingsService';
import { formatDateTime } from '../utils/dates';
import Loading from '../components/Loading';

const TABS = [
  { key: 'settings', label: '⚙ Config' },
  { key: 'games',    label: '⚽ Jogos' },
  { key: 'users',    label: '👥 Usuários' },
  { key: 'logs',     label: '📋 Logs' }
];

export default function Admin() {
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
        <p className="text-sm text-slate">Configurações, jogos, usuários e logs.</p>
      </div>

      {/* Ações rápidas */}
      <div className="card bg-surface-2 p-4 space-y-3">
        <h3 className="text-[11px] text-slate font-bold uppercase tracking-wider">Ações rápidas</h3>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className="btn-gold" onClick={() => run('Recalcular', async () => {
            const r = await recalculateAllScores();
            return { message: `Recálculo: ${r.predictions} palpites · ${r.users} usuários.` };
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

      {tab === 'settings' && <SettingsAdmin busy={busy} onRun={run} />}
      {tab === 'games'    && <GamesAdmin busy={busy} onRun={run} />}
      {tab === 'users'    && <UsersAdmin busy={busy} onRun={run} />}
      {tab === 'logs'     && <LogsAdmin />}
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────
function SettingsAdmin({ busy, onRun }) {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);

  useEffect(() => {
    const unsub = subscribeSettings(s => {
      setSettings(s);
      setForm(prev => prev || s);
    });
    return unsub;
  }, []);

  if (!form) return <Loading />;

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSave() {
    await onRun('Salvar configurações', async () => {
      await saveSettings(form);
      return { message: 'Configurações salvas!' };
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
function GamesAdmin({ busy, onRun }) {
  const [games, setGames] = useState(null);
  useEffect(() => subscribeGames(setGames), []);
  if (games === null) return <Loading />;
  if (!games.length) return (
    <div className="card bg-surface-2 p-8 text-center text-slate text-sm">
      Nenhum jogo. Dispare o workflow <strong>Sync Games</strong> no GitHub Actions.
    </div>
  );
  return (
    <div className="space-y-3">
      {games.map(g => <GameRow key={g.id} game={g} busy={busy} onRun={onRun} />)}
    </div>
  );
}

function GameRow({ game, busy, onRun }) {
  const [home, setHome] = useState(game.homeScore ?? '');
  const [away, setAway] = useState(game.awayScore ?? '');
  const [status, setStatus] = useState(game.status || 'scheduled');
  const [editing, setEditing] = useState(false);

  async function save() {
    await onRun('Salvar resultado', async () => {
      await setGameResult({ gameId: game.id, homeScore: home === '' ? null : Number(home), awayScore: away === '' ? null : Number(away), status });
      return { message: 'Resultado salvo e pontuação atualizada.' };
    });
    setEditing(false);
  }

  return (
    <article className="card bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-white truncate text-sm">{game.homeTeam} × {game.awayTeam}</p>
          <p className="text-[11px] text-slate">{formatDateTime(game.startTime)} · {game.stage}</p>
        </div>
        <span className={`chip ${game.status === 'finished' ? 'bg-white/8 text-slate' : game.status === 'live' ? 'bg-red-500/20 text-red-400' : 'bg-green/20 text-green-light'}`}>
          {game.status}
        </span>
      </div>

      {Number.isInteger(game.homeScore) && (
        <p className="font-display text-2xl text-white mb-2">{game.homeScore} <span className="text-slate">×</span> {game.awayScore}</p>
      )}

      {!editing ? (
        <button className="btn-ghost text-xs" onClick={() => setEditing(true)} disabled={busy}>Ajustar resultado</button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input inputMode="numeric" className="score-input !w-11 !h-11 !text-lg" value={home} onChange={e => setHome(e.target.value.replace(/\D+/g, '').slice(0,2))} />
            <span className="text-slate font-display text-xl">×</span>
            <input inputMode="numeric" className="score-input !w-11 !h-11 !text-lg" value={away} onChange={e => setAway(e.target.value.replace(/\D+/g, '').slice(0,2))} />
            <select className="input !py-2 max-w-[150px]" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="scheduled">scheduled</option>
              <option value="live">live</option>
              <option value="finished">finished</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary text-xs" disabled={busy} onClick={save}>Salvar e pontuar</button>
            <button className="btn-ghost text-xs" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </article>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
function UsersAdmin({ busy, onRun }) {
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('totalPoints', 'desc'), limit(200)));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, []);

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

  return (
    <div className="space-y-3">
      <input className="input" placeholder="Buscar usuário..." value={q} onChange={e => setQ(e.target.value)} />
      <div className="card overflow-hidden">
        <ul>
          {filtered.map(u => (
            <li key={u.uid} className="px-4 py-3 border-b border-white/5 last:border-0 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate text-sm">{u.displayName}</p>
                <p className="text-[11px] text-slate">@{u.username} · {u.totalPoints || 0} pts</p>
              </div>
              <span className={`chip ${u.role === 'admin' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/8 text-slate'}`}>{u.role}</span>
              <button className="btn-ghost text-xs" disabled={busy} onClick={() => toggleRole(u)}>
                {u.role === 'admin' ? 'Tornar user' : 'Tornar admin'}
              </button>
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
