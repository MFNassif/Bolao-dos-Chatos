#!/usr/bin/env node
/**
 * CLI: atualiza placares e dispara recalculo da pontuacao.
 *
 * O workflow roda a cada 5 minutos. Antes de chamar a API esportiva,
 * verificamos se existe jogo ao vivo, jogo perto do horario, ou jogo
 * encerrado recente sem placar salvo.
 */
try { require('dotenv').config({ path: __dirname + '/.env' }); } catch (_) {}

const { updateResults } = require('./lib/updateResults');
const { db } = require('./lib/firebase');

// GitHub Actions pode atrasar ou pular uma execucao. A janela precisa cobrir
// o antes do jogo e algumas horas depois para nao deixar placar preso.
const PRE_GAME_MINUTES = 60;
const POST_GAME_MINUTES = 8 * 60;

async function shouldRun() {
  const firestore = db();

  const liveSnap = await firestore.collection('games')
    .where('status', '==', 'live')
    .limit(1)
    .get();
  if (!liveSnap.empty) {
    return { run: true, reason: 'jogo ao vivo' };
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - POST_GAME_MINUTES * 60 * 1000);
  const windowEnd = new Date(now.getTime() + PRE_GAME_MINUTES * 60 * 1000);

  const schedSnap = await firestore.collection('games')
    .where('status', '==', 'scheduled')
    .where('startTime', '>=', windowStart)
    .where('startTime', '<=', windowEnd)
    .limit(1)
    .get();
  if (!schedSnap.empty) {
    return { run: true, reason: 'jogo scheduled dentro da janela de atualizacao' };
  }

  const finishedSnap = await firestore.collection('games')
    .where('status', '==', 'finished')
    .where('startTime', '>=', windowStart)
    .limit(20)
    .get();
  const hasFinishedWithoutScore = finishedSnap.docs.some((d) => {
    const data = d.data();
    return !Number.isInteger(data.homeScore) || !Number.isInteger(data.awayScore);
  });
  if (hasFinishedWithoutScore) {
    return { run: true, reason: 'jogo finished recente sem placar salvo' };
  }

  return { run: false, reason: 'sem jogo live ou recente' };
}

(async () => {
  try {
    const decision = await shouldRun();
    if (!decision.run) {
      console.log(`Skipping API call: ${decision.reason}.`);
      process.exit(0);
    }
    console.log(`Running update: ${decision.reason}.`);
    const r = await updateResults();
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.success ? 0 : 1);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
