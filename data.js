// The Great War — 국가 / 팩션 / 지도 데이터 (1939년 9월 기준)

const FACTIONS = {
  axis:      { name: '추축국',  color: '#6b4a2b', leader: 'GER' },
  allies:    { name: '연합국',  color: '#2b5784', leader: 'GBR' },
  comintern: { name: '코민테른', color: '#8b2a2a', leader: 'USR' },
  neutral:   { name: '중립',    color: '#6c757d', leader: null  }
};

// 깃발 (간단한 SVG)
const FLAGS = {
  GER: '<svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg"><rect width="3" height="2" fill="#fff"/><rect width="3" height="2" fill="#c00" y=".67" height=".67"/><g transform="translate(1.5,1)"><circle r=".35" fill="#fff"/><path d="M-.25,-.25 L.25,.25 M.25,-.25 L-.25,.25 M-.3,0 L.3,0 M0,-.3 L0,.3" stroke="#000" stroke-width=".06"/></g></svg>',
  ITA: '<svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>',
  GBR: '<svg viewBox="0 0 60 30"><clipPath id="t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#t)" stroke="#C8102E" stroke-width="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></svg>',
  FRA: '<svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#002395"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ed2939"/></svg>',
  USR: '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#cc0000"/><text x="0.4" y="0.85" font-size="0.7" fill="#ffd700">★</text></svg>',
  POL: '<svg viewBox="0 0 3 2"><rect width="3" height="1" fill="#fff"/><rect width="3" height="1" y="1" fill="#dc143c"/></svg>',
  ESP: '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#aa151b"/><rect width="3" height="1" y=".5" fill="#f1bf00"/></svg>',
  PRT: '<svg viewBox="0 0 3 2"><rect width="1.2" height="2" fill="#006600"/><rect x="1.2" width="1.8" height="2" fill="#cc0000"/></svg>',
  IRE: '<svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#169b62"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ff883e"/></svg>',
  BEL: '<svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#000"/><rect x="1" width="1" height="2" fill="#fdda24"/><rect x="2" width="1" height="2" fill="#ef3340"/></svg>',
  NLD: '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><rect width="3" height=".67" fill="#ae1c28"/><rect width="3" height=".67" y="1.33" fill="#21468b"/></svg>',
  LUX: '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><rect width="3" height=".67" fill="#ed2939"/><rect width="3" height=".67" y="1.33" fill="#00a3e0"/></svg>',
  DNK: '<svg viewBox="0 0 12 9"><rect width="12" height="9" fill="#c8102e"/><rect x="4" width="2" height="9" fill="#fff"/><rect y="4" width="12" height="2" fill="#fff"/></svg>',
  NOR: '<svg viewBox="0 0 22 16"><rect width="22" height="16" fill="#ef2b2d"/><rect x="6" width="2" height="16" fill="#fff"/><rect y="7" width="22" height="2" fill="#fff"/><rect x="6.5" width="1" height="16" fill="#002868"/><rect y="7.5" width="22" height="1" fill="#002868"/></svg>',
  SWE: '<svg viewBox="0 0 16 10"><rect width="16" height="10" fill="#006aa7"/><rect x="5" width="2" height="10" fill="#fecc02"/><rect y="4" width="16" height="2" fill="#fecc02"/></svg>',
  FIN: '<svg viewBox="0 0 18 11"><rect width="18" height="11" fill="#fff"/><rect x="5" width="3" height="11" fill="#003580"/><rect y="4" width="18" height="3" fill="#003580"/></svg>',
  SWI: '<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#d52b1e"/><rect x="13" y="6" width="6" height="20" fill="#fff"/><rect x="6" y="13" width="20" height="6" fill="#fff"/></svg>',
  AUT: '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><rect width="3" height=".67" fill="#ed2939"/><rect width="3" height=".67" y="1.33" fill="#ed2939"/></svg>',
  CZE: '<svg viewBox="0 0 3 2"><rect width="3" height="1" fill="#fff"/><rect width="3" height="1" y="1" fill="#d7141a"/><path d="M0,0 L1.2,1 L0,2 Z" fill="#11457e"/></svg>',
  HUN: '<svg viewBox="0 0 3 2"><rect width="3" height=".67" fill="#ce2939"/><rect width="3" height=".67" y=".67" fill="#fff"/><rect width="3" height=".67" y="1.33" fill="#477050"/></svg>',
  ROM: '<svg viewBox="0 0 3 2"><rect width="1" height="2" fill="#002b7f"/><rect x="1" width="1" height="2" fill="#fcd116"/><rect x="2" width="1" height="2" fill="#ce1126"/></svg>',
  YUG: '<svg viewBox="0 0 3 2"><rect width="3" height=".67" fill="#3c3b6e"/><rect width="3" height=".67" y=".67" fill="#fff"/><rect width="3" height=".67" y="1.33" fill="#dc143c"/></svg>',
  BUL: '<svg viewBox="0 0 3 2"><rect width="3" height=".67" fill="#fff"/><rect width="3" height=".67" y=".67" fill="#00966e"/><rect width="3" height=".67" y="1.33" fill="#d62612"/></svg>',
  GRC: '<svg viewBox="0 0 27 18"><rect width="27" height="18" fill="#0d5eaf"/><rect y="2" width="27" height="2" fill="#fff"/><rect y="6" width="27" height="2" fill="#fff"/><rect y="10" width="27" height="2" fill="#fff"/><rect y="14" width="27" height="2" fill="#fff"/><rect width="10" height="10" fill="#0d5eaf"/><rect x="4" width="2" height="10" fill="#fff"/><rect y="4" width="10" height="2" fill="#fff"/></svg>',
  ALB: '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#c8102e"/><text x="1.5" y="1.4" font-size="0.9" text-anchor="middle" fill="#000">✪</text></svg>',
  TUR: '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#e30a17"/><text x="1.5" y="1.3" font-size="0.8" text-anchor="middle" fill="#fff">☪</text></svg>',
  LTU: '<svg viewBox="0 0 3 2"><rect width="3" height=".67" fill="#fdb913"/><rect width="3" height=".67" y=".67" fill="#006a44"/><rect width="3" height=".67" y="1.33" fill="#c1272d"/></svg>'
};

// 국가 정의 — SVG polygon 좌표 + 게임 통계
const COUNTRIES = {
  // === 추축국 ===
  GER: {
    name: '독일', shortName: 'GER',
    poly: '420,200 480,205 510,235 510,275 495,310 470,320 440,310 415,295 405,265 410,225',
    cx: 458, cy: 265,
    faction: 'axis',
    manpower: 80, civFactories: 18, milFactories: 24, army: 100,
    neighbors: ['POL','CZE','AUT','SWI','FRA','LUX','BEL','NLD','DNK'],
    ai: { aggression: 0.9, target: ['POL','FRA','BEL','NLD','LUX','DNK','NOR','USR','YUG','GRC'] }
  },
  ITA: {
    name: '이탈리아', shortName: 'ITA',
    poly: '440,360 480,365 500,400 520,445 510,485 490,510 470,495 460,455 450,420 440,390',
    cx: 478, cy: 430,
    faction: 'neutral', wantsFaction: 'axis',
    manpower: 40, civFactories: 12, milFactories: 14, army: 60,
    neighbors: ['FRA','SWI','AUT','YUG','ALB','GRC'],
    ai: { aggression: 0.7, target: ['ALB','GRC','YUG','FRA'] }
  },
  HUN: {
    name: '헝가리', shortName: 'HUN',
    poly: '555,335 600,335 605,360 580,375 555,365',
    cx: 580, cy: 355,
    faction: 'neutral', wantsFaction: 'axis',
    manpower: 18, civFactories: 5, milFactories: 5, army: 15,
    neighbors: ['AUT','CZE','ROM','YUG'],
    ai: { aggression: 0.4, target: ['YUG','ROM'] }
  },
  ROM: {
    name: '루마니아', shortName: 'ROM',
    poly: '605,335 670,335 680,365 655,385 620,380 600,360',
    cx: 635, cy: 360,
    faction: 'neutral',
    manpower: 25, civFactories: 5, milFactories: 4, army: 18,
    neighbors: ['HUN','YUG','BUL','USR'],
    ai: { aggression: 0.3, target: [] }
  },
  BUL: {
    name: '불가리아', shortName: 'BUL',
    poly: '620,395 670,395 680,425 645,435 620,420',
    cx: 645, cy: 415,
    faction: 'neutral',
    manpower: 15, civFactories: 3, milFactories: 3, army: 12,
    neighbors: ['ROM','YUG','GRC','TUR'],
    ai: { aggression: 0.3, target: [] }
  },

  // === 연합국 ===
  GBR: {
    name: '영국', shortName: 'GBR',
    poly: '210,150 260,170 270,210 270,255 230,275 200,260 190,220 195,180',
    cx: 230, cy: 215,
    faction: 'allies',
    manpower: 50, civFactories: 22, milFactories: 14, army: 50,
    neighbors: ['FRA','IRE','NLD','NOR'],
    ai: { aggression: 0.6, target: ['GER','ITA'] }
  },
  FRA: {
    name: '프랑스', shortName: 'FRA',
    poly: '295,290 360,290 380,325 385,375 360,395 320,400 290,380 280,330',
    cx: 325, cy: 345,
    faction: 'allies',
    manpower: 42, civFactories: 16, milFactories: 14, army: 70,
    neighbors: ['GBR','BEL','LUX','GER','SWI','ITA','ESP'],
    ai: { aggression: 0.5, target: ['GER','ITA'] }
  },
  POL: {
    name: '폴란드', shortName: 'POL',
    poly: '530,215 600,220 610,255 590,285 550,290 525,265',
    cx: 565, cy: 255,
    faction: 'allies',
    manpower: 35, civFactories: 7, milFactories: 7, army: 40,
    neighbors: ['GER','CZE','USR','LTU'],
    ai: { aggression: 0.3, target: [] }
  },
  IRE: {
    name: '아일랜드', shortName: 'IRE',
    poly: '120,225 175,225 180,265 130,270 115,250',
    cx: 145, cy: 245,
    faction: 'neutral',
    manpower: 8, civFactories: 2, milFactories: 1, army: 5,
    neighbors: ['GBR'],
    ai: { aggression: 0.1, target: [] }
  },
  BEL: {
    name: '벨기에', shortName: 'BEL',
    poly: '355,275 395,275 400,295 380,305 360,295',
    cx: 378, cy: 290,
    faction: 'neutral', wantsFaction: 'allies',
    manpower: 10, civFactories: 4, milFactories: 2, army: 12,
    neighbors: ['NLD','GER','FRA','LUX'],
    ai: { aggression: 0.1, target: [] }
  },
  NLD: {
    name: '네덜란드', shortName: 'NLD',
    poly: '370,240 410,240 415,265 390,275 370,265',
    cx: 390, cy: 257,
    faction: 'neutral', wantsFaction: 'allies',
    manpower: 12, civFactories: 5, milFactories: 2, army: 10,
    neighbors: ['GER','BEL','GBR'],
    ai: { aggression: 0.1, target: [] }
  },
  LUX: {
    name: '룩셈부르크', shortName: 'LUX',
    poly: '395,295 410,295 412,308 397,308',
    cx: 403, cy: 302,
    faction: 'neutral',
    manpower: 1, civFactories: 1, milFactories: 1, army: 1,
    neighbors: ['BEL','GER','FRA'],
    ai: { aggression: 0, target: [] }
  },

  // === 코민테른 ===
  USR: {
    name: '소비에트 연방', shortName: 'USR',
    poly: '690,140 950,140 950,400 850,420 770,410 720,380 700,300 685,220',
    cx: 815, cy: 270,
    faction: 'comintern',
    manpower: 170, civFactories: 28, milFactories: 32, army: 130,
    neighbors: ['FIN','LTU','POL','ROM','TUR'],
    ai: { aggression: 0.6, target: ['POL','FIN','LTU','ROM'] }
  },

  // === 중립 ===
  ESP: {
    name: '스페인', shortName: 'ESP',
    poly: '180,400 280,400 290,460 250,490 200,485 165,445',
    cx: 225, cy: 445,
    faction: 'neutral',
    manpower: 30, civFactories: 7, milFactories: 5, army: 25,
    neighbors: ['FRA','PRT'],
    ai: { aggression: 0.1, target: [] }
  },
  PRT: {
    name: '포르투갈', shortName: 'PRT',
    poly: '135,425 175,425 180,475 145,485 125,460',
    cx: 152, cy: 455,
    faction: 'neutral',
    manpower: 8, civFactories: 2, milFactories: 1, army: 6,
    neighbors: ['ESP'],
    ai: { aggression: 0, target: [] }
  },
  SWI: {
    name: '스위스', shortName: 'SWI',
    poly: '405,335 445,335 450,355 425,365 405,355',
    cx: 425, cy: 348,
    faction: 'neutral',
    manpower: 6, civFactories: 3, milFactories: 2, army: 10,
    neighbors: ['FRA','GER','AUT','ITA'],
    ai: { aggression: 0, target: [] }
  },
  AUT: {
    name: '오스트리아', shortName: 'AUT',
    poly: '485,315 555,315 555,340 510,345 485,335',
    cx: 520, cy: 330,
    faction: 'axis', annexed: 'GER',
    manpower: 12, civFactories: 4, milFactories: 4, army: 8,
    neighbors: ['GER','CZE','HUN','ITA','SWI','YUG'],
    ai: { aggression: 0, target: [] }
  },
  CZE: {
    name: '체코슬로바키아', shortName: 'CZE',
    poly: '500,275 565,275 570,305 530,315 500,305',
    cx: 532, cy: 295,
    faction: 'axis', annexed: 'GER',
    manpower: 14, civFactories: 6, milFactories: 6, army: 5,
    neighbors: ['GER','POL','HUN','AUT'],
    ai: { aggression: 0, target: [] }
  },
  DNK: {
    name: '덴마크', shortName: 'DNK',
    poly: '430,170 475,170 478,200 445,205 425,195',
    cx: 452, cy: 188,
    faction: 'neutral',
    manpower: 7, civFactories: 3, milFactories: 1, army: 8,
    neighbors: ['GER','NOR','SWE'],
    ai: { aggression: 0, target: [] }
  },
  NOR: {
    name: '노르웨이', shortName: 'NOR',
    poly: '460,60 520,60 530,120 510,170 470,170 455,120',
    cx: 488, cy: 115,
    faction: 'neutral',
    manpower: 9, civFactories: 3, milFactories: 2, army: 12,
    neighbors: ['SWE','FIN','DNK','GBR'],
    ai: { aggression: 0, target: [] }
  },
  SWE: {
    name: '스웨덴', shortName: 'SWE',
    poly: '535,70 595,70 605,135 580,170 545,155 530,110',
    cx: 568, cy: 115,
    faction: 'neutral',
    manpower: 12, civFactories: 5, milFactories: 3, army: 15,
    neighbors: ['NOR','FIN','DNK'],
    ai: { aggression: 0, target: [] }
  },
  FIN: {
    name: '핀란드', shortName: 'FIN',
    poly: '620,55 700,55 700,140 660,160 625,140 610,100',
    cx: 660, cy: 105,
    faction: 'neutral',
    manpower: 15, civFactories: 3, milFactories: 2, army: 18,
    neighbors: ['NOR','SWE','USR'],
    ai: { aggression: 0.3, target: ['USR'] }
  },
  YUG: {
    name: '유고슬라비아', shortName: 'YUG',
    poly: '510,360 605,360 605,395 575,420 530,415 505,390',
    cx: 555, cy: 390,
    faction: 'neutral',
    manpower: 20, civFactories: 4, milFactories: 4, army: 22,
    neighbors: ['ITA','AUT','HUN','ROM','BUL','ALB','GRC'],
    ai: { aggression: 0.2, target: [] }
  },
  GRC: {
    name: '그리스', shortName: 'GRC',
    poly: '565,440 625,440 635,475 600,495 565,485 555,460',
    cx: 595, cy: 465,
    faction: 'neutral',
    manpower: 14, civFactories: 3, milFactories: 2, army: 14,
    neighbors: ['YUG','BUL','ALB','TUR'],
    ai: { aggression: 0.1, target: [] }
  },
  ALB: {
    name: '알바니아', shortName: 'ALB',
    poly: '540,425 570,425 572,455 545,460 535,440',
    cx: 552, cy: 442,
    faction: 'neutral',
    manpower: 3, civFactories: 1, milFactories: 1, army: 3,
    neighbors: ['YUG','GRC','ITA'],
    ai: { aggression: 0, target: [] }
  },
  TUR: {
    name: '터키', shortName: 'TUR',
    poly: '690,440 800,435 830,460 815,495 770,500 720,485 695,465',
    cx: 760, cy: 465,
    faction: 'neutral',
    manpower: 40, civFactories: 6, milFactories: 4, army: 35,
    neighbors: ['BUL','GRC','USR'],
    ai: { aggression: 0, target: [] }
  },
  LTU: {
    name: '리투아니아', shortName: 'LTU',
    poly: '625,205 680,200 685,230 650,240 625,230',
    cx: 655, cy: 220,
    faction: 'neutral',
    manpower: 5, civFactories: 1, milFactories: 1, army: 4,
    neighbors: ['USR','POL'],
    ai: { aggression: 0, target: [] }
  }
};

// 시작시 이미 진행 중인 전쟁
const INITIAL_WARS = [
  ['GER','POL'],
  ['GER','FRA'],
  ['GER','GBR']
];

// 플레이어 선택지
const PLAYABLE = ['GER','GBR','FRA','ITA','USR','POL'];

const PLAYABLE_DESC = {
  GER: { faction: '추축국 (지도국)', desc: '강력한 군대와 산업력. 폴란드를 침공한 직후. 유럽 정복을 노리시오.' },
  GBR: { faction: '연합국 (지도국)', desc: '해군 강국. 산업력 우수하나 본토 병력은 적음. 식민지를 동원하라.' },
  FRA: { faction: '연합국', desc: '대규모 육군. 마지노 선의 그늘에서 독일의 침공을 막아야 한다.' },
  ITA: { faction: '중립 → 추축', desc: '지중해의 패권을 노리는 무솔리니. 적절한 시점에 전쟁 참여.' },
  USR: { faction: '코민테른', desc: '거대한 인력과 산업. 동유럽을 휩쓸고 베를린까지 진군하라.' },
  POL: { faction: '연합국 (위기)', desc: '독일과 소련 사이에 끼인 약소국. 생존이 곧 승리다.' }
};
