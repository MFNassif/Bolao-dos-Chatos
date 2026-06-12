import { NavLink } from 'react-router-dom';
import { useAuth } from '../routes/AuthContext';

const items = [
  { to: '/', label: 'Jogos', end: true, icon: BallIcon },
  { to: '/palpites', label: 'Palpites', icon: TicketIcon },
  { to: '/mata-mata', label: 'Mata-mata', icon: BracketIcon },
  { to: '/ranking', label: 'Ranking', icon: TrophyIcon }
];

export default function BottomNav() {
  const { profile } = useAuth();
  const nav = [...items];
  if (profile?.role === 'admin') nav.push({ to: '/admin', label: 'Admin', icon: GearIcon });

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 safe-bottom bg-surface/95 backdrop-blur border-t border-white/8">
      <ul className="flex items-stretch justify-around px-2 pt-1 pb-2">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink to={to} end={!!end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[10px] font-bold tracking-wide transition ${
                  isActive ? 'text-green-light' : 'text-slate'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`w-10 h-8 rounded-xl flex items-center justify-center transition ${isActive ? 'bg-green/20' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function BallIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 3l3 5-1.5 4.5L9 13l-2-4z"/><path d="M21 12l-4 .5-3 3 1 4"/><path d="M3 12l4 1 2 4-2 3"/></svg>;
}
function TicketIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 7v10" strokeDasharray="2 2"/></svg>;
}
function TrophyIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/></svg>;
}
function BracketIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 4h4v4H6z"/><path d="M6 16h4v4H6z"/><path d="M14 10h4v4h-4z"/><path d="M10 6h2a2 2 0 0 1 2 2v4"/><path d="M10 18h2a2 2 0 0 0 2-2v-4"/></svg>;
}
function GearIcon(p) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
}
