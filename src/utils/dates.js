// Util de datas, sempre exibindo no fuso de São Paulo.

const TZ = 'America/Sao_Paulo';

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return new Date(value);
  // Firestore Timestamp
  if (typeof value.toDate === 'function') return value.toDate();
  if (value.seconds != null) return new Date(value.seconds * 1000);
  return null;
}

export function toMillis(value) {
  const d = toDate(value);
  return d ? d.getTime() : 0;
}

export function formatDate(value) {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(d);
}

export function formatTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit'
  }).format(d);
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(d);
}

export function dayKey(value) {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

export function dayLabel(value) {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, weekday: 'short', day: '2-digit', month: 'long'
  }).format(d);
}
