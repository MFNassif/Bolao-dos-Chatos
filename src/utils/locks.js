import { toMillis } from './dates';

// Bloqueio do palpite: 1h antes do início do jogo.
export const LOCK_OFFSET_MS = 60 * 60 * 1000;

export function lockTimeMs(startTime) {
  const ms = toMillis(startTime);
  if (!ms) return 0;
  return ms - LOCK_OFFSET_MS;
}

export function isLocked(startTime, now = Date.now()) {
  const lock = lockTimeMs(startTime);
  if (!lock) return true;
  return now >= lock;
}

export function timeUntilLock(startTime, now = Date.now()) {
  return lockTimeMs(startTime) - now;
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
