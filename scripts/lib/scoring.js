// Espelho de src/utils/scoring.js — mesma regra de pontuação.
const POINTS_EXACT = 5;
const POINTS_RESULT = 1;

function outcome(h, a) {
  if (h > a) return 'home';
  if (h < a) return 'away';
  return 'draw';
}

function scorePrediction(prediction, actual) {
  if (
    !prediction || !actual ||
    !Number.isInteger(prediction.home) || !Number.isInteger(prediction.away) ||
    !Number.isInteger(actual.home) || !Number.isInteger(actual.away)
  ) {
    return { points: 0, exactScoreHit: false, resultHit: false };
  }
  const exact = prediction.home === actual.home && prediction.away === actual.away;
  if (exact) return { points: POINTS_EXACT, exactScoreHit: true, resultHit: true };
  if (outcome(prediction.home, prediction.away) === outcome(actual.home, actual.away)) {
    return { points: POINTS_RESULT, exactScoreHit: false, resultHit: true };
  }
  return { points: 0, exactScoreHit: false, resultHit: false };
}

module.exports = { scorePrediction, POINTS_EXACT, POINTS_RESULT };
