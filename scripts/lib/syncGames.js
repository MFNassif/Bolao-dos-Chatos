/**
 * Sincroniza jogos da API externa para o Firestore.
 */
const { admin, db } = require('./firebase');
const { fetchFixtures, mapFixtureToGame } = require('./footballApi');
const { preserveProgressIfRegression } = require('./gameUpdateGuards');

async function syncGames() {
  const firestore = db();
  const start = Date.now();
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let success = true;
  let message = '';

  try {
    const fixtures = await fetchFixtures();
    if (!Array.isArray(fixtures) || !fixtures.length) {
      message = 'API retornou 0 jogos. Verifique COMPETITION_ID e SEASON.';
    }

    const existingSnap = await firestore.collection('games').get();
    const byExt = new Map();
    existingSnap.forEach((d) => {
      const data = d.data();
      if (data.externalId) byExt.set(String(data.externalId), { id: d.id, data });
    });

    let batch = firestore.batch();
    let ops = 0;
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
      const existing = byExt.get(game.externalId);
      const safeGame = existing ? preserveProgressIfRegression(existing.data, game) : game;
      const docId = existing ? existing.id : `ext_${game.externalId}`;
      const ref = firestore.collection('games').doc(docId);
      const payload = {
        ...safeGame,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (existing) {
        if (hasGameChanges(existing.data, safeGame)) {
          batch.set(ref, payload, { merge: true });
          updated += 1;
          ops += 1;
          await flushIfNeeded();
        } else {
          unchanged += 1;
        }
      } else {
        batch.set(ref, {
          ...payload,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        added += 1;
        ops += 1;
        await flushIfNeeded();
      }
    }
    if (ops > 0) await batch.commit();
    if (!message) message = `Sincronizados ${fixtures.length} jogos.`;
  } catch (err) {
    success = false;
    message = err.message || String(err);
    console.error('[syncGames] erro:', err);
  }

  await firestore.collection('syncLogs').add({
    type: 'syncGames',
    success,
    message,
    added,
    updated,
    unchanged,
    durationMs: Date.now() - start,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success, added, updated, unchanged, message };
}

module.exports = { syncGames };

function hasGameChanges(current, next) {
  return [
    'externalId',
    'homeTeam',
    'awayTeam',
    'homeTeamCode',
    'awayTeamCode',
    'homeTeamFlag',
    'awayTeamFlag',
    'stage',
    'group',
    'status',
    'homeScore',
    'awayScore',
    'winner'
  ].some((key) => normalizeValue(current?.[key]) !== normalizeValue(next?.[key])) ||
    normalizeTime(current?.startTime) !== normalizeTime(next?.startTime);
}

function normalizeValue(value) {
  return value === undefined ? null : value;
}

function normalizeTime(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
