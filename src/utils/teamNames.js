/**
 * Modo Diva — traduz siglas e nomes de seleções para português completo.
 * Fonte: nomes oficiais em português utilizados pela CBF e mídia brasileira.
 */

const NAMES = {
  // Américas
  ARG: 'Argentina',
  BOL: 'Bolívia',
  BRA: 'Brasil',
  CAN: 'Canadá',
  CHI: 'Chile',
  COL: 'Colômbia',
  CRC: 'Costa Rica',
  CUB: 'Cuba',
  ECU: 'Equador',
  GUA: 'Guatemala',
  HAI: 'Haiti',
  HON: 'Honduras',
  JAM: 'Jamaica',
  MEX: 'México',
  PAN: 'Panamá',
  PAR: 'Paraguai',
  PER: 'Peru',
  SLV: 'El Salvador',
  TRI: 'Trinidad e Tobago',
  URU: 'Uruguai',
  USA: 'Estados Unidos',
  VEN: 'Venezuela',

  // Europa
  ALE: 'Alemanha',
  GER: 'Alemanha',
  AND: 'Andorra',
  AUT: 'Áustria',
  BEL: 'Bélgica',
  BIH: 'Bósnia e Herzegovina',
  BUL: 'Bulgária',
  CRO: 'Croácia',
  DIN: 'Dinamarca',
  DEN: 'Dinamarca',
  ESC: 'Escócia',
  SCO: 'Escócia',
  ESP: 'Espanha',
  FIN: 'Finlândia',
  FRA: 'França',
  GAL: 'Gales',
  WAL: 'Gales',
  GRE: 'Grécia',
  HUN: 'Hungria',
  ING: 'Inglaterra',
  ENG: 'Inglaterra',
  IRL: 'Irlanda',
  ISL: 'Islândia',
  ISR: 'Israel',
  ITA: 'Itália',
  KOS: 'Kosovo',
  LUX: 'Luxemburgo',
  MKD: 'Macedônia do Norte',
  MLT: 'Malta',
  MNE: 'Montenegro',
  NED: 'Holanda',
  HOL: 'Holanda',
  NIR: 'Irlanda do Norte',
  NOR: 'Noruega',
  POL: 'Polônia',
  POR: 'Portugal',
  ROU: 'Romênia',
  RUS: 'Rússia',
  SRB: 'Sérvia',
  SVK: 'Eslováquia',
  SVN: 'Eslovênia',
  SUI: 'Suíça',
  SWE: 'Suécia',
  SUE: 'Suécia',
  TUR: 'Turquia',
  UKR: 'Ucrânia',

  // África
  ANG: 'Angola',
  CAM: 'Camarões',
  CMR: 'Camarões',
  CIV: 'Costa do Marfim',
  EGY: 'Egito',
  ETH: 'Etiópia',
  GHA: 'Gana',
  GUI: 'Guiné',
  KEN: 'Quênia',
  LIB: 'Líbia',
  MAR: 'Marrocos',
  MOZ: 'Moçambique',
  NGA: 'Nigéria',
  RSA: 'África do Sul',
  SEN: 'Senegal',
  TUN: 'Tunísia',
  UGA: 'Uganda',
  ZIM: 'Zimbábue',

  // Ásia
  AUS: 'Austrália',
  CHN: 'China',
  IND: 'Índia',
  IDN: 'Indonésia',
  IRN: 'Irã',
  IRQ: 'Iraque',
  JPN: 'Japão',
  JOR: 'Jordânia',
  KOR: 'Coreia do Sul',
  KSA: 'Arábia Saudita',
  KUW: 'Kuwait',
  LIB2: 'Líbano',
  MAS: 'Malásia',
  OMA: 'Omã',
  PAK: 'Paquistão',
  PHI: 'Filipinas',
  QAT: 'Catar',
  SAU: 'Arábia Saudita',
  SYR: 'Síria',
  THA: 'Tailândia',
  UAE: 'Emirados Árabes',
  UZB: 'Uzbequistão',
  VIE: 'Vietnã',

  // Oceania
  NZL: 'Nova Zelândia',
  FIJ: 'Fiji',
  PNG: 'Papua Nova Guiné',
  SOL: 'Ilhas Salomão',
  TAH: 'Taiti',
  VAN: 'Vanuatu'
};

/**
 * Retorna o nome completo em português a partir da sigla ou do nome em inglês.
 * Se não encontrar tradução, retorna o nome original.
 */
export function getFullName(code, fallbackName) {
  if (!code && !fallbackName) return '';
  // Tenta pela sigla
  if (code && NAMES[code.toUpperCase()]) return NAMES[code.toUpperCase()];
  // Tenta pelo nome (inglês -> português via mapeamento reverso)
  if (fallbackName) {
    const eng = fallbackName.trim();
    // Busca direta no mapa por valor
    const found = Object.values(NAMES).find(
      v => v.toLowerCase() === eng.toLowerCase()
    );
    if (found) return found;
    // Mapeamentos extras de nomes em inglês comuns
    const ENG_MAP = {
      'Germany': 'Alemanha', 'Spain': 'Espanha', 'France': 'França',
      'England': 'Inglaterra', 'Italy': 'Itália', 'Netherlands': 'Holanda',
      'Portugal': 'Portugal', 'Brazil': 'Brasil', 'Argentina': 'Argentina',
      'Mexico': 'México', 'United States': 'Estados Unidos',
      'South Africa': 'África do Sul', 'Morocco': 'Marrocos',
      'Senegal': 'Senegal', 'Nigeria': 'Nigéria', 'Ghana': 'Gana',
      'Japan': 'Japão', 'South Korea': 'Coreia do Sul',
      'Australia': 'Austrália', 'Iran': 'Irã', 'Saudi Arabia': 'Arábia Saudita',
      'Croatia': 'Croácia', 'Serbia': 'Sérvia', 'Poland': 'Polônia',
      'Switzerland': 'Suíça', 'Denmark': 'Dinamarca', 'Belgium': 'Bélgica',
      'Uruguay': 'Uruguai', 'Colombia': 'Colômbia', 'Ecuador': 'Equador',
      'Peru': 'Peru', 'Chile': 'Chile', 'Paraguay': 'Paraguai',
      'Bolivia': 'Bolívia', 'Venezuela': 'Venezuela', 'Canada': 'Canadá',
      'Costa Rica': 'Costa Rica', 'Panama': 'Panamá', 'Jamaica': 'Jamaica',
      'Honduras': 'Honduras', 'El Salvador': 'El Salvador',
      'Tunisia': 'Tunísia', 'Cameroon': 'Camarões', 'Qatar': 'Catar',
      'Turkey': 'Turquia', 'Ukraine': 'Ucrânia', 'Russia': 'Rússia',
      'Romania': 'Romênia', 'Hungary': 'Hungria', 'Slovakia': 'Eslováquia',
      'Slovenia': 'Eslovênia', 'Austria': 'Áustria', 'Scotland': 'Escócia',
      'Wales': 'Gales', 'Ireland': 'Irlanda', 'Norway': 'Noruega',
      'Sweden': 'Suécia', 'Finland': 'Finlândia', 'Greece': 'Grécia',
      'Czech Republic': 'República Tcheca', 'Czechia': 'República Tcheca',
      'North Macedonia': 'Macedônia do Norte', 'Kosovo': 'Kosovo',
      'Montenegro': 'Montenegro', 'Albania': 'Albânia',
      'Bosnia and Herzegovina': 'Bósnia e Herzegovina',
      "Ivory Coast": 'Costa do Marfim', "Côte d'Ivoire": 'Costa do Marfim',
      'Egypt': 'Egito', 'Algeria': 'Argélia', 'Libya': 'Líbia',
      'Angola': 'Angola', 'Mozambique': 'Moçambique', 'Zimbabwe': 'Zimbábue',
      'Uganda': 'Uganda', 'Kenya': 'Quênia', 'Ethiopia': 'Etiópia',
      'China': 'China', 'India': 'Índia', 'Indonesia': 'Indonésia',
      'Iraq': 'Iraque', 'Jordan': 'Jordânia', 'Kuwait': 'Kuwait',
      'Malaysia': 'Malásia', 'Oman': 'Omã', 'Pakistan': 'Paquistão',
      'Philippines': 'Filipinas', 'Syria': 'Síria', 'Thailand': 'Tailândia',
      'United Arab Emirates': 'Emirados Árabes', 'Uzbekistan': 'Uzbequistão',
      'Vietnam': 'Vietnã', 'New Zealand': 'Nova Zelândia', 'Fiji': 'Fiji',
      'Tahiti': 'Taiti',
    };
    if (ENG_MAP[eng]) return ENG_MAP[eng];
  }
  return fallbackName || code || '';
}
