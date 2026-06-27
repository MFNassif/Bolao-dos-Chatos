import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../routes/AuthContext';
import { useBella } from '../routes/BellaContext';
import { subscribeGames } from '../services/gameService';
import { subscribeMyKnockout, saveMyKnockout } from '../services/knockoutService';
import {
  buildBracket, resolveSlotTeams, isKnockoutLocked, parentChainIds, KNOCKOUT_DEADLINE_MS
} from '../utils/knockout';
import { getFullName } from '../utils/teamNames';
import { formatDate, formatTime, formatDateTime } from '../utils/dates';
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
  useEffect(() => { if (savedDoc && picks === null) setPicks(savedDoc.picks || {}); }, [savedDoc, picks]);

  const bracket = useMemo(() => (games ? buildBracket(games) : null), [games]);

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

      <div className={`card p-3 text-[11px] leading-relaxed ${locked ? 'bg-red-950/30 border-red-800/30' : 'bg-surface-2'}`}>
        {locked
          ? <p className="text-red-300 font-semibold">🔒 Palpites encerrados em {formatDateTime(KNOCKOUT_DEADLINE_MS)}. Agora é só visualização.</p>
          : <p className="text-slate">Prazo: <span className="text-white font-semibold">{formatDateTime(KNOCKOUT_DEADLINE_MS)}</span> (Brasília). Escolha o placar e <b className="text-white">quem avança</b> (pode dar empate e decidir nos pênaltis). O vencedor sobe no seu chaveamento.</p>}
        <p className="text-slate mt-1"><b className="text-white">16-avos não pontuam</b>. Das oitavas: <b className="text-green-light">2 pts</b> acertando quem avança, <b className="text-yellow-400">4 pts</b> cravando placar + os dois times do confronto.</p>
        <p className="text-slate/70 mt-1">Arraste para o lado para ver todas as fases →</p>
      </div>

      {/* Chaveamento: colunas por fase, com rolagem horizontal */}
      <div className="overflow-x-auto -mx-4 px-4 pb-4">
        <div className="kobracket">
          {bracket.rounds.map((round) => (
            <div key={round.key} className="koround">
              <div className="kohead">
                {round.label}{!round.scores && <span className="ml-1 text-slate/70">· não pontua</span>}
              </div>
              <div className="komatches">
                {round.slots.map((slot) => (
                  <MatchBox
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
            </div>
          ))}
        </div>
      </div>
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

function MatchBox({ slot, round, teams, pick, editable, teamLabel, onScore, onAdvance }) {
  const ready = !!(teams.home && teams.away);
  const canEdit = editable && ready;
  const dt = slot.game?.startTime;

  function Row({ side }) {
    const t = teams[side];
    const score = side === 'home' ? pick?.homeScore : pick?.awayScore;
    const isAdv = pick?.advance === side;
    return (
      <div className={`flex items-center gap-1 px-1 py-1 rounded-md transition ${isAdv ? 'bg-green/15 ring-1 ring-green/30' : ''}`}>
        <button
          type="button" disabled={!canEdit}
          onClick={() => onAdvance(round.key, slot.index, slot.id, side)}
          title={canEdit ? 'Quem avança' : ''}
          className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center text-[8px] ${isAdv ? 'border-green bg-green text-white' : 'border-white/25 text-transparent'} ${canEdit ? 'hover:border-green' : ''}`}
        >✓</button>
        <span className="w-5 h-5 rounded bg-white/8 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
          {t?.flag ? <img src={t.flag} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="text-[7px] text-slate">{t?.code?.slice(0, 3) || '?'}</span>}
        </span>
        <span className={`flex-1 text-[11px] font-semibold truncate ${t ? 'text-white' : 'text-slate italic'}`}>{teamLabel(t) || 'A definir'}</span>
        <input
          inputMode="numeric" pattern="[0-9]*" disabled={!canEdit}
          value={Number.isInteger(score) ? score : ''}
          onChange={(e) => onScore(slot.id, side, e.target.value)}
          className="w-6 h-6 text-center text-sm font-display rounded bg-white/8 border border-white/15 text-white outline-none focus:border-green disabled:opacity-40"
          aria-label="Placar"
        />
      </div>
    );
  }

  return (
    <article className="komatch card bg-surface-2 p-1.5">
      <div className="flex items-center justify-between px-1 mb-0.5">
        <span className="text-[9px] text-slate uppercase tracking-wide font-bold">Jogo {slot.index + 1}</span>
        {dt && <span className="text-[9px] text-slate">{formatDate(dt)} {formatTime(dt)}</span>}
      </div>
      <Row side="home" />
      <Row side="away" />
    </article>
  );
}
