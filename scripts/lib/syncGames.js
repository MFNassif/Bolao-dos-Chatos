/**
 * Sincroniza jogos da API externa para o Firestore.
 */
const { admin, db } = require('./firebase');
const { fetchFixtures, mapFixtureToGame } = require('./footballApi');
const { recalculateGame } = require('./scoringEngine');

async function syncGames() {
  const firestore = db();
  const start = Date.now();
  let added = 0;
  let updated = 0;
  let recalculated = 0;
  let success = true;
  let message = '';

  try {
    const fixtures = await fetchFixtures();
    if (!Array.isArray(fixtures) || !fixtures.length) {
      message = 'API retornou 0 jogos. Verifique COMPETITION_ID e SEASON.';
    }

    const existingSnap = await firestore.collection('games').get();
    const byExt = new Map();
    const existingGames = [];
    existingSnap.forEach((d) => {
      const data = d.data();
      existingGames.push({ id: d.id, data });
      if (data.externalId) byExt.set(String(data.externalId), { id: d.id, data });
    });

    let batch = firestore.batch();
    let ops = 0;
    const recalcGameIds = new Set();
    async function flushIfNeeded() {
      if (ops >= 450) {
        await batch.commit();
        batch = firestore.batch();
        ops = 0;
      }
    }

    for (const fx of fixtures) {
      const game = mapFixtureToGame(fx);
      if (!game.externalId) continue;
      const existing = byExt.get(game.externalId) || findExistingGame(game, existingGames);
      const docId = existing ? existing.id : `ext_${game.externalId}`;
      const ref = firestore.collection('games').doc(docId);
      const payload = {
        ...game,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (existing) {
        const cur = existing.data;
        const statusChanged = cur.status !== game.status;
        const scoreChanged = cur.homeScore !== game.homeScore || cur.awayScore !== game.awayScore;
        if (
          statusChanged ||
          scoreChanged ||
          game.status === 'live' ||
          cur.status === 'live'
        ) {
          recalcGameIds.add(docId);
        }
        batch.set(ref, payload, { merge: true });
        updated += 1;
      } else {
        batch.set(ref, {
          ...payload,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        added += 1;
      }
      ops += 1;
      await flushIfNeeded();
    }
    if (ops > 0) await batch.commit();
    for (const gameId of recalcGameIds) {
      await recalculateGame(gameId);
      recalculated += 1;
    }
    if (!message) message = `Sincronizados ${fixtures.length} jogos. ${recalculated} recalculos disparados.`;
  } catch (err) {
    success = false;
    message = err.message || String(err);
    console.error('[syncGames] erro:', err);
  }

  await writeSyncLog(firestore, {
    type: 'syncGames',
    success,
    message,
    added,
    updated,
    recalculated,
    durationMs: Date.now() - start,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success, added, updated, recalculated, message };
}

module.exports = { syncGames };

async function writeSyncLog(firestore, payload) {
  try {
    await firestore.collection('syncLogs').add(payload);
  } catch (err) {
    console.warn(`[syncLogs] log ignorado: ${err.message || err}`);
  }
}

function findExistingGame(game, existingGames) {
  const targetTime = toMillis(game.startTime);
  if (!targetTime) return null;

  let best = null;
  let bestScore = 0;
  for (const existing of existingGames) {
    const data = existing.data;
    const existingTime = toMillis(data.startTime);
    if (!existingTime || Math.abs(existingTime - targetTime) > 3 * 60 * 60 * 1000) continue;

    const score =
      sameTeam(game.homeTeamCode, game.homeTeam, data.homeTeamCode, data.homeTeam) &&
      sameTeam(game.awayTeamCode, game.awayTeam, data.awayTeamCode, data.awayTeam)
        ? 3
        : 0;
    if (score > bestScore) {
      best = existing;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : null;
}

function sameTeam(codeA, nameA, codeB, nameB) {
  const aCode = normalize(codeA);
  const bCode = normalize(codeB);
  if (aCode && bCode && aCode === bCode) return true;

  const aName = normalize(nameA);
  const bName = normalize(nameB);
  if (!aName || !bName) return false;
  return aName === bName || aName.includes(bName) || bName.includes(aName);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}
