#!/usr/bin/env node
/**
 * CLI: atualiza placares e dispara recalculo da pontuacao.
 *
 * Estrategia 100% gratis:
 *  - O workflow no GitHub roda no cron (que o GitHub atrasa bastante no plano
 *    gratis) e tambem a cada push em scripts/.
 *  - Antes de chamar a API esportiva, verifica no Firestore se existe jogo
 *    LIVE agora OU jogo SCHEDULED dentro da janela ativa.
 *  - Modo plantao (UPDATE_LOOP=1): em vez de rodar uma vez e sair, fica em
 *    loop atualizando a cada UPDATE_LOOP_INTERVAL_SECONDS enquanto houver
 *    jogo na janela, ate UPDATE_LOOP_MAX_MINUTES. Assim um unico disparo do
 *    cron cobre o jogo inteiro, mesmo que o GitHub so dispare a cada horas.
 *  - Se nao ha jogo agora mas o proximo comeca em ate LOOKAHEAD, o plantao
 *    dorme ate a janela abrir em vez de encerrar.
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

const LOOP = process.env.UPDATE_LOOP === '1';
const LOOP_INTERVAL_MS = Number(process.env.UPDATE_LOOP_INTERVAL_SECONDS || 90) * 1000;
const LOOP_MAX_MS = Number(process.env.UPDATE_LOOP_MAX_MINUTES || 330) * 60 * 1000;
const LOOKAHEAD_MS = Number(process.env.UPDATE_LOOP_LOOKAHEAD_MINUTES || 180) * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function nextScheduledStart() {
  const snap = await db().collection('games')
    .where('status', '==', 'scheduled')
    .where('startTime', '>', new Date())
    .orderBy('startTime', 'asc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const st = snap.docs[0].data().startTime;
  return st && st.toDate ? st.toDate() : new Date(st);
}

(async () => {
  try {
    const startedAt = Date.now();
    let failures = 0;

    while (true) {
      const decision = await shouldRun();

      if (decision.run) {
        console.log(`[${new Date().toISOString()}] Running update: ${decision.reason}.`);
        let success = false;
        try {
          const r = await updateResults();
          success = r.success;
          if (r.updated > 0 || !r.success) console.log(JSON.stringify(r));
        } catch (err) {
          console.error(err);
        }
        failures = success ? 0 : failures + 1;

        if (!LOOP) process.exit(success ? 0 : 1);
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(`Encerrando apos ${failures} falhas seguidas.`);
          process.exit(1);
        }
        if (Date.now() - startedAt + LOOP_INTERVAL_MS > LOOP_MAX_MS) {
          console.log('Limite de duracao do plantao atingido. Proximo disparo continua.');
          process.exit(0);
        }
        await sleep(LOOP_INTERVAL_MS);
        continue;
      }

      if (!LOOP) {
        console.log(`Skipping API call: ${decision.reason}.`);
        process.exit(0);
      }

      // Plantao sem jogo na janela: se o proximo jogo esta perto, dorme ate
      // a janela abrir; senao encerra e deixa para o proximo disparo do cron.
      const next = await nextScheduledStart();
      if (!next) {
        console.log('Plantao encerrado: nenhum jogo futuro agendado.');
        process.exit(0);
      }
      const windowOpensIn = next.getTime() - PRE_GAME_MINUTES * 60 * 1000 - Date.now();
      if (windowOpensIn > LOOKAHEAD_MS) {
        console.log(`Plantao encerrado: proximo jogo so em ${Math.round(windowOpensIn / 60000)} min.`);
        process.exit(0);
      }
      if (Date.now() - startedAt + windowOpensIn > LOOP_MAX_MS) {
        console.log('Plantao encerrado: janela do proximo jogo excede o limite de duracao.');
        process.exit(0);
      }
      const waitMs = Math.max(windowOpensIn, 30 * 1000);
      console.log(`[${new Date().toISOString()}] Aguardando ${Math.round(waitMs / 60000)} min ate a janela do proximo jogo.`);
      await sleep(waitMs);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
