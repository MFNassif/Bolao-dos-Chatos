#!/usr/bin/env node
try { require('dotenv').config({ path: __dirname + '/.env' }); } catch (_) {}

const { admin, db } = require('./lib/firebase');
const { scorePrediction, goalError, DEFAULT_SCORING } = require('./lib/scoring');

const TARGET_POOL_ID = 'nassifs';
const TARGET_CODES = new Set(['CAN', 'RSA']);

const ROUNDS = [
  { key: 'r32', stage: 'LAST_32' },
  { key: 'r16', stage: 'LAST_16' },
  { key: 'qf', stage: 'Quartas de final' },
  { key: 'sf', stage: 'Semifinais' },
  { key: 'fin', stage: 'Final' }
];

function toMillis(value) {
  if (!value) return 0;
  if (value.toMillis) return value.toMillis();
  if (value.toDate) return value.toDate().getTime();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function isTargetGame(game) {
  const home = String(game.homeTeamCode || '').toUpperCase();
  const away = String(game.awayTeamCode || '').toUpperCase();
  return TARGET_CODES.has(home) && TARGET_CODES.has(away) && home !== away;
}

function sortGames(a, b) {
  const ea = Number(a.externalId);
  const eb = Number(b.externalId);
  if (Number.isFinite(ea) && Number.isFinite(eb) && ea !== eb) return ea - eb;
  return toMillis(a.startTime) - toMillis(b.startTime);
}

function findTargetSlot(games) {
  const matches = games.filter((g) => !g.group && isTargetGame(g));
  if (matches.length !== 1) {
    throw new Error(`Esperava exatamente 1 jogo CAN x RSA no mata-mata; encontrei ${matches.length}.`);
  }

  const target = matches[0];
  const round = ROUNDS.find((r) => r.stage === target.stage);
  if (!round) {
    throw new Error(`Jogo ${target.id} tem stage "${target.stage}", que nao existe no chaveamento.`);
  }

  const roundGames = games
    .filter((g) => !g.group && g.stage === round.stage)
    .sort(sortGames);
  const index = roundGames.findIndex((g) => g.id === target.id);
  if (index < 0) {
    throw new Error(`Nao consegui localizar ${target.id} dentro da fase ${round.stage}.`);
  }

  return { game: target, slotId: `${round.key}-${index}`, roundKey: round.key, index };
}

function validScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= 30;
}

function isScoreableGame(game) {
  return Number.isInteger(game.homeScore) && Number.isInteger(game.awayScore);
}

function displayName(member) {
  return member.displayName || member.username || member.uid;
}

async function commitBatch(firestore, writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = firestore.batch();
    for (const write of writes.slice(i, i + 400)) write(batch);
    await batch.commit();
  }
}

async function main() {
  const firestore = db();

  const poolSnap = await firestore.collection('pools').doc(TARGET_POOL_ID).get();
  if (!poolSnap.exists) throw new Error(`Bolao ${TARGET_POOL_ID} nao encontrado.`);
  const pool = { id: poolSnap.id, ...poolSnap.data() };
  if (String(pool.name || '').toLowerCase() !== 'nassifs') {
    throw new Error(`O pool ${TARGET_POOL_ID} existe, mas o nome e "${pool.name}". Abortando.`);
  }

  const [membersSnap, gamesSnap] = await Promise.all([
    firestore.collection('poolMembers').where('poolId', '==', TARGET_POOL_ID).get(),
    firestore.collection('games').get()
  ]);
  if (membersSnap.empty) throw new Error('Nenhum membro encontrado no bolao Nassifs.');

  const games = gamesSnap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
  const { game, slotId, roundKey, index } = findTargetSlot(games);
  const gameById = new Map(games.map((g) => [g.id, g]));

  const settings = { ...DEFAULT_SCORING, ...pool };
  const exactPts = Number.isFinite(Number(settings.exactScorePoints))
    ? Number(settings.exactScorePoints)
    : DEFAULT_SCORING.exactScorePoints;
  const resultPts = Number.isFinite(Number(settings.correctResultPoints))
    ? Number(settings.correctResultPoints)
    : DEFAULT_SCORING.correctResultPoints;

  const members = membersSnap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
  const importedByUid = new Map();
  const skipped = [];
  const writes = [];

  for (const member of members) {
    if (!member.uid) {
      skipped.push({ uid: null, name: member.id, reason: 'membro sem uid' });
      continue;
    }

    const koSnap = await firestore.collection('knockoutPredictions').doc(member.uid).get();
    const pick = koSnap.exists ? koSnap.data()?.picks?.[slotId] : null;
    if (!pick) {
      skipped.push({ uid: member.uid, name: displayName(member), reason: `sem palpite em ${slotId}` });
      continue;
    }
    if (!validScore(pick.homeScore) || !validScore(pick.awayScore)) {
      skipped.push({ uid: member.uid, name: displayName(member), reason: 'placar incompleto/invalido no mata-mata' });
      continue;
    }

    const imported = {
      uid: member.uid,
      username: member.username || '',
      displayName: displayName(member),
      homePrediction: pick.homeScore,
      awayPrediction: pick.awayScore
    };
    importedByUid.set(member.uid, imported);

    const poolPredictionId = `${TARGET_POOL_ID}_${game.id}_${member.uid}`;
    const sourcePredictionId = `${game.id}_${member.uid}`;
    const predRef = firestore.collection('poolPredictions').doc(poolPredictionId);
    writes.push((batch) => batch.set(predRef, {
      poolId: TARGET_POOL_ID,
      poolName: pool.name || 'Nassifs',
      sourcePredictionId,
      userId: member.uid,
      username: imported.username,
      displayName: imported.displayName,
      gameId: game.id,
      homePrediction: imported.homePrediction,
      awayPrediction: imported.awayPrediction,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true }));
  }

  for (const member of members) {
    if (!member.uid) continue;
    const predsSnap = await firestore.collection('predictions').where('userId', '==', member.uid).get();
    const predictions = new Map(predsSnap.docs.map((doc) => [doc.data().gameId, { id: doc.id, ...doc.data() }]));
    const imported = importedByUid.get(member.uid);
    if (imported) {
      predictions.set(game.id, {
        userId: member.uid,
        gameId: game.id,
        homePrediction: imported.homePrediction,
        awayPrediction: imported.awayPrediction
      });
    }

    let totalPoints = 0;
    let exactScores = 0;
    let correctResults = 0;
    let goalErrorSum = 0;

    for (const pred of predictions.values()) {
      const predGame = gameById.get(pred.gameId);
      if (!predGame || !isScoreableGame(predGame)) continue;
      const result = scorePrediction(
        { home: pred.homePrediction, away: pred.awayPrediction },
        { home: predGame.homeScore, away: predGame.awayScore },
        { exactScorePoints: exactPts, correctResultPoints: resultPts }
      );
      totalPoints += result.points || 0;
      if (result.exactScoreHit) exactScores += 1;
      if (result.resultHit) correctResults += 1;
      goalErrorSum += goalError(
        { home: pred.homePrediction, away: pred.awayPrediction },
        { home: predGame.homeScore, away: predGame.awayScore }
      );
    }

    writes.push((batch) => batch.set(member.ref, {
      totalPoints,
      exactScores,
      correctResults,
      goalError: goalErrorSum,
      predictionsCount: predictions.size,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true }));
  }

  await commitBatch(firestore, writes);

  const summary = {
    poolId: TARGET_POOL_ID,
    poolName: pool.name,
    gameId: game.id,
    game: `${game.homeTeamCode || game.homeTeam} x ${game.awayTeamCode || game.awayTeam}`,
    gameScore: isScoreableGame(game) ? `${game.homeScore} x ${game.awayScore}` : null,
    stage: game.stage,
    slotId,
    roundKey,
    index,
    members: members.length,
    imported: importedByUid.size,
    skipped: skipped.length,
    recalculatedMembers: members.length
  };

  await firestore.collection('syncLogs').add({
    type: 'importNassifsCanRsaFromKnockout',
    success: true,
    message: `Importados ${summary.imported}/${summary.members} palpites do ${slotId} para ${TARGET_POOL_ID}; ranking recalculado.`,
    ...summary,
    skippedPreview: skipped.slice(0, 20),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(JSON.stringify({ ...summary, skipped }, null, 2));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
