#!/usr/bin/env node
try { require('dotenv').config({ path: __dirname + '/.env' }); } catch (_) {} // dotenv opcional, só p/ rodar local
const { recalculateAll } = require('./lib/scoringEngine');
const { admin, db } = require('./lib/firebase');

(async () => {
  try {
    const r = await recalculateAll();
    await db().collection('syncLogs').add({
      type: 'recalculateAll',
      success: true,
      message: `Recálculo total: ${r.predictions} palpites, ${r.users} usuários.`,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
