export const DEFAULT_POOL_ID = 'nassifs';
export const DEFAULT_POOL_NAME = 'Nassifs';

export function normalizePoolName(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validatePoolName(name) {
  const trimmed = (name || '').trim();
  if (trimmed.length < 3) return 'Informe o nome do bolao.';
  if (trimmed.length > 40) return 'Use no maximo 40 caracteres no nome do bolao.';
  if (!normalizePoolName(trimmed)) return 'Use letras ou numeros no nome do bolao.';
  return null;
}

export function validatePoolPassword(password) {
  if (!password || password.length < 6) return 'Informe a senha do bolao com ao menos 6 caracteres.';
  if (password.length > 64) return 'A senha do bolao esta muito longa.';
  return null;
}

export function poolMemberId(poolId, uid) {
  return `${poolId}_${uid}`;
}

export async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function poolSecretId(poolId, password) {
  const hash = await sha256(`${poolId}:${password}`);
  return `${poolId}_${hash}`;
}
