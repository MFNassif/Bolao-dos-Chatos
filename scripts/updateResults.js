#!/usr/bin/env node
/**
 * CLI: atualiza placares e dispara recalculo da pontuacao.
 *
 * Estrategia 100% gratis:
 *  - O workflow no GitHub roda a cada 5 minutos.
 *  - Antes de chamar a API esportiva, verifica no Firestore se existe jogo
 *    LIVE agora OU jogo SCHEDULED dentro da janela ativa.
 *  - Se nao houver, encerra sem gastar quota da API esportiva.
 *
 * A janela fica aberta de 30 min antes ate 210 min depois do horario marcado.
 * Assim o app continua buscando placar durante prorrogacao/penaltis e tambem
 * quando a API demora para mudar scheduled -> live.
 */
try { require('dotenv').config({ path: __dirname + '/.env' }); } catch (_) {}

const { updateResults } = require('./lib/updateResults');
const { db } = require('./lib/firebase');

const PRE_GAME_MINUTES = 30;
const SCHEDULED_AFTER_START_MINUTES = 210;

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
  const soon = new Date(now.getTime() + PRE_GAME_MINUTES * 60 * 1000);
  const activeStart = new Date(now.getTime() - SCHEDULED_AFTER_START_MINUTES * 60 * 1000);

  const schedSnap = await firestore.collection('games')
    .where('status', '==', 'scheduled')
    .where('startTime', '>=', activeStart)
    .where('startTime', '<=', soon)
    .orderBy('startTime', 'asc')
    .limit(1)
    .get();

  if (!schedSnap.empty) {
    return {
      run: true,
      reason: `jogo scheduled na janela ativa (${PRE_GAME_MINUTES} min antes ate ${SCHEDULED_AFTER_START_MINUTES} min depois)`
    };
  }

  return { run: false, reason: 'sem jogo live ou scheduled na janela ativa' };
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
