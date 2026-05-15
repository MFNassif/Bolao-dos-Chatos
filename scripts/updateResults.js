#!/usr/bin/env node
/**
 * CLI: atualiza placares e dispara recálculo da pontuação.
 *
 * Estratégia 100% grátis:
 *  - O workflow no GitHub roda a cada 5 minutos (cron mínimo do GitHub Actions).
 *  - Antes de chamar a API esportiva, verifica no Firestore se existe jogo
 *    LIVE agora OU jogo SCHEDULED que comece nos próximos 15 min.
 *  - Se não houver, encerra sem gastar quota da API esportiva.
 *
 * Cota estimada para Copa do Mundo (64 jogos × 2h cada = ~128h de jogos):
 *   128h × 12 chamadas/hora (uma a cada 5min) = ~1.500 chamadas em toda a Copa.
 *   Diluído ao longo de ~30 dias = ~50 chamadas/dia em média.
 *   Plano grátis da API-Football: 100 chamadas/dia. CABE FÁCIL.
 */
try { require('dotenv').config({ path: __dirname + '/.env' }); } catch (_) {}

const { updateResults } = require('./lib/updateResults');
const { db } = require('./lib/firebase');

// Janela em que consideramos um jogo "iminente" e ligamos as atualizações.
const PRE_GAME_MINUTES = 15;
// Janela em que consideramos um jogo recém-encerrado e ainda valem updates.
const POST_GAME_MINUTES = 15;

async function shouldRun() {
  const firestore = db();

  // 1) Algum jogo LIVE agora?
  const liveSnap = await firestore.collection('games')
    .where('status', '==', 'live').limit(1).get();
  if (!liveSnap.empty) {
    return { run: true, reason: 'jogo ao vivo' };
  }

  // 2) Algum jogo SCHEDULED prestes a começar?
  const now = new Date();
  const soon = new Date(now.getTime() + PRE_GAME_MINUTES * 60 * 1000);
  const schedSnap = await firestore.collection('games')
    .where('status', '==', 'scheduled')
    .where('startTime', '<=', soon)
    .limit(1)
    .get();

  // Filtra também os que já estão no passado (caso a API esteja atrasada
  // em marcar como live — vale a pena rodar pra detectar)
  const hasImminent = schedSnap.docs.some((d) => {
    const t = d.data().startTime?.toDate?.() || new Date(d.data().startTime);
    const diff = (t - now) / 60000;
    return diff <= PRE_GAME_MINUTES && diff >= -POST_GAME_MINUTES;
  });
  if (hasImminent) {
    return { run: true, reason: `jogo iminente em ${PRE_GAME_MINUTES} min` };
  }

  // 3) Algum jogo SCHEDULED que já passou da hora (a API ainda não atualizou pra live)?
  // Esse caso evita perder o início do jogo se a API estiver atrasada.
  const past = new Date(now.getTime() - POST_GAME_MINUTES * 60 * 1000);
  const lateSnap = await firestore.collection('games')
    .where('status', '==', 'scheduled')
    .where('startTime', '<=', now)
    .where('startTime', '>=', past)
    .limit(1)
    .get();
  if (!lateSnap.empty) {
    return { run: true, reason: 'jogo que já começou mas API ainda diz scheduled' };
  }

  return { run: false, reason: 'sem jogo live ou iminente' };
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
