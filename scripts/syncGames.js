#!/usr/bin/env node
try { require('dotenv').config({ path: __dirname + '/.env' }); } catch (_) {} // dotenv opcional, só p/ rodar local
const { syncGames } = require('./lib/syncGames');

(async () => {
  try {
    const r = await syncGames();
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.success ? 0 : 1);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
