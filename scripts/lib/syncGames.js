/**
 * Sincroniza jogos da API externa para o Firestore.
 */
const { admin, db } = require('./firebase');
const { fetchFixtures, mapFixtureToGame } = require('./footballApi');

async function syncGames() {
  const firestore = db();
  const start = Date.now();
  let added = 0;
  let updated = 0;
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
      const docId = existing ? existing.id : `ext_${game.externalId}`;
      const ref = firestore.collection('games').doc(docId);
      const payload = {
        ...game,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (existing) {
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
    durationMs: Date.now() - start,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success, added, updated, message };
}

module.exports = { syncGames };
