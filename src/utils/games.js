const GROUP_ORDER = 'ABCDEFGHIJKL'.split('');

const PLACEHOLDER_RE = /\b(tbd|to be|winner|runner[-\s]?up|best\s*3|third|qualified|unknown|a definir|vencedor|perdedor|melhor|segundo|classificado)\b/i;
const SLOT_RE = /^([123][A-L]|[A-L][1234])$/i;

export function groupSortValue(group) {
  if (group === 'Fase Final') return 99;
  const idx = GROUP_ORDER.indexOf(String(group || '').toUpperCase());
  return idx >= 0 ? idx : 50;
}

export function isKnockoutGame(game) {
  return !game?.group;
}

export function isFixtureReadyForPrediction(game) {
  if (!isKnockoutGame(game)) return true;
  return isConcreteTeam(game.homeTeam, game.homeTeamCode) &&
    isConcreteTeam(game.awayTeam, game.awayTeamCode);
}

function isConcreteTeam(name, code) {
  const raw = `${code || ''} ${name || ''}`.trim();
  if (!raw) return false;
  if (PLACEHOLDER_RE.test(raw)) return false;
  if (SLOT_RE.test(String(code || '').trim())) return false;
  if (SLOT_RE.test(String(name || '').trim())) return false;
  return true;
}
