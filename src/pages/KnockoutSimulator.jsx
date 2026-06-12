import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../routes/AuthContext';
import { useBella } from '../routes/BellaContext';
import { subscribeGames } from '../services/gameService';
import { subscribeMyPredictions } from '../services/predictionService';
import { subscribeAllPredictions } from '../services/simulationService';
import {
  buildKnockoutRounds,
  buildSimulation,
  countCompleteGroupPredictions,
  formatScoreValue,
  getChampion,
  getGroupGames,
  pruneInvalidPicks
} from '../utils/knockoutSimulation';
import { getFullName } from '../utils/teamNames';
import Loading from '../components/Loading';

const MODES = [
  { key: 'individual', label: 'Individual' },
  { key: 'general', label: 'Geral' }
];

const GRAPH_W = 1440;
const GRAPH_H = 980;
const NODE_W = 136;
const NODE_H = 92;
const CENTER_W = 190;
const CENTER_H = 190;

const SIDE_LAYOUT = {
  left: {
    x: { r32: 16, r16: 160, quarters: 304, semis: 448 },
    r32: ['M74', 'M77', 'M73', 'M75', 'M83', 'M84', 'M81', 'M82'],
    r16: ['M89', 'M90', 'M93', 'M94'],
    quarters: ['M97', 'M98'],
    semis: ['M101']
  },
  right: {
    x: { semis: 856, quarters: 1000, r16: 1144, r32: 1288 },
    r32: ['M76', 'M78', 'M79', 'M80', 'M86', 'M88', 'M85', 'M87'],
    r16: ['M91', 'M92', 'M95', 'M96'],
    quarters: ['M99', 'M100'],
    semis: ['M102']
  }
};

const Y_POS = {
  r32: [92, 202, 312, 422, 552, 662, 772, 882],
  r16: [147, 367, 607, 827],
  quarters: [257, 717],
  semis: [487],
  final: [487]
};

const ROUND_LABELS = {
  r32: 'R32',
  r16: 'Oitavas',
  quarters: 'Quartas',
  semis: 'Semi'
};

export default function KnockoutSimulator() {
  const { user } = useAuth();
  const { bella } = useBella();
  const [games, setGames] = useState(null);
  const [myPreds, setMyPreds] = useState([]);
  const [allPreds, setAllPreds] = useState(null);
  const [allPredsError, setAllPredsError] = useState(null);
  const [mode, setMode] = useState('individual');
  const [picks, setPicks] = useState({});

  useEffect(() => {
    const u1 = subscribeGames(setGames);
    const u2 = subscribeMyPredictions(user.uid, setMyPreds);
    return () => { u1(); u2(); };
  }, [user.uid]);

  const groupGames = useMemo(() => getGroupGames(games || []), [games]);
  const completed = useMemo(
    () => countCompleteGroupPredictions(groupGames, myPreds),
    [groupGames, myPreds]
  );
  const hasAccess = groupGames.length > 0 && completed === groupGames.length;

  useEffect(() => {
    if (!hasAccess || mode !== 'general') {
      setAllPreds(null);
      setAllPredsError(null);
      return undefined;
    }
    return subscribeAllPredictions(
      setAllPreds,
      (err) => {
        setAllPredsError(err?.message || 'Erro ao carregar os palpites gerais.');
        setAllPreds([]);
      }
    );
  }, [hasAccess, mode]);

  const activePredictions = mode === 'general' ? allPreds : myPreds;
  const simulation = useMemo(() => {
    if (!games || !hasAccess || !activePredictions) return null;
    return buildSimulation({ games, predictions: activePredictions, mode });
  }, [games, hasAccess, activePredictions, mode]);

  const bracketKey = useMemo(() => {
    if (!simulation?.complete) return `${mode}:empty`;
    return `${mode}:${simulation.round32.map((m) => `${m.id}:${m.teamA?.id || '-'}:${m.teamB?.id || '-'}`).join('|')}`;
  }, [simulation, mode]);

  useEffect(() => setPicks({}), [bracketKey]);

  const rounds = useMemo(
    () => buildKnockoutRounds(simulation?.round32 || [], picks),
    [simulation, picks]
  );
  const champion = useMemo(() => getChampion(rounds, picks), [rounds, picks]);

  function chooseWinner(match, team) {
    if (!team || !match || !simulation?.round32) return;
    setPicks((current) => pruneInvalidPicks(simulation.round32, {
      ...current,
      [match.id]: team.id
    }));
  }

  function resetBracket() {
    setPicks({});
  }

  if (games === null) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white tracking-wider">SIMULACAO MATA-MATA</h2>
          <p className="text-sm text-slate">Monte o caminho previsto pela fase de grupos e escolha quem passa.</p>
        </div>
        <button className="btn-ghost text-xs shrink-0" onClick={resetBracket} disabled={!simulation?.complete}>
          Limpar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Jogos de grupo" value={groupGames.length} />
        <Stat label="Seus palpites" value={`${completed}/${groupGames.length || 0}`} highlight={hasAccess} />
        <Stat label="Modo" value={mode === 'general' ? 'Geral' : 'Solo'} />
      </div>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 no-scrollbar pb-1">
        {MODES.map((item) => (
          <button
            key={item.key}
            onClick={() => setMode(item.key)}
            className={mode === item.key ? 'tab-btn-active' : 'tab-btn-idle'}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!groupGames.length && (
        <EmptyState title="Fase de grupos nao encontrada" text="Sincronize os jogos da Copa para liberar a simulacao." />
      )}

      {groupGames.length > 0 && !hasAccess && (
        <LockedState total={groupGames.length} completed={completed} />
      )}

      {hasAccess && mode === 'general' && allPreds === null && !allPredsError && <Loading />}

      {hasAccess && allPredsError && mode === 'general' && (
        <div className="card bg-red-950/30 border-red-800/40 p-4">
          <p className="text-sm font-semibold text-red-300">{allPredsError}</p>
          <p className="text-xs text-slate mt-1">Confira se as regras do Firestore ja foram publicadas.</p>
        </div>
      )}

      {hasAccess && simulation && !simulation.complete && (
        <EmptyState title="Simulacao incompleta" text="Ainda ha jogos sem palpite disponivel para este modo." />
      )}

      {simulation?.complete && (
        <>
          <ChampionPanel champion={champion} bella={bella} />

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h3 className="font-display text-base text-white tracking-wider shrink-0">CHAVEAMENTO</h3>
              <div className="hidden sm:block flex-1 h-px bg-white/8" />
              <span className="text-[11px] text-slate ml-auto sm:ml-0">clique nos vencedores</span>
            </div>
            <BracketGraph
              rounds={rounds}
              picks={picks}
              champion={champion}
              onPick={chooseWinner}
              bella={bella}
            />
          </section>

          <QualifiersSummary simulation={simulation} bella={bella} />
          <StandingsGrid simulation={simulation} bella={bella} mode={mode} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="card bg-surface-2 p-3 text-center">
      <p className={`font-display text-2xl ${highlight ? 'text-green-light' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-slate uppercase tracking-wider font-semibold">{label}</p>
    </div>
  );
}

function LockedState({ total, completed }) {
  return (
    <div className="card bg-yellow-900/20 border-yellow-600/30 p-5 text-center">
      <div className="w-12 h-12 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center mx-auto mb-3">
        <LockIcon className="w-6 h-6 text-yellow-400" />
      </div>
      <h3 className="font-display text-xl text-white tracking-wider">PALPITES INCOMPLETOS</h3>
      <p className="text-sm text-yellow-200/80 mt-1">
        Voce precisa fazer todos os palpites da fase de grupos para liberar esta aba.
      </p>
      <p className="text-xs text-slate mt-2">{completed} de {total} preenchidos.</p>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="card bg-surface-2 p-8 text-center">
      <h3 className="font-display text-xl text-white tracking-wider">{title}</h3>
      <p className="text-sm text-slate mt-1">{text}</p>
    </div>
  );
}

function ChampionPanel({ champion, bella }) {
  if (!champion) {
    return (
    <div className="card bg-surface-2 p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] text-slate uppercase tracking-wider font-bold">Campeao</p>
        <p className="font-display text-2xl text-white tracking-wider truncate">em aberto</p>
      </div>
      <span className="chip bg-white/8 text-slate">simulando</span>
    </div>
    );
  }

  return (
    <div className="card bg-green/15 border-green/30 p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] text-green-light uppercase tracking-wider font-bold">Campeao simulado</p>
        <p className="font-display text-3xl text-white tracking-wider truncate">{teamName(champion, bella)}</p>
      </div>
      <Flag team={champion} size="lg" />
    </div>
  );
}

function BracketGraph({ rounds, picks, champion, onPick, bella }) {
  const scrollRef = useRef(null);
  const matches = useMemo(() => {
    const map = new Map();
    for (const round of rounds) {
      for (const match of round.matches) map.set(match.id, match);
    }
    return map;
  }, [rounds]);
  const bracketSignature = useMemo(() => (
    rounds?.[0]?.matches || []
  ).map((match) => `${match.id}:${match.teamA?.id || '-'}:${match.teamB?.id || '-'}`).join('|'), [rounds]);

  const leftNodes = buildGraphNodes('left', matches);
  const rightNodes = buildGraphNodes('right', matches);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll > 0) el.scrollLeft = maxScroll / 2;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [bracketSignature]);

  function moveView(position) {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const left = position === 'left' ? 0 : position === 'right' ? maxScroll : maxScroll / 2;
    el.scrollTo({ left, behavior: 'smooth' });
  }

  return (
    <div className="card bg-surface-2 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-white/8">
        <div className="min-w-0">
          <p className="text-[11px] text-slate uppercase tracking-wider font-bold">Caminho ate o campeao</p>
          <p className="text-xs text-slate truncate">Os dois lados da chave se encontram na final.</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            className="w-8 h-8 rounded-lg bg-white/6 border border-white/10 text-slate hover:text-white hover:bg-white/10 flex items-center justify-center transition"
            title="Ver lado esquerdo"
            aria-label="Ver lado esquerdo"
            onClick={() => moveView('left')}
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg bg-green/20 border border-green/35 text-green-light hover:bg-green/30 flex items-center justify-center transition"
            title="Centralizar final"
            aria-label="Centralizar final"
            onClick={() => moveView('center')}
          >
            <TrophyIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg bg-white/6 border border-white/10 text-slate hover:text-white hover:bg-white/10 flex items-center justify-center transition"
            title="Ver lado direito"
            aria-label="Ver lado direito"
            onClick={() => moveView('right')}
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="bracket-scroll overflow-x-auto overscroll-x-contain px-3 py-4 touch-pan-x">
        <div className="relative shrink-0 mx-auto" style={{ width: GRAPH_W, height: GRAPH_H }}>
          <BracketLines />
          <RoundLabels />

          {[...leftNodes, ...rightNodes].map((node) => (
            <BracketNode
              key={node.match.id}
              node={node}
              picked={picks[node.match.id]}
              onPick={onPick}
              bella={bella}
            />
          ))}

          <FinalNode
            match={matches.get('M104')}
            picked={picks.M104}
            champion={champion}
            onPick={onPick}
            bella={bella}
          />
        </div>
      </div>
    </div>
  );
}

function buildGraphNodes(side, matches) {
  const cfg = SIDE_LAYOUT[side];
  return ['r32', 'r16', 'quarters', 'semis'].flatMap((roundKey) =>
    cfg[roundKey].map((id, index) => ({
      side,
      roundKey,
      match: matches.get(id),
      x: cfg.x[roundKey],
      y: Y_POS[roundKey][index] - NODE_H / 2
    })).filter((node) => node.match)
  );
}

function RoundLabels() {
  const labels = [
    ...['r32', 'r16', 'quarters', 'semis'].map((key) => ({
      key: `left-${key}`,
      label: ROUND_LABELS[key],
      x: SIDE_LAYOUT.left.x[key] + NODE_W / 2
    })),
    { key: 'final', label: 'Final', x: GRAPH_W / 2 },
    ...['semis', 'quarters', 'r16', 'r32'].map((key) => ({
      key: `right-${key}`,
      label: ROUND_LABELS[key],
      x: SIDE_LAYOUT.right.x[key] + NODE_W / 2
    }))
  ];

  return (
    <>
      {labels.map((item) => (
        <div
          key={item.key}
          className="absolute top-2 -translate-x-1/2 rounded-full bg-white/6 border border-white/8 px-2 py-1 text-[10px] text-slate uppercase tracking-wider font-bold whitespace-nowrap"
          style={{ left: item.x }}
        >
          {item.label}
        </div>
      ))}
    </>
  );
}

function BracketLines() {
  const lines = [];

  function addPair(side, fromRound, toRound, parentIndex) {
    const cfg = SIDE_LAYOUT[side];
    const childA = exitPoint(side, cfg.x[fromRound], Y_POS[fromRound][parentIndex * 2]);
    const childB = exitPoint(side, cfg.x[fromRound], Y_POS[fromRound][parentIndex * 2 + 1]);
    const parent = entryPoint(side, cfg.x[toRound], Y_POS[toRound][parentIndex]);
    const midX = (childA.x + parent.x) / 2;

    lines.push(`M ${childA.x} ${childA.y} H ${midX} V ${parent.y} H ${parent.x}`);
    lines.push(`M ${childB.x} ${childB.y} H ${midX} V ${parent.y} H ${parent.x}`);
  }

  for (const side of ['left', 'right']) {
    for (let i = 0; i < 4; i += 1) addPair(side, 'r32', 'r16', i);
    for (let i = 0; i < 2; i += 1) addPair(side, 'r16', 'quarters', i);
    addPair(side, 'quarters', 'semis', 0);
  }

  const leftSemi = exitPoint('left', SIDE_LAYOUT.left.x.semis, Y_POS.semis[0]);
  const rightSemi = exitPoint('right', SIDE_LAYOUT.right.x.semis, Y_POS.semis[0]);
  const finalLeft = { x: GRAPH_W / 2 - CENTER_W / 2, y: Y_POS.final[0] };
  const finalRight = { x: GRAPH_W / 2 + CENTER_W / 2, y: Y_POS.final[0] };
  lines.push(`M ${leftSemi.x} ${leftSemi.y} H ${finalLeft.x}`);
  lines.push(`M ${rightSemi.x} ${rightSemi.y} H ${finalRight.x}`);

  return (
    <svg className="absolute inset-0 pointer-events-none" viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} aria-hidden="true">
      <defs>
        <linearGradient id="bracketGlow" x1="0" x2="1">
          <stop offset="0" stopColor="rgba(34,197,94,0.18)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0.34)" />
          <stop offset="1" stopColor="rgba(34,197,94,0.18)" />
        </linearGradient>
      </defs>
      {lines.map((d, index) => (
        <path
          key={index}
          d={d}
          fill="none"
          stroke="url(#bracketGlow)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4 6"
        />
      ))}
      <circle cx={GRAPH_W / 2} cy={Y_POS.final[0]} r="96" fill="rgba(34,197,94,0.05)" stroke="rgba(34,197,94,0.18)" />
    </svg>
  );
}

function exitPoint(side, x, y) {
  return side === 'left' ? { x: x + NODE_W, y } : { x, y };
}

function entryPoint(side, x, y) {
  return side === 'left' ? { x, y } : { x: x + NODE_W, y };
}

function BracketNode({ node, picked, onPick, bella }) {
  return (
    <div
      className="absolute"
      style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
    >
      <CompactMatchCard
        match={node.match}
        picked={picked}
        onPick={onPick}
        bella={bella}
        tone={node.roundKey === 'semis' ? 'strong' : 'normal'}
      />
    </div>
  );
}

function FinalNode({ match, picked, champion, onPick, bella }) {
  const ready = !!match?.teamA && !!match?.teamB;

  return (
    <div
      className="absolute"
      style={{
        left: GRAPH_W / 2 - CENTER_W / 2,
        top: Y_POS.final[0] - CENTER_H / 2,
        width: CENTER_W,
        height: CENTER_H
      }}
    >
      <div className="h-full overflow-hidden rounded-2xl border border-green/40 bg-[#0f1713]/95 shadow-[0_0_40px_rgba(34,197,94,0.18)] p-3 flex flex-col">
        <div className="flex items-center justify-center mb-2">
          <div className="w-12 h-12 rounded-full bg-green/20 border border-green/40 flex items-center justify-center">
            <TrophyIcon className="w-6 h-6 text-green-light" />
          </div>
        </div>
        <p className="text-[10px] text-green-light uppercase tracking-wider font-bold text-center">Campeao</p>
        <p className="font-display text-2xl text-white text-center leading-none truncate mb-2 min-h-[1.5rem]">
          {champion ? teamName(champion, bella) : 'em aberto'}
        </p>
        <div className="space-y-1 mt-auto">
          <MiniTeamButton team={match?.teamA} picked={picked} disabled={!ready} onClick={() => onPick(match, match?.teamA)} bella={bella} />
          <MiniTeamButton team={match?.teamB} picked={picked} disabled={!ready} onClick={() => onPick(match, match?.teamB)} bella={bella} />
        </div>
      </div>
    </div>
  );
}

function CompactMatchCard({ match, picked, onPick, bella, tone = 'normal' }) {
  const ready = !!match.teamA && !!match.teamB;
  return (
    <article className={`h-full overflow-hidden rounded-xl border p-2 space-y-1.5 shadow-lg ${
      tone === 'strong'
        ? 'bg-green/10 border-green/30'
        : 'bg-[#171c26]/95 border-white/10'
    }`}>
      <div className="h-4 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-slate uppercase tracking-wider">{match.id}</span>
        <span className="text-[10px] text-slate truncate">{match.sourceA || ''}</span>
      </div>
      <MiniTeamButton team={match.teamA} picked={picked} disabled={!ready} onClick={() => onPick(match, match.teamA)} bella={bella} />
      <MiniTeamButton team={match.teamB} picked={picked} disabled={!ready} onClick={() => onPick(match, match.teamB)} bella={bella} />
    </article>
  );
}

function MiniTeamButton({ team, picked, disabled, onClick, bella }) {
  if (!team) {
    return (
      <div className="h-7 rounded-md bg-white/5 border border-white/8 px-1.5 flex items-center text-[10px] text-slate">
        Aguardando
      </div>
    );
  }

  const isPicked = picked === team.id;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full h-7 rounded-md border px-1.5 flex items-center gap-1.5 text-left transition ${
        isPicked
          ? 'bg-green/25 border-green/50 text-white'
          : 'bg-white/6 border-white/10 text-slate hover:bg-white/10 hover:text-white'
      } disabled:cursor-not-allowed disabled:opacity-70`}
    >
      <Flag team={team} size="xs" />
      <span className="min-w-0 flex-1 text-[10px] font-bold truncate">{teamName(team, bella)}</span>
      {isPicked && <CheckIcon className="w-3 h-3 text-green-light shrink-0" />}
    </button>
  );
}

function QualifiersSummary({ simulation, bella }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="font-display text-base text-white tracking-wider">CLASSIFICADOS</h3>
        <div className="flex-1 h-px bg-white/8" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card bg-surface-2 p-4">
          <p className="text-[11px] text-slate uppercase tracking-wider font-bold mb-3">Primeiros e segundos</p>
          <div className="grid grid-cols-2 gap-2">
            {simulation.standings.map((group) => (
              <div key={group.group} className="rounded-lg bg-white/5 px-3 py-2">
                <p className="text-[10px] text-slate font-bold uppercase">Grupo {group.group}</p>
                <p className="text-xs text-white font-semibold truncate">1o {teamName(group.rows[0].team, bella)}</p>
                <p className="text-xs text-slate truncate">2o {teamName(group.rows[1].team, bella)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card bg-surface-2 p-4">
          <p className="text-[11px] text-slate uppercase tracking-wider font-bold mb-3">Melhores terceiros</p>
          <div className="space-y-1.5">
            {simulation.bestThirds.map((row, index) => (
              <div key={row.team.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-[11px] text-slate">{index + 1}o</span>
                <Flag team={row.team} />
                <span className="font-semibold text-white truncate flex-1">{teamName(row.team, bella)}</span>
                <span className="text-xs text-slate">G{row.group}</span>
                <span className="font-display text-white">{row.points}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StandingsGrid({ simulation, bella, mode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="font-display text-base text-white tracking-wider">CLASSIFICACAO SIMULADA</h3>
        <div className="flex-1 h-px bg-white/8" />
        <span className="text-[11px] text-slate">{mode === 'general' ? 'media' : 'individual'}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {simulation.standings.map((group) => (
          <div key={group.group} className="card bg-surface-2 overflow-hidden">
            <div className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
              <p className="font-display text-lg text-white">GRUPO {group.group}</p>
              <span className="text-[10px] text-slate">P GD GP</span>
            </div>
            <ul>
              {group.rows.map((row) => (
                <li key={row.team.id} className="px-3 py-2 border-b border-white/5 last:border-0 flex items-center gap-2">
                  <span className={`w-5 text-xs font-bold ${row.position <= 2 ? 'text-green-light' : row.position === 3 ? 'text-yellow-400' : 'text-slate'}`}>
                    {row.position}o
                  </span>
                  <Flag team={row.team} />
                  <span className="text-xs font-semibold text-white truncate flex-1">{teamName(row.team, bella)}</span>
                  <span className="font-display text-white w-5 text-right">{row.points}</span>
                  <span className="text-xs text-slate w-8 text-right">{formatScoreValue(row.gd)}</span>
                  <span className="text-xs text-slate w-8 text-right">{formatScoreValue(row.gf)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Flag({ team, size = 'sm' }) {
  const cls = size === 'lg' ? 'w-14 h-14 rounded-xl' : size === 'xs' ? 'w-4 h-4 rounded' : 'w-7 h-7 rounded-lg';
  return (
    <div className={`${cls} bg-white/8 border border-white/10 overflow-hidden flex items-center justify-center shrink-0`}>
      {team?.flag
        ? <img src={team.flag} alt="" className="w-full h-full object-cover" loading="lazy" />
        : <span className="text-[9px] font-display text-slate">{team?.code || '?'}</span>
      }
    </div>
  );
}

function teamName(team, bella) {
  if (!team) return '';
  if (bella) return getFullName(team.code, team.name);
  return team.code || team.name;
}

function TrophyIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}

function LockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function CheckIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ChevronLeftIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
