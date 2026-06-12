import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../routes/AuthContext';
import { useBella } from '../routes/BellaContext';
import { logout } from '../services/authService';
import { subscribeSettings } from '../services/settingsService';
import BottomNav from './BottomNav';

const SCORING = [
  { pts: 5, label: 'Placar exato',                  color: 'text-yellow-400', bg: 'bg-yellow-500/15 border border-yellow-500/30' },
  { pts: 1, label: 'Acertou o vencedor ou empate',  color: 'text-green-light', bg: 'bg-green/15 border border-green/30' },
  { pts: 0, label: 'Errou tudo',                    color: 'text-slate',       bg: 'bg-white/5 border border-white/8' }
];

export default function Layout() {
  const { profile }     = useAuth();
  const { bella, toggle } = useBella();
  const navigate        = useNavigate();
  const location        = useLocation();
  const [showRules, setShowRules] = useState(false);
  const [settings, setSettings]   = useState(null);
  const isKnockoutPage = location.pathname.startsWith('/mata-mata');

  useEffect(() => {
    return subscribeSettings(setSettings);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const desktopLinks = [
    { to: '/', label: 'Jogos', end: true },
    { to: '/palpites', label: 'Palpites' },
    { to: '/mata-mata', label: 'Mata-mata' },
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
                {profile.displayName} · <span className="text-green-light font-semibold">{profile.totalPoints || 0} pts</span>
              </p>
            )}
          </div>

          {/* Botões do header */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Modo Bella */}
            <button
              onClick={toggle}
              title={bella ? 'Desativar Modo Bella' : 'Ativar Modo Bella'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition border ${
                bella
                  ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                  : 'bg-white/6 border-white/10 text-slate hover:bg-white/10'
              }`}
            >
              <span>💅</span>
              <span className="hidden sm:inline">Modo Bella</span>
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
                  {SCORING.map(r => (
                    <div key={r.pts} className={`${r.bg} rounded-xl p-3 text-center`}>
                      <p className={`font-display text-2xl ${r.color}`}>{r.pts}</p>
                      <p className="text-[10px] text-slate uppercase tracking-wider">pts</p>
                      <p className="text-[11px] text-white/70 mt-1">{r.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {settings && (
                <div>
                  <p className="text-[10px] text-slate uppercase tracking-wider font-bold mb-2">
                    Premiação · {settings.currency} {settings.betAmount} por participante
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { pos: '🥇 1º', pct: settings.prize1, color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' },
                      { pos: '🥈 2º', pct: settings.prize2, color: 'text-slate',      bg: 'bg-white/8 border-white/10' },
                      { pos: '🥉 3º', pct: settings.prize3, color: 'text-amber-600', bg: 'bg-amber-900/20 border-amber-700/30' }
                    ].map(p => (
                      <div key={p.pos} className={`rounded-xl border p-3 text-center ${p.bg}`}>
                        <p className="text-sm font-bold text-white">{p.pos}</p>
                        <p className={`font-display text-xl mt-1 ${p.color}`}>{p.pct}%</p>
                        <p className="text-[10px] text-slate">{p.pct}% do total</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[11px] text-slate">Palpites bloqueiam 1h antes do jogo. Ranking atualiza em tempo real durante os jogos.</p>
            </div>
          </div>
        )}
      </header>

      {/* Barra mobile: regras + modo bella info */}
      <div className="sm:hidden px-4 pt-3 flex gap-2">
        <button onClick={() => setShowRules(!showRules)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-white/6 border border-white/8 text-xs font-semibold text-slate">
          <InfoIcon /> {showRules ? 'Fechar' : 'Regras e premiação'}
        </button>
      </div>

      {/* Painel de regras mobile */}
      {showRules && (
        <div className="sm:hidden mx-4 mt-2 card p-3 space-y-3">
          {SCORING.map(r => (
            <div key={r.pts} className={`${r.bg} rounded-lg p-2 flex items-center gap-3`}>
              <span className={`font-display text-2xl w-8 text-center ${r.color}`}>{r.pts}</span>
              <span className="text-xs text-white/80">{r.label}</span>
            </div>
          ))}
          {settings && (
            <div className="pt-2 border-t border-white/8">
              <p className="text-[11px] text-slate mb-2">
                Valor por participante: <span className="text-green-light font-bold">{settings.currency} {settings.betAmount}</span>
              </p>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                <div className="bg-yellow-500/15 rounded-lg p-2"><p className="text-yellow-400 font-display text-base">{settings.prize1}%</p><p className="text-slate">1º lugar</p></div>
                <div className="bg-white/8 rounded-lg p-2"><p className="text-slate font-display text-base">{settings.prize2}%</p><p className="text-slate">2º lugar</p></div>
                <div className="bg-amber-900/20 rounded-lg p-2"><p className="text-amber-600 font-display text-base">{settings.prize3}%</p><p className="text-slate">3º lugar</p></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Banner Modo Bella ativo */}
      {bella && (
        <div className="mx-4 mt-3 rounded-xl bg-pink-500/15 border border-pink-500/30 px-3 py-2 flex items-center justify-between">
          <p className="text-xs text-pink-300 font-semibold">💅 Modo Bella ativado — nomes por extenso em português</p>
          <button onClick={toggle} className="text-pink-400 text-xs underline ml-3">desativar</button>
        </div>
      )}

      <main className={`flex-1 mx-auto w-full pt-4 pb-28 md:pb-10 ${
        isKnockoutPage ? 'max-w-[1500px] px-2 sm:px-4' : 'max-w-5xl px-4'
      }`}>
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
