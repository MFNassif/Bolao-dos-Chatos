function hasScore(game) {
  return Number.isInteger(game?.homeScore) && Number.isInteger(game?.awayScore);
}

function hasStartedStatus(game) {
  return game?.status === 'live' || game?.status === 'finished';
}

function isRegressiveApiUpdate(current, incoming) {
  if (!current || !incoming) return false;

  const currentHasScore = hasScore(current);
  const incomingHasScore = hasScore(incoming);

  if (currentHasScore && !incomingHasScore) return true;
  if (current?.status === 'finished' && incoming?.status !== 'finished') return true;
  if (current?.status === 'live' && incoming?.status === 'scheduled') return true;

  const currentHasProgress = hasStartedStatus(current) || currentHasScore;
  const incomingHasProgress = hasStartedStatus(incoming) || incomingHasScore;
  return currentHasProgress && !incomingHasProgress;
}

function preserveProgressIfRegression(current, incoming) {
  if (!isRegressiveApiUpdate(current, incoming)) return incoming;
  return {
    ...incoming,
    status: current.status || incoming.status,
    homeScore: current.homeScore ?? null,
    awayScore: current.awayScore ?? null,
    winner: current.winner ?? null
  };
}

module.exports = {
  isRegressiveApiUpdate,
  preserveProgressIfRegression
};
