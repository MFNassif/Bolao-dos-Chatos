// ============================================================
// Mata-Mata (chaveamento) — lógica pura, independente dos Palpites comuns.
//
// O bracket oficial é lido da coleção `games` (jogos de mata-mata, sem grupo).
// Dentro de cada fase os jogos têm externalId consecutivo em ordem de
// chaveamento; ordenamos por externalId para obter a posição de cada slot.
// O pareamento é o padrão (adjacente): slot j da fase seguinte recebe os
// vencedores dos slots 2j e 2j+1 da fase anterior.
//
// Cada usuário monta o PRÓPRIO chaveamento: nos 16-avos os times vêm do jogo
// oficial; nas fases seguintes os times vêm dos vencedores que ELE escolheu.
// ============================================================

import { toMillis } from './dates';

// Prazo para preencher/editar: domingo 28/06/2026 15:00 (America/Sao_Paulo = UTC-3).
export const KNOCKOUT_DEADLINE_MS = Date.parse('2026-06-28T18:00:00Z');

export function isKnockoutLocked(now = Date.now()) {
  return now >= KNOCKOUT_DEADLINE_MS;
}

// Fases na ordem do chaveamento. `scores: false` = não pontua (16-avos).
export const ROUNDS = [
  { key: 'r32', stage: 'LAST_32',          label: '16-avos de final', count: 16, scores: false },
  { key: 'r16', stage: 'LAST_16',          label: 'Oitavas de final', count: 8,  scores: true },
  { key: 'qf',  stage: 'Quartas de final', label: 'Quartas de final', count: 4,  scores: true },
  { key: 'sf',  stage: 'Semifinais',       label: 'Semifinais',       count: 2,  scores: true },
  { key: 'fin', stage: 'Final',            label: 'Final',            count: 1,  scores: true }
];

const STAGE_TO_ROUND = Object.fromEntries(ROUNDS.map((r) => [r.stage, r.key]));

export function slotId(roundKey, index) {
  return `${roundKey}-${index}`;
}

function teamOf(game, side) {
  const code = game?.[`${side}TeamCode`] || '';
  const name = game?.[`${side}Team`] || '';
  if (!code && !name) return null;
  return { code, name, flag: game?.[`${side}TeamFlag`] || '' };
}

/**
 * Monta a estrutura do bracket a partir dos jogos.
 * Retorna { rounds: [{ key,label,scores, slots:[{ id, index, game, home, away, feeders }] }] }
 * - r32: home/away vêm do jogo oficial (ou null se "A definir"); feeders = null.
 * - demais: home/away = null aqui (dependem dos palpites); feeders = [slotId, slotId].
 */
export function buildBracket(games) {
  const koByRound = {};
  for (const r of ROUNDS) koByRound[r.key] = [];
  for (const g of games || []) {
    if (g.group) continue;                       // só mata-mata
    const rk = STAGE_TO_ROUND[g.stage];
    if (!rk) continue;                           // ignora "Terceiro lugar" e grupos
    koByRound[rk].push(g);
  }
  // Ordena cada fase por externalId (ordem de chaveamento), fallback startTime.
  for (const r of ROUNDS) {
    koByRound[r.key].sort((a, b) => {
      const ea = Number(a.externalId), eb = Number(b.externalId);
      if (Number.isFinite(ea) && Number.isFinite(eb) && ea !== eb) return ea - eb;
      return toMillis(a.startTime) - toMillis(b.startTime);
    });
  }

  const rounds = ROUNDS.map((r) => {
    const slots = [];
    for (let i = 0; i < r.count; i++) {
      const game = koByRound[r.key][i] || null;
      const id = slotId(r.key, i);
      if (r.key === 'r32') {
        slots.push({ id, index: i, game, home: teamOf(game, 'home'), away: teamOf(game, 'away'), feeders: null });
      } else {
        const prev = ROUNDS[ROUNDS.findIndex((x) => x.key === r.key) - 1].key;
        slots.push({ id, index: i, game, home: null, away: null, feeders: [slotId(prev, i * 2), slotId(prev, i * 2 + 1)] });
      }
    }
    return { key: r.key, label: r.label, scores: r.scores, slots };
  });

  return { rounds };
}

function slotById(bracket, id) {
  for (const r of bracket.rounds) {
    const s = r.slots.find((x) => x.id === id);
    if (s) return s;
  }
  return null;
}

/**
 * Resolve os dois times de um slot no chaveamento PREVISTO do usuário.
 * - r32: times do jogo oficial.
 * - demais: time = vencedor escolhido pelo usuário em cada feeder (recursivo).
 * Retorna { home, away } onde cada um é {code,name,flag} ou null (indefinido).
 */
export function resolveSlotTeams(bracket, slotId_, picks) {
  const slot = slotById(bracket, slotId_);
  if (!slot) return { home: null, away: null };
  if (!slot.feeders) return { home: slot.home, away: slot.away };
  return {
    home: advancerTeam(bracket, slot.feeders[0], picks),
    away: advancerTeam(bracket, slot.feeders[1], picks)
  };
}

// Time que o usuário escolheu para avançar de um slot (ou null se não escolheu).
export function advancerTeam(bracket, slotId_, picks) {
  const teams = resolveSlotTeams(bracket, slotId_, picks);
  const pick = picks?.[slotId_];
  if (!pick || !pick.advance) return null;
  return pick.advance === 'home' ? teams.home : (pick.advance === 'away' ? teams.away : null);
}

// Slot está pronto para palpitar? (os dois times definidos)
export function slotReady(bracket, slotId_, picks) {
  const t = resolveSlotTeams(bracket, slotId_, picks);
  return !!(t.home && t.away);
}

// Slots que dependem deste (cadeia até a final). Ao trocar o vencedor de um
// slot, os palpites desses ancestrais ficam inválidos e devem ser limpos.
export function parentChainIds(roundKey, index) {
  const order = ROUNDS.map((r) => r.key);
  let ri = order.indexOf(roundKey);
  let idx = index;
  const chain = [];
  while (ri >= 0 && ri < order.length - 1) {
    ri += 1;
    idx = Math.floor(idx / 2);
    chain.push(slotId(order[ri], idx));
  }
  return chain;
}

export function sameTeam(a, b) {
  if (!a || !b) return false;
  if (a.code && b.code) return a.code === b.code;
  return (a.name || '') === (b.name || '');
}
