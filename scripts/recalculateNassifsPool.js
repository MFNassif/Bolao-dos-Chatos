#!/usr/bin/env node
try { require('dotenv').config({ path: __dirname + '/.env' }); } catch (_) {}

const { recalculatePool } = require('./lib/scoringEngine');

(async () => {
  try {
    const result = await recalculatePool('nassifs');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
