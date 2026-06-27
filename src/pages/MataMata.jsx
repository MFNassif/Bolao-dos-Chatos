import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../routes/AuthContext';
import { useBella } from '../routes/BellaContext';
import { subscribeGames } from '../services/gameService';
import { subscribeMyKnockout, saveMyKnockout } from '../services/knockoutService';
import {
  buildBracket, resolveSlotTeams, isKnockoutLocked, parentChainIds,
  effectiveAdvanceSide, slotId, KNOCKOUT_DEADLINE_MS
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
  const [save, setSave] = useState('idle');
  const locked = isKnockoutLocked();
  const firstLoad = useRef(true);

  useEffect(() => subscribeGames(setGames), []);
  useEffect(() => subscribeMyKnockout(user.uid, setSavedDoc), [user.uid]);
  useEffect(() => { if (savedDoc && picks === null) setPicks(savedDoc.picks || {}); }, [savedDoc, picks]);

  const bracket = useMemo(() => (games ? buildBracket(games) : null), [games]);

  // Conectores do chaveamento desenhados em SVG, medindo a posição real de
  // cada card (o espaçamento é dinâmico, então linhas em CSS fixo não alinham).
  const wrapRef = useRef(null);
  const matchRefs = useRef({});
  const [lines, setLines] = useState([]);
  const [svgDim, setSvgDim] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !bracket) return;
    function compute() {
      const cont = wrap.getBoundingClientRect();
      const rectOf = (id) => {
        const el = matchRefs.current[id];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left - cont.left, right: r.right - cont.left, cy: (r.top + r.bottom) / 2 - cont.top };
      };
      const segs = [];
      for (let r = 0; r < bracket.rounds.length - 1; r++) {
        const cur = bracket.rounds[r];
        const next = bracket.rounds[r + 1];
        for (let i = 0; i < next.slots.length; i++) {
          const f0 = rectOf(slotId(cur.key, 2 * i));
          const f1 = rectOf(slotId(cur.key, 2 * i + 1));
          const tgt = rectOf(next.slots[i].id);
          if (!f0 || !f1 || !tgt) continue;
          const midX = (f0.right + tgt.left) / 2;
          segs.push([f0.right, f0.cy, midX, f0.cy]);   // saída do jogo de cima
          segs.push([f1.right, f1.cy, midX, f1.cy]);   // saída do jogo de baixo
          segs.push([midX, f0.cy, midX, f1.cy]);       // linha vertical ligando o par
          segs.push([midX, tgt.cy, tgt.left, tgt.cy]); // entrada no jogo seguinte
        }
      }
      setLines(segs);
      setSvgDim({ w: wrap.offsetWidth, h: wrap.offsetHeight });
    }
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    window.addEventListener('resize', compute);
    return () => { ro.disconnect(); window.removeEventListener('resize', compute); };
  }, [bracket, bella]);

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

  function setScore(roundKey, index, slotId, side, raw) {
    const v = raw.replace(/\D+/g, '').slice(0, 2);
    setPicks((p) => {
      const cur = p[slotId] || {};
      const before = effectiveAdvanceSide(cur);
      const updated = { ...cur, [side === 'home' ? 'homeScore' : 'awayScore']: v === '' ? undefined : Number(v) };
      const next = { ...p, [slotId]: updated };
      // Se mudou quem avança, limpa as fases seguintes que dependem deste jogo.
      if (effectiveAdvanceSide(updated) !== before) {
        for (const dep of parentChainIds(roundKey, index)) delete next[dep];
      }
      return next;
    });
  }

  // Só no empate o usuário escolhe quem passa (pênaltis).
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

      <Countdown locked={locked} />

      <div className="card bg-surface-2 p-3 text-[11px] leading-relaxed">
        <p className="text-slate">Informe o placar — <b className="text-white">quem fizer mais gols avança</b>. Deu <b className="text-white">empate</b>? Toque na bolinha de quem passou nos pênaltis. O vencedor sobe no seu chaveamento.</p>
        <p className="text-slate mt-1"><b className="text-white">16-avos não pontuam</b>. Das oitavas: <b className="text-green-light">2 pts</b> acertando quem avança, <b className="text-yellow-400">4 pts</b> cravando placar + os dois times do confronto.</p>
        <p className="text-slate/70 mt-1">Arraste para o lado para ver todas as fases →</p>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 pb-4">
        <div className="kobracket" ref={wrapRef}>
          <svg className="kolines" width={svgDim.w} height={svgDim.h} aria-hidden="true">
            {lines.map((l, i) => (
              <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
            ))}
          </svg>
          {bracket.rounds.map((round) => (
            <div key={round.key} className="koround">
              <div className="kohead">
                {round.label}{!round.scores && <span className="ml-1 text-slate/70">· não pontua</span>}
              </div>
              <div className="komatches">
                {round.slots.map((slot) => (
                  <MatchBox
                    key={slot.id}
                    innerRef={(el) => { matchRefs.current[slot.id] = el; }}
                    slot={slot}
                    roundKey={round.key}
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

function Countdown({ locked }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (locked) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [locked]);

  const ms = KNOCKOUT_DEADLINE_MS - now;
  if (locked || ms <= 0) {
    return (
      <div className="card bg-red-950/30 border-red-800/30 p-3 text-center">
        <p className="text-red-300 font-semibold text-sm">🔒 Palpites encerrados</p>
        <p className="text-[11px] text-slate mt-0.5">Fechou em {formatDateTime(KNOCKOUT_DEADLINE_MS)} · agora é só visualização.</p>
      </div>
    );
  }
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const cells = [{ v: d, l: 'dias' }, { v: h, l: 'horas' }, { v: m, l: 'min' }, { v: sec, l: 'seg' }];
  return (
    <div className="card bg-surface-2 p-3">
      <p className="text-[11px] text-slate uppercase tracking-wider font-bold text-center mb-2">⏳ Fecha em</p>
      <div className="grid grid-cols-4 gap-2">
        {cells.map((c) => (
          <div key={c.l} className="bg-white/6 rounded-xl py-2 text-center">
            <p className="font-display text-2xl text-green-light tabular-nums leading-none">{String(c.v).padStart(2, '0')}</p>
            <p className="text-[9px] text-slate uppercase tracking-wider mt-1">{c.l}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate text-center mt-2">Prazo: {formatDateTime(KNOCKOUT_DEADLINE_MS)} (Brasília)</p>
    </div>
  );
}

function TeamRow({ side, team, score, isAdv, isDraw, canEditScore, canPickAdvance, teamLabel, onScore, onAdvance }) {
  return (
    <div className={`flex items-center gap-1 px-1 py-1 rounded-md transition ${isAdv ? 'bg-green/15 ring-1 ring-green/30' : ''}`}>
      <button
        type="button"
        disabled={!canPickAdvance}
        onClick={canPickAdvance ? onAdvance : undefined}
        title={canPickAdvance ? 'Quem passou nos pênaltis' : (isAdv ? 'Avança (mais gols)' : '')}
        className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center text-[8px] ${
          isAdv ? 'border-green bg-green text-white' : 'border-white/25 text-transparent'
        } ${canPickAdvance ? 'hover:border-green cursor-pointer' : 'cursor-default'}`}
      >✓</button>
      <span className="w-5 h-5 rounded bg-white/8 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
        {team?.flag ? <img src={team.flag} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="text-[7px] text-slate">{team?.code?.slice(0, 3) || '?'}</span>}
      </span>
      <span className={`flex-1 text-[11px] font-semibold truncate ${team ? 'text-white' : 'text-slate italic'}`}>{teamLabel(team) || 'A definir'}</span>
      <input
        inputMode="numeric" pattern="[0-9]*" disabled={!canEditScore}
        value={Number.isInteger(score) ? score : ''}
        onChange={(e) => onScore(side, e.target.value)}
        className="w-6 h-6 text-center text-sm font-display rounded bg-white/8 border border-white/15 text-white outline-none focus:border-green disabled:opacity-40"
        aria-label="Placar"
      />
    </div>
  );
}

function MatchBox({ innerRef, slot, roundKey, teams, pick, editable, teamLabel, onScore, onAdvance }) {
  const ready = !!(teams.home && teams.away);
  const canEditScore = editable && ready;
  const hasBoth = Number.isInteger(pick?.homeScore) && Number.isInteger(pick?.awayScore);
  const isDraw = hasBoth && pick.homeScore === pick.awayScore;
  const advSide = effectiveAdvanceSide(pick);
  const canPickAdvance = editable && ready && isDraw;
  const dt = slot.game?.startTime;

  return (
    <article ref={innerRef} className="komatch card bg-surface-2 p-1.5">
      <div className="flex items-center justify-between px-1 mb-0.5">
        <span className="text-[9px] text-slate uppercase tracking-wide font-bold">Jogo {slot.index + 1}</span>
        {dt && <span className="text-[9px] text-slate">{formatDate(dt)} {formatTime(dt)}</span>}
      </div>
      {['home', 'away'].map((side) => (
        <TeamRow
          key={side}
          side={side}
          team={teams[side]}
          score={side === 'home' ? pick?.homeScore : pick?.awayScore}
          isAdv={advSide === side}
          isDraw={isDraw}
          canEditScore={canEditScore}
          canPickAdvance={canPickAdvance}
          teamLabel={teamLabel}
          onScore={(s, raw) => onScore(roundKey, slot.index, slot.id, s, raw)}
          onAdvance={() => onAdvance(roundKey, slot.index, slot.id, side)}
        />
      ))}
      {canPickAdvance && !advSide && (
        <p className="text-[9px] text-yellow-400 px-1 mt-0.5">Empate — toque em quem passou ✓</p>
      )}
    </article>
  );
}
