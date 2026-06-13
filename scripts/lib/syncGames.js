/**
 * Sincroniza o CALENDARIO dos jogos da API externa para o Firestore.
 *
 * IMPORTANTE: esta sincronizacao NUNCA mexe em placar nem em status.
 * Quem joga, quando e em qual fase vem da API (inclusive os times que se
 * classificam no mata-mata). Mas se o jogo iniciou (ao vivo), encerrou e o
 * placar sao 100% controlados pelo admin no painel.
 */
const { admin, db } = require('./firebase');
const { fetchFixtures, mapFixtureToGame } = require('./footballApi');

// Apenas metadados do jogo. Placar/status ficam de fora de proposito.
const META_FIELDS = [
  'externalId', 'homeTeam', 'awayTeam', 'homeTeamCode', 'awayTeamCode',
  'homeTeamFlag', 'awayTeamFlag', 'stage', 'group', 'timezone'
];

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
      const ref = firestore.collection('games').doc(existing ? existing.id : `ext_${game.externalId}`);

      if (existing) {
        // Atualiza SOMENTE metadados. status/homeScore/awayScore/winner do jogo
        // existente sao deixados como estao (controle do admin).
        const meta = {};
        let changed = false;
        for (const key of META_FIELDS) {
          if (normalizeValue(existing.data[key]) !== normalizeValue(game[key])) {
            meta[key] = game[key] === undefined ? null : game[key];
            changed = true;
          }
        }
        if (normalizeTime(existing.data.startTime) !== normalizeTime(game.startTime)) {
          meta.startTime = game.startTime;
          changed = true;
        }
        if (changed) {
          meta.lastUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
          batch.set(ref, meta, { merge: true });
          updated += 1;
          ops += 1;
          await flushIfNeeded();
        } else {
          unchanged += 1;
        }
      } else {
        // Novo jogo entra como "nao comecou", sem placar. O admin assume daqui.
        batch.set(ref, {
          ...metaOf(game),
          startTime: game.startTime,
          status: 'scheduled',
          homeScore: null,
          awayScore: null,
          winner: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        added += 1;
        ops += 1;
        await flushIfNeeded();
      }
    }
    if (ops > 0) await batch.commit();
    if (!message) {
      message = `Calendario sincronizado: ${added} novos, ${updated} atualizados, ${unchanged} sem mudanca. Placar e status sao manuais.`;
    }
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

function metaOf(game) {
  const out = {};
  for (const key of META_FIELDS) out[key] = game[key] === undefined ? null : game[key];
  return out;
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

module.exports = { syncGames };
