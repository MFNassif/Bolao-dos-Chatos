// Espelho de src/utils/scoring.js — mesma regra de pontuação.
const POINTS_EXACT = 5;
const POINTS_RESULT = 1;
const DEFAULT_SCORING = {
  exactScorePoints: POINTS_EXACT,
  correctResultPoints: POINTS_RESULT
};

function outcome(h, a) {
  if (h > a) return 'home';
  if (h < a) return 'away';
  return 'draw';
}

function scorePrediction(prediction, actual, settings = DEFAULT_SCORING) {
  if (
    !prediction || !actual ||
    !Number.isInteger(prediction.home) || !Number.isInteger(prediction.away) ||
    !Number.isInteger(actual.home) || !Number.isInteger(actual.away)
  ) {
    return { points: 0, exactScoreHit: false, resultHit: false };
  }
  const exactPoints = Number.isFinite(Number(settings?.exactScorePoints))
    ? Number(settings.exactScorePoints)
    : POINTS_EXACT;
  const resultPoints = Number.isFinite(Number(settings?.correctResultPoints))
    ? Number(settings.correctResultPoints)
    : POINTS_RESULT;
  const exact = prediction.home === actual.home && prediction.away === actual.away;
  if (exact) return { points: exactPoints, exactScoreHit: true, resultHit: true };
  if (outcome(prediction.home, prediction.away) === outcome(actual.home, actual.away)) {
    return { points: resultPoints, exactScoreHit: false, resultHit: true };
  }
  return { points: 0, exactScoreHit: false, resultHit: false };
}

// Erro de gols: |casa| + |fora|. Menor = mais perto. Criterio de desempate.
function goalError(prediction, actual) {
  if (
    !prediction || !actual ||
    !Number.isInteger(prediction.home) || !Number.isInteger(prediction.away) ||
    !Number.isInteger(actual.home) || !Number.isInteger(actual.away)
  ) {
    return 0;
  }
  return Math.abs(prediction.home - actual.home) + Math.abs(prediction.away - actual.away);
}

module.exports = { scorePrediction, goalError, POINTS_EXACT, POINTS_RESULT, DEFAULT_SCORING };
