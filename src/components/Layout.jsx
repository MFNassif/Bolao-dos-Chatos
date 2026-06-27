import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../routes/AuthContext';
import { useBella } from '../routes/BellaContext';
import { logout } from '../services/authService';
import { DEFAULT_POOL_SETTINGS, subscribePoolSettings, calcPrizes } from '../services/settingsService';
import { getPoolMemberCount, subscribePoolMember } from '../services/poolService';
import BottomNav from './BottomNav';
import PoolGate from './PoolGate';
import PoolSwitcher from './PoolSwitcher';

export default function Layout() {
  const { user, profile, appSettings } = useAuth();
  const lockOneHourBefore = appSettings?.lockOneHourBefore !== false;
  const { bella, toggle } = useBella();
  const navigate        = useNavigate();
  const [showRules, setShowRules] = useState(false);
  const [settings, setSettings]   = useState(null);
  const [myMember, setMyMember]   = useState(null);
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    if (!profile?.activePoolId) {
      setSettings(null);
      return;
    }
    const unsub = subscribePoolSettings(profile.activePoolId, setSettings);
    return unsub;
  }, [profile?.activePoolId]);

  useEffect(() => {
    if (!profile?.activePoolId || !user?.uid) {
      setMyMember(null);
      setParticipantCount(0);
      return;
    }
    let cancelled = false;
    getPoolMemberCount(profile.activePoolId)
      .then(count => { if (!cancelled) setParticipantCount(count); })
      .catch(() => { if (!cancelled) setParticipantCount(0); });
    const unsub = subscribePoolMember(profile.activePoolId, user.uid, setMyMember);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [profile?.activePoolId, user?.uid]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const activeSettings = settings || DEFAULT_POOL_SETTINGS;
  const prizes = settings ? calcPrizes(activeSettings, participantCount) : null;
  const myPoints = myMember?.totalPoints ?? profile?.totalPoints ?? 0;
  const scoring = [
    { key: 'exact', pts: activeSettings.exactScorePoints, label: 'Placar exato', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border border-yellow-500/30' },
    { key: 'result', pts: activeSettings.correctResultPoints, label: 'Acertou o vencedor ou empate', color: 'text-green-light', bg: 'bg-green/15 border border-green/30' },
    { key: 'miss', pts: 0, label: 'Errou tudo', color: 'text-slate', bg: 'bg-white/5 border border-white/8' }
  ];

  if (profile && !profile.activePoolId) return <PoolGate />;

  const desktopLinks = [
    { to: '/', label: 'Jogos', end: true },
    { to: '/mata-mata', label: 'Mata-Mata' },
    { to: '/palpites', label: 'Palpites' },
    { to: '/ranking', label: 'Ranking' }
  ];
  if (profile?.role === 'admin') desktopLinks.push({ to: '/admin', label: 'Admin' });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="safe-top sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">

          {/* Logo */}
          <img src="/logo.png" alt="Bolão dos Chatos" className="w-10 h-10 rounded-xl object-cover shrink-0" />

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg leading-none text-white tracking-wider">BOLÃO DOS CHATOS</h1>
            {profile && (
              <p className="text-xs text-slate truncate">
                {profile.displayName} · {profile.activePoolName || 'Bolão'} · <span className="text-green-light font-semibold">{myPoints} pts</span>
                {prizes && prizes.total > 0 && (
                  <span className="ml-2 text-yellow-400 font-semibold">· {settings.currency} {prizes.total}</span>
                )}
              </p>
            )}
          </div>

          {/* Botões do header */}
          <div className="flex items-center gap-1.5 shrink-0">
            <PoolSwitcher />

            {/* Modo Diva */}
            <button
              onClick={toggle}
              title={bella ? 'Desativar Modo Diva' : 'Ativar Modo Diva'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition border ${
                bella
                  ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                  : 'bg-white/6 border-white/10 text-slate hover:bg-white/10'
              }`}
            >
              <span>💅</span>
              <span className="hidden sm:inline">Modo Diva</span>
            </button>

            {/* Regras */}
            <button
              onClick={() => setShowRules(!showRules)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/6 border border-white/10 hover:bg-white/10 transition text-xs font-semibold text-slate"
            >
              <InfoIcon /> Regras
            </button>

            {/* Nav desktop */}
            <nav className="hidden md:flex items-center gap-1">
              {desktopLinks.map(l => (
                <NavLink key={l.to} to={l.to} end={l.end}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-sm font-semibold transition ${isActive ? 'bg-green text-white' : 'text-slate hover:text-white hover:bg-white/8'}`
                  }>
                  {l.label}
                </NavLink>
              ))}
            </nav>

            <button onClick={handleLogout} className="btn-ghost text-xs px-3 py-2">Sair</button>
          </div>
        </div>

        {/* Painel de regras desktop */}
        {showRules && (
          <div className="border-t border-white/8 bg-surface-2">
            <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm text-white tracking-wider">REGRAS E PREMIAÇÃO</h3>
                <button onClick={() => setShowRules(false)} className="text-slate hover:text-white text-xl leading-none">×</button>
              </div>
              <div>
                <p className="text-[10px] text-slate uppercase tracking-wider font-bold mb-2">Pontuação</p>
                <div className="grid grid-cols-3 gap-2">
                  {scoring.map(r => (
                    <div key={r.key} className={`${r.bg} rounded-xl p-3 text-center`}>
                      <p className={`font-display text-2xl ${r.color}`}>{r.pts}</p>
                      <p className="text-[10px] text-slate uppercase tracking-wider">pts</p>
                      <p className="text-[11px] text-white/70 mt-1">{r.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {prizes && settings && (
                <div>
                  <p className="text-[10px] text-slate uppercase tracking-wider font-bold mb-2">
                    Premiação · {participantCount} participante{participantCount !== 1 ? 's' : ''} × {settings.currency} {settings.betAmount} = <span className="text-green-light">{settings.currency} {prizes.total}</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { pos: '🥇 1º', amount: prizes.first,  pct: settings.prize1, color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' },
                      { pos: '🥈 2º', amount: prizes.second, pct: settings.prize2, color: 'text-slate',      bg: 'bg-white/8 border-white/10' },
                      { pos: '🥉 3º', amount: prizes.third,  pct: settings.prize3, color: 'text-amber-600', bg: 'bg-amber-900/20 border-amber-700/30' }
                    ].map(p => (
                      <div key={p.pos} className={`rounded-xl border p-3 text-center ${p.bg}`}>
                        <p className="text-sm font-bold text-white">{p.pos}</p>
                        <p className={`font-display text-xl mt-1 ${p.color}`}>{settings.currency} {p.amount}</p>
                        <p className="text-[10px] text-slate">{p.pct}% do total</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[10px] text-slate uppercase tracking-wider font-bold mb-2">Critérios de desempate</p>
                <ol className="space-y-1 text-[11px] text-white/80">
                  <li><span className="text-slate font-semibold mr-1">1.</span>Mais pontos</li>
                  <li><span className="text-slate font-semibold mr-1">2.</span>Mais cravadas (placar exato)</li>
                  <li><span className="text-slate font-semibold mr-1">3.</span>Placar mais perto (menor erro de gols)</li>
                  <li><span className="text-slate font-semibold mr-1">4.</span>Mais palpites feitos</li>
                </ol>
                <p className="text-[11px] text-slate mt-1.5">Persistindo o empate, o prêmio é dividido.</p>
              </div>
              <p className="text-[11px] text-slate">
                {lockOneHourBefore
                  ? 'Palpites bloqueiam 1h antes do início do jogo.'
                  : 'Palpites podem ser editados até o início do jogo.'}
                {' '}O ranking é atualizado conforme os resultados são lançados.
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Barra mobile: abre o mesmo painel de regras (acima) */}
      <div className="sm:hidden px-4 pt-3 flex gap-2">
        <button onClick={() => setShowRules(!showRules)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-white/6 border border-white/8 text-xs font-semibold text-slate">
          <InfoIcon /> {showRules ? 'Fechar' : 'Regras e premiação'}
        </button>
      </div>

      {/* Banner Modo Diva ativo */}
      {bella && (
        <div className="mx-4 mt-3 rounded-xl bg-pink-500/15 border border-pink-500/30 px-3 py-2 flex items-center justify-between">
          <p className="text-xs text-pink-300 font-semibold">💅 Modo Diva ativado — nomes por extenso em português</p>
          <button onClick={toggle} className="text-pink-400 text-xs underline ml-3">desativar</button>
        </div>
      )}

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-4 pb-28 md:pb-10">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

function InfoIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
    </svg>
  );
}
