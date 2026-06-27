// Rótulos das fases, iguais entre a aba Jogos e a aba Mata-Mata.
// Os jogos guardam o stage cru da API (LAST_32/LAST_16); aqui exibimos bonito.
const STAGE_LABELS = {
  LAST_32: '16-avos de final',
  LAST_16: 'Oitavas de final',
  ROUND_OF_16: 'Oitavas de final',
  QUARTER_FINALS: 'Quartas de final',
  SEMI_FINALS: 'Semifinais',
  THIRD_PLACE: 'Terceiro lugar',
  FINAL: 'Final'
};

export function stageLabel(stage) {
  return STAGE_LABELS[stage] || stage || '';
}
