import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../routes/AuthContext';
import { useBella } from '../routes/BellaContext';
import { subscribeGames } from '../services/gameService';
import { subscribeMyKnockout, saveMyKnockout } from '../services/knockoutService';
import {
  buildBracket, resolveSlotTeams, isKnockoutLocked, parentChainIds,
  KNOCKOUT_DEADLINE_MS, ROUNDS
} from '../utils/knockout';
import { getFullName } from '../utils/teamNames';
import { formatDateTime } from '../utils/dates';
import Loading from '../components/Loading';

export default function MataMata() {
  const { user } = useAuth();
  const { bella } = useBella();
  const [games, setGames] = useState(null);
  const [savedDoc, setSavedDoc] = useState(null);
  const [picks, setPicks] = useState(null);
  const [save, setSave] = useState('idle'); // idle | saving | saved | error
  const locked = isKnockoutLocked();
  const firstLoad = useRef(true);

  useEffect(() => subscribeGames(setGames), []);
  useEffect(() => subscribeMyKnockout(user.uid, setSavedDoc), [user.uid]);

  // Inicializa o estado local a partir do que está salvo (uma vez).
  useEffect(() => {
    if (savedDoc && picks === null) setPicks(savedDoc.picks || {});
  }, [savedDoc, picks]);

  const bracket = useMemo(() => (games ? buildBracket(games) : null), [games]);

  // Auto-save com debounce (não salva no primeiro carregamento).
  useEffect(() => {
    if (picks === null || locked) return;
    if (firstLoad.current) { firstLoad.current = false; return; }
    setSave('saving');
    const t = setTimeout(async () => {
      try { await saveMyKnockout(user.uid, picks); setSave('saved'); }
      catch { setSave('error'); }
    }, 700);
    return () => clearTimeout(t);
  }, [picks, locked, user.uid]);

  function teamLabel(t) {
    if (!t) return null;
    return bella ? getFullName(t.code, t.name) : (t.code || t.name);
  }

  function setScore(slotId, side, raw) {
    const v = raw.replace(/\D+/g, '').slice(0, 2);
    setPicks((p) => ({ ...p, [slotId]: { ...(p[slotId] || {}), [side === 'home' ? 'homeScore' : 'awayScore']: v === '' ? undefined : Number(v) } }));
  }

  function setAdvance(roundKey, index, slotId, side) {
    setPicks((p) => {
      const next = { ...p, [slotId]: { ...(p[slotId] || {}), advance: side } };
      // Trocar o vencedor invalida os palpites das fases seguintes que dependem dele.
      for (const dep of parentChainIds(roundKey, index)) delete next[dep];
      return next;
    });
  }

  if (games === null || picks === null || bracket === null) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white tracking-wider">MATA-MATA</h2>
          <p className="text-sm text-slate">Monte seu chaveamento até a final.</p>
        </div>
        <SaveBadge state={save} locked={locked} />
      </div>

      {/* Regras / prazo */}
      <div className={`card p-3 text-[11px] leading-relaxed ${locked ? 'bg-red-950/30 border-red-800/30' : 'bg-surface-2'}`}>
        {locked ? (
          <p className="text-red-300 font-semibold">🔒 Palpites encerrados em {formatDateTime(KNOCKOUT_DEADLINE_MS)}. Agora é só visualização.</p>
        ) : (
          <p className="text-slate">
            Prazo: <span className="text-white font-semibold">{formatDateTime(KNOCKOUT_DEADLINE_MS)}</span> (Brasília). Escolha o placar e <b className="text-white">quem avança</b> em cada jogo (pode dar empate e decidir nos pênaltis). O vencedor sobe para a próxima fase no seu chaveamento.
          </p>
        )}
        <p className="text-slate mt-1">
          <b className="text-white">16-avos não pontuam</b> (servem para montar o chaveamento). A partir das oitavas: <b className="text-green-light">2 pts</b> acertando quem avança, <b className="text-yellow-400">4 pts</b> cravando placar + os dois times do confronto.
        </p>
      </div>

      {bracket.rounds.map((round) => (
        <section key={round.key}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-lg bg-green/20 flex items-center justify-center shrink-0">
              <span className="font-display text-xs text-green-light">{round.key === 'fin' ? '🏆' : round.slots.length}</span>
            </div>
            <h3 className="font-display text-base text-white tracking-wider">{round.label.toUpperCase()}</h3>
            {!round.scores && <span className="chip bg-white/8 text-slate text-[10px]">não pontua</span>}
            <div className="flex-1 h-px bg-white/8" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {round.slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                round={round}
                teams={resolveSlotTeams(bracket, slot.id, picks)}
                pick={picks[slot.id]}
                editable={!locked}
                teamLabel={teamLabel}
                onScore={setScore}
                onAdvance={setAdvance}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SaveBadge({ state, locked }) {
  if (locked) return <span className="chip bg-white/8 text-slate shrink-0">somente leitura</span>;
  if (state === 'saving') return <span className="chip bg-white/8 text-slate shrink-0">salvando…</span>;
  if (state === 'saved') return <span className="chip bg-green/20 text-green-light shrink-0">✓ salvo</span>;
  if (state === 'error') return <span className="chip bg-red-500/20 text-red-400 shrink-0">erro ao salvar</span>;
  return null;
}

function SlotCard({ slot, round, teams, pick, editable, teamLabel, onScore, onAdvance }) {
  const ready = !!(teams.home && teams.away);
  const canEdit = editable && ready;

  function Row({ side }) {
    const t = teams[side];
    const score = side === 'home' ? pick?.homeScore : pick?.awayScore;
    const isAdv = pick?.advance === side;
    return (
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition ${isAdv ? 'bg-green/15 border border-green/30' : 'border border-transparent'}`}>
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => onAdvance(round.key, slot.index, slot.id, side)}
          title={canEdit ? 'Marcar como classificado' : ''}
          className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center text-[10px] ${isAdv ? 'border-green bg-green text-white' : 'border-white/25 text-transparent'} ${canEdit ? 'hover:border-green' : ''}`}
        >✓</button>
        <span className="w-6 h-6 rounded bg-white/8 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
          {t?.flag ? <img src={t.flag} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="text-[8px] text-slate">{t?.code?.slice(0, 3) || '—'}</span>}
        </span>
        <span className={`flex-1 text-xs font-semibold truncate ${t ? 'text-white' : 'text-slate italic'}`}>
          {teamLabel(t) || 'A definir'}
        </span>
        <input
          inputMode="numeric" pattern="[0-9]*"
          disabled={!canEdit}
          value={Number.isInteger(score) ? score : ''}
          onChange={(e) => onScore(slot.id, side, e.target.value)}
          className="w-8 h-8 text-center text-base font-display rounded-lg bg-white/8 border border-white/15 text-white outline-none focus:border-green disabled:opacity-40"
          aria-label={`Placar ${teamLabel(t) || side}`}
        />
      </div>
    );
  }

  return (
    <article className="card bg-surface-2 p-2.5">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[10px] text-slate uppercase tracking-wider font-semibold">Jogo {slot.index + 1}</span>
        {!ready && <span className="text-[10px] text-slate italic">aguardando palpites</span>}
      </div>
      <div className="space-y-1">
        <Row side="home" />
        <Row side="away" />
      </div>
    </article>
  );
}
