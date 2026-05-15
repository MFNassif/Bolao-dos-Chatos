// Regras de pontuação do bolão.
// Reutilizada no frontend (preview) e nas Cloud Functions (cálculo oficial).

export const POINTS_EXACT = 5;
export const POINTS_RESULT = 1;

/**
 * Calcula os pontos para um palpite contra um resultado oficial.
 * @param {{home: number, away: number}} prediction
 * @param {{home: number, away: number}} actual
 * @returns {{points: number, exactScoreHit: boolean, resultHit: boolean}}
 */
export function scorePrediction(prediction, actual) {
  if (
    !prediction || !actual ||
    !Number.isInteger(prediction.home) || !Number.isInteger(prediction.away) ||
    !Number.isInteger(actual.home) || !Number.isInteger(actual.away)
  ) {
    return { points: 0, exactScoreHit: false, resultHit: false };
  }

  const exact =
    prediction.home === actual.home && prediction.away === actual.away;
  if (exact) {
    return { points: POINTS_EXACT, exactScoreHit: true, resultHit: true };
  }

  const predOutcome = outcome(prediction.home, prediction.away);
  const actualOutcome = outcome(actual.home, actual.away);

  if (predOutcome === actualOutcome) {
    return { points: POINTS_RESULT, exactScoreHit: false, resultHit: true };
  }
  return { points: 0, exactScoreHit: false, resultHit: false };
}

function outcome(h, a) {
  if (h > a) return 'home';
  if (h < a) return 'away';
  return 'draw';
}
