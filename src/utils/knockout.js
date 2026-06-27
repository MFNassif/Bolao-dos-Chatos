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

// Lado que avança de um slot a partir do palpite:
//  - placar decisivo → quem fez mais gols (automático);
//  - empate → escolha manual (pênaltis), via pick.advance;
//  - placar incompleto → indefinido (null).
export function effectiveAdvanceSide(pick) {
  const h = pick?.homeScore;
  const a = pick?.awayScore;
  if (!Number.isInteger(h) || !Number.isInteger(a)) return null;
  if (h > a) return 'home';
  if (a > h) return 'away';
  return (pick?.advance === 'home' || pick?.advance === 'away') ? pick.advance : null;
}

// Time que avança de um slot (ou null se ainda indefinido).
export function advancerTeam(bracket, slotId_, picks) {
  const teams = resolveSlotTeams(bracket, slotId_, picks);
  const side = effectiveAdvanceSide(picks?.[slotId_]);
  if (!side) return null;
  return side === 'home' ? teams.home : teams.away;
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

function samePair(p, q) {
  if (!p.home || !p.away || !q.home || !q.away) return false;
  return (sameTeam(p.home, q.home) && sameTeam(p.away, q.away)) ||
    (sameTeam(p.home, q.away) && sameTeam(p.away, q.home));
}

// Quem AVANÇOU oficialmente de um slot (resolve pênaltis):
//  - vitória no tempo normal: vem do winner do jogo;
//  - empate (pênaltis): deriva pelo time que aparece na fase seguinte oficial.
export function officialAdvancer(bracket, roundKey, index) {
  const order = ROUNDS.map((r) => r.key);
  const ri = order.indexOf(roundKey);
  const slot = bracket.rounds[ri]?.slots[index];
  const game = slot?.game;
  if (!game) return null;
  if (game.winner === 'home') return teamOf(game, 'home');
  if (game.winner === 'away') return teamOf(game, 'away');
  // Empate → o classificado é quem aparece no jogo oficial da proxima fase.
  if (ri >= order.length - 1) return null; // final: sem fase seguinte para derivar
  const parent = bracket.rounds[ri + 1]?.slots[Math.floor(index / 2)];
  if (!parent?.game) return null;
  return teamOf(parent.game, index % 2 === 0 ? 'home' : 'away');
}

/**
 * Resultado do palpite num slot (apenas fases que pontuam):
 *  - 'none'    → errou quem avança (ou oficial ainda indefinido)
 *  - 'winner'  → acertou quem avança
 *  - 'cravada' → acertou quem avança + os DOIS times do confronto + placar exato
 * A cravada é sensível aos times: placar igual com adversário errado é 'winner'.
 */
export function slotOutcome(bracket, roundKey, index, picks) {
  const round = ROUNDS.find((r) => r.key === roundKey);
  if (!round || !round.scores) return 'none';

  const oAdv = officialAdvancer(bracket, roundKey, index);
  if (!oAdv) return 'none'; // resultado oficial ainda não definido

  const id = slotId(roundKey, index);
  const uAdv = advancerTeam(bracket, id, picks);
  if (!uAdv || !sameTeam(uAdv, oAdv)) return 'none'; // errou o classificado

  const slot = bracket.rounds[ROUNDS.map((r) => r.key).indexOf(roundKey)].slots[index];
  const game = slot.game;
  const oTeams = { home: teamOf(game, 'home'), away: teamOf(game, 'away') };
  const uTeams = resolveSlotTeams(bracket, id, picks);
  const pick = picks?.[id] || {};

  const bothTeams = samePair(uTeams, oTeams);
  let exact = false;
  if (bothTeams && Number.isInteger(game.homeScore) && Number.isInteger(game.awayScore)
      && Number.isInteger(pick.homeScore) && Number.isInteger(pick.awayScore)) {
    const uHomeGoals = sameTeam(uTeams.home, oTeams.home) ? pick.homeScore : pick.awayScore;
    const uAwayGoals = sameTeam(uTeams.home, oTeams.home) ? pick.awayScore : pick.homeScore;
    exact = uHomeGoals === game.homeScore && uAwayGoals === game.awayScore;
  }
  return exact ? 'cravada' : 'winner';
}

// Conta acertos do chaveamento (independente da pontuação do bolão).
export function computeKnockoutCounts(bracket, picks) {
  const counts = { winner: 0, cravada: 0 };
  if (!bracket) return counts;
  for (const round of ROUNDS) {
    if (!round.scores) continue;
    for (let i = 0; i < round.count; i++) {
      const o = slotOutcome(bracket, round.key, i, picks);
      if (o === 'winner') counts.winner += 1;
      else if (o === 'cravada') counts.cravada += 1;
    }
  }
  return counts;
}

// Pontos do mata-mata = o DOBRO da pontuação convencional do bolão:
// acertar quem avança vale 2× o acerto de resultado; cravar vale 2× a cravada.
export function knockoutPointsFromCounts(counts, winnerPts, cravadaPts) {
  return (counts.winner || 0) * winnerPts + (counts.cravada || 0) * cravadaPts;
}
