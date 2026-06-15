import { toMillis } from './dates';

// Bloqueio do palpite: por padrao 1h antes do inicio do jogo.
// O admin pode desligar esse bloqueio de 1h; nesse caso o palpite fecha
// no horario de inicio do jogo (kickoff), nunca depois.
export const LOCK_OFFSET_MS = 60 * 60 * 1000;

export function lockOffsetMs(lockOneHourBefore = true) {
  return lockOneHourBefore === false ? 0 : LOCK_OFFSET_MS;
}

export function lockTimeMs(startTime, lockOneHourBefore = true) {
  const ms = toMillis(startTime);
  if (!ms) return 0;
  return ms - lockOffsetMs(lockOneHourBefore);
}

export function isLocked(startTime, lockOneHourBefore = true, now = Date.now()) {
  const lock = lockTimeMs(startTime, lockOneHourBefore);
  if (!lock) return true;
  return now >= lock;
}

export function timeUntilLock(startTime, lockOneHourBefore = true, now = Date.now()) {
  return lockTimeMs(startTime, lockOneHourBefore) - now;
}

export function formatCountdown(ms) {
  if (ms <= 0) return 'bloqueado';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}
