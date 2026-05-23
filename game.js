// The Great War — 게임 로직 v2
// 유닛/기술/훈련/이동/멀티/오디오 추가

// ================= 전역 상태 =================
const State = {
  year: 1939,
  month: 9,
  turn: 0,
  countries: {},
  log: [],
  gameOver: false,

  // 멀티
  players: [],         // [{cc, name}]
  currentPlayerIdx: 0, // 현재 차례 인덱스
  isMulti: false,

  // 선택 / 모드
  selectedCC: null,
  mode: null,          // null | 'move' | 'attack' — 이동/공격 모드
  modeFromCC: null,    // 모드의 출발지
};

// ================= 오디오 =================
const Audio = {
  ctx: null,
  enabled: true,
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e) { this.enabled = false; }
  },
  play(type) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const c = this.ctx;
    const now = c.currentTime;
    switch (type) {
      case 'click': this._beep(880, 0.05, 0.04, now); break;
      case 'select': this._beep(660, 0.06, 0.03, now); break;
      case 'build': this._beep(440, 0.15, 0.06, now); this._beep(660, 0.1, 0.05, now+0.08); break;
      case 'tech': this._beep(523, 0.1, 0.05, now); this._beep(659, 0.1, 0.05, now+0.1); this._beep(784, 0.15, 0.06, now+0.2); break;
      case 'war': this._beep(220, 0.3, 0.12, now, 'sawtooth'); this._noise(0.2, 0.08, now+0.1); break;
      case 'attack': this._boom(now); break;
      case 'victory': this._victory(now); break;
      case 'defeat':  this._defeat(now); break;
      case 'alert': this._beep(880, 0.06, 0.05, now); this._beep(880, 0.06, 0.05, now+0.12); break;
    }
  },
  _beep(freq, dur, vol, t, wave='sine') {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    osc.connect(g); g.connect(this.ctx.destination);
    osc.start(t); osc.stop(t+dur+0.02);
  },
  _noise(dur, vol, t) {
    const bufSize = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<bufSize;i++) d[i] = (Math.random()*2-1) * (1 - i/bufSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  },
  _boom(t) {
    this._beep(80, 0.3, 0.15, t, 'sawtooth');
    this._noise(0.25, 0.12, t);
    this._beep(150, 0.2, 0.08, t+0.05, 'square');
  },
  _victory(t) {
    [523, 659, 784, 1047].forEach((f,i) => this._beep(f, 0.18, 0.08, t+i*0.12));
  },
  _defeat(t) {
    [440, 370, 311, 247].forEach((f,i) => this._beep(f, 0.22, 0.09, t+i*0.15, 'triangle'));
  }
};

// ================= 초기화 =================
function initGame() {
  // 깊은 복사
  State.countries = JSON.parse(JSON.stringify(COUNTRIES));

  for (const cc in State.countries) {
    const c = State.countries[cc];
    c.cc = cc;
    c.owner = cc;
    c.wars = [];
    c.allies = [];
    c.naps = [];          // 불가침
    c.justified = [];     // 명분 만든 대상
    c.justifying = [];    // [{target, progress}] 명분 만드는 중
    c.cp = 0;
    c.eq = 0;             // 장비 비축
    c.rp = 0;             // 연구점수 비축
    c.constructions = [];
    c.researched = [];
    c.currentResearch = null;
    c.researchProgress = 0;
    c.prodMix = { inf: 50, tank: 30, air: 20 };
    if (!c.garrison) c.garrison = mkGarr(0,0,0);
  }

  // 진영 시작 기술
  for (const cc in NATION_BIAS) {
    const bias = NATION_BIAS[cc];
    if (State.countries[cc]) {
      State.countries[cc].researched = [...(bias.startTech||[]), bias.doc].filter(Boolean);
    }
  }

  // 합병 처리
  for (const cc in State.countries) {
    const c = State.countries[cc];
    if (c.annexed) {
      const owner = State.countries[c.annexed];
      owner.manpower += c.manpower;
      owner.civFactories += c.civFactories;
      owner.milFactories += c.milFactories;
      owner.garrison.inf += c.garrison.inf;
      owner.garrison.tank += c.garrison.tank;
      owner.garrison.air += c.garrison.air;
      c.owner = c.annexed;
      c.manpower = 0; c.civFactories = 0; c.milFactories = 0;
      c.garrison = mkGarr(0,0,0);
      c.fallen = true;   // 이미 멸망 처리됨
    }
  }

  // 초기 전쟁
  for (const [a,b] of INITIAL_WARS) declareWar(a, b, true);
}

function currentPlayer() {
  if (!State.players.length) return null;
  return State.players[State.currentPlayerIdx];
}

function currentPlayerCC() {
  const p = currentPlayer();
  return p ? p.cc : null;
}

function isHumanCountry(cc) {
  return State.players.some(p => p.cc === cc);
}

// ================= 시작 화면 =================
let pendingMode = null;
let pendingPlayerCount = 1;
let pendingPlayers = []; // [{cc}]

function setupStartScreen() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = () => {
      Audio.play('click');
      pendingMode = btn.dataset.mode;
      pendingPlayers = [];
      document.getElementById('mode-select').classList.add('hidden');
      document.getElementById('how-to').classList.add('hidden');
      document.getElementById('back-btn-wrap').classList.remove('hidden');
      if (pendingMode === 'single') {
        pendingPlayerCount = 1;
        showNationSelect();
      } else {
        document.getElementById('player-count-select').classList.remove('hidden');
      }
    };
  });

  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.onclick = () => {
      Audio.play('click');
      pendingPlayerCount = parseInt(btn.dataset.n);
      document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('player-count-select').classList.add('hidden');
      showNationSelect();
    };
  });

  document.getElementById('back-btn').onclick = () => {
    Audio.play('click');
    resetStartScreen();
  };
}

function resetStartScreen() {
  pendingMode = null;
  pendingPlayers = [];
  document.getElementById('mode-select').classList.remove('hidden');
  document.getElementById('player-count-select').classList.add('hidden');
  document.getElementById('nation-select-wrap').classList.add('hidden');
  document.getElementById('back-btn-wrap').classList.add('hidden');
  document.getElementById('how-to').classList.remove('hidden');
  document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('selected'));
}

function showNationSelect() {
  const wrap = document.getElementById('nation-select-wrap');
  wrap.classList.remove('hidden');
  const sel = document.getElementById('nation-select');
  const title = document.getElementById('ns-title');
  const playerNum = pendingPlayers.length + 1;
  title.textContent = pendingPlayerCount > 1
    ? `플레이어 ${playerNum} / ${pendingPlayerCount}: 국가 선택`
    : '국가를 선택하세요';

  sel.innerHTML = '';
  for (const cc of PLAYABLE) {
    const c = COUNTRIES[cc];
    const d = PLAYABLE_DESC[cc];
    const taken = pendingPlayers.some(p => p.cc === cc);
    const card = document.createElement('div');
    card.className = 'nation-card' + (taken ? ' taken' : '');
    card.innerHTML = `
      <div>
        <span class="flag">${FLAGS[cc]||''}</span>
        <span class="nname">${c.name}</span>
      </div>
      <div class="nfaction">${d.faction}</div>
      <div class="ndesc">${d.desc}</div>
      <div class="nstats">
        <span>인력 ${c.manpower}</span>
        <span>병력 ${c.garrison.inf + c.garrison.tank + c.garrison.air}</span>
        <span>공장 ${c.civFactories + c.milFactories}</span>
      </div>
    `;
    if (!taken) {
      card.onclick = () => {
        Audio.play('select');
        pendingPlayers.push({ cc, name: `플레이어 ${pendingPlayers.length+1}` });
        if (pendingPlayers.length >= pendingPlayerCount) {
          startGame(pendingPlayers);
        } else {
          showNationSelect();
        }
      };
    }
    sel.appendChild(card);
  }
}

function startGame(players) {
  State.players = players;
  State.currentPlayerIdx = 0;
  State.isMulti = players.length > 1;
  initGame();

  document.getElementById('start-screen').classList.add('hidden');

  if (State.isMulti) {
    showHandoff();
  } else {
    enterGameScreen();
  }
}

function showHandoff() {
  const p = currentPlayer();
  document.getElementById('handoff-flag').innerHTML = FLAGS[p.cc] || '';
  document.getElementById('handoff-name').textContent = `${p.name} — ${State.countries[p.cc].name}`;
  document.getElementById('handoff-screen').classList.remove('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('handoff-go').onclick = () => {
    Audio.play('click');
    document.getElementById('handoff-screen').classList.add('hidden');
    enterGameScreen();
  };
}

function enterGameScreen() {
  document.getElementById('game-screen').classList.remove('hidden');
  updatePlayerTag();
  renderMap();
  selectCountry(currentPlayerCC());
  updateTopBar();
  if (State.turn === 0) {
    pushLog(`전쟁이 시작되었다.`, 'important');
    Audio.play('alert');
  }
}

function updatePlayerTag() {
  const p = currentPlayer();
  if (!p) return;
  const tag = document.getElementById('player-tag');
  tag.innerHTML = `<span class="mini-flag">${FLAGS[p.cc]||''}</span> ${p.name}: <b>${State.countries[p.cc].name}</b>`;
}

// ================= 지도 =================
function factionColor(faction) {
  return FACTIONS[faction]?.color || '#666';
}

function ownerColor(cc) {
  const c = State.countries[cc];
  const owner = State.countries[c.owner];
  if (c.owner === currentPlayerCC()) return '#f0c060';
  return factionColor(owner.faction);
}

function renderMap() {
  const adjG = document.getElementById('adjacency-lines');
  const warG = document.getElementById('war-indicators');
  const cntG = document.getElementById('countries');
  const lblG = document.getElementById('labels');
  adjG.innerHTML = ''; warG.innerHTML = ''; cntG.innerHTML = ''; lblG.innerHTML = '';

  // 인접선
  const drawnPairs = new Set();
  for (const cc in State.countries) {
    const c = State.countries[cc];
    for (const n of c.neighbors) {
      const key = [cc,n].sort().join('-');
      if (drawnPairs.has(key)) continue;
      drawnPairs.add(key);
      const nb = State.countries[n];
      if (!nb) continue;
      const l = document.createElementNS('http://www.w3.org/2000/svg','line');
      l.setAttribute('x1', c.cx); l.setAttribute('y1', c.cy);
      l.setAttribute('x2', nb.cx); l.setAttribute('y2', nb.cy);
      l.setAttribute('class','adj-line');
      adjG.appendChild(l);
    }
  }

  // 전쟁선
  const warPairs = new Set();
  for (const cc in State.countries) {
    const c = State.countries[cc];
    for (const w of c.wars) {
      const key = [cc,w].sort().join('-');
      if (warPairs.has(key)) continue;
      warPairs.add(key);
      const enemy = State.countries[w];
      if (!enemy) continue;
      const l = document.createElementNS('http://www.w3.org/2000/svg','line');
      l.setAttribute('x1', c.cx); l.setAttribute('y1', c.cy);
      l.setAttribute('x2', enemy.cx); l.setAttribute('y2', enemy.cy);
      l.setAttribute('class','war-line');
      warG.appendChild(l);
    }
  }

  // 국가
  for (const cc in State.countries) {
    const c = State.countries[cc];
    const poly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
    poly.setAttribute('points', c.poly);
    poly.setAttribute('fill', ownerColor(cc));
    poly.setAttribute('class','country-shape');
    poly.setAttribute('data-cc', cc);
    poly.onclick = () => onCountryClick(cc);
    cntG.appendChild(poly);

    // 라벨
    const t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x', c.cx); t.setAttribute('y', c.cy - 6);
    t.setAttribute('class','country-label');
    t.textContent = c.shortName;
    lblG.appendChild(t);

    // 병력
    const total = c.garrison.inf + c.garrison.tank + c.garrison.air;
    const a = document.createElementNS('http://www.w3.org/2000/svg','text');
    a.setAttribute('x', c.cx); a.setAttribute('y', c.cy + 12);
    a.setAttribute('class','country-army');
    a.textContent = total > 0 ? `⚔ ${total}` : '';
    lblG.appendChild(a);
  }

  refreshSelection();
}

function refreshSelection() {
  document.querySelectorAll('.country-shape').forEach(el => {
    el.classList.remove('selected','attack-target','move-target','dim');
  });
  if (State.selectedCC) {
    const sel = document.querySelector(`.country-shape[data-cc="${State.selectedCC}"]`);
    if (sel) sel.classList.add('selected');
  }

  // 모드 표시: 출발지에서 갈 수 있는 곳 하이라이트
  if (State.mode && State.modeFromCC) {
    const from = State.countries[State.modeFromCC];
    const playerCC = currentPlayerCC();
    document.querySelectorAll('.country-shape').forEach(el => el.classList.add('dim'));
    document.querySelector(`.country-shape[data-cc="${State.modeFromCC}"]`).classList.remove('dim');

    for (const n of from.neighbors) {
      const nb = State.countries[n];
      if (!nb) continue;
      const el = document.querySelector(`.country-shape[data-cc="${n}"]`);
      if (!el) continue;
      if (State.mode === 'move' && nb.owner === playerCC) {
        el.classList.remove('dim');
        el.classList.add('move-target');
      } else if (State.mode === 'attack' && State.countries[playerCC].wars.includes(nb.owner)) {
        el.classList.remove('dim');
        el.classList.add('attack-target');
      }
    }
  }
}

function showModeIndicator(text, kind='attack') {
  const el = document.getElementById('mode-indicator');
  el.classList.remove('hidden','move');
  if (kind === 'move') el.classList.add('move');
  el.innerHTML = `<span>${text}</span><button id="cancel-mode">취소 (Esc)</button>`;
  document.getElementById('cancel-mode').onclick = cancelMode;
}

function hideModeIndicator() {
  document.getElementById('mode-indicator').classList.add('hidden');
}

function cancelMode() {
  State.mode = null;
  State.modeFromCC = null;
  hideModeIndicator();
  refreshSelection();
}

// ================= 사이드바 =================
function selectCountry(cc) {
  Audio.play('select');
  State.selectedCC = cc;
  const c = State.countries[cc];
  const owner = State.countries[c.owner];

  document.getElementById('cp-name').textContent =
    c.owner === cc ? c.name : `${c.name} (${owner.name} 점령)`;

  document.getElementById('cp-flag-line').innerHTML = `
    <span class="flag">${FLAGS[c.owner] || FLAGS[cc] || ''}</span>
    <span>소속: <b style="color:${factionColor(owner.faction)}">${FACTIONS[owner.faction].name}</b></span>
  `;

  const isOccupied = c.owner !== cc;
  const eff = isOccupied ? 0.4 : 1.0;
  document.getElementById('cp-stats').innerHTML = `
    <div class="stat"><span class="stat-label">인력</span><span class="stat-val">${Math.round(c.manpower*eff)}K</span></div>
    <div class="stat"><span class="stat-label">민간</span><span class="stat-val">${Math.round(c.civFactories*eff)}</span></div>
    <div class="stat"><span class="stat-label">군수</span><span class="stat-val">${Math.round(c.milFactories*eff)}</span></div>
    <div class="stat"><span class="stat-label">총 병력</span><span class="stat-val">${c.garrison.inf+c.garrison.tank+c.garrison.air}</span></div>
  `;

  // 주둔군 카드
  const expLv = getExpLevel(c.garrison.exp);
  document.getElementById('cp-garrison').innerHTML = `
    <div class="garr-card">
      <div class="garr-row">
        <div class="garr-unit"><div class="gu-icon">${UNIT_STATS.inf.icon}</div><div class="gu-count">${c.garrison.inf}</div><div class="gu-label">보병</div></div>
        <div class="garr-unit"><div class="gu-icon">${UNIT_STATS.tank.icon}</div><div class="gu-count">${c.garrison.tank}</div><div class="gu-label">전차</div></div>
        <div class="garr-unit"><div class="gu-icon">${UNIT_STATS.air.icon}</div><div class="gu-count">${c.garrison.air}</div><div class="gu-label">항공</div></div>
      </div>
      <div class="garr-exp" style="background:${expLv.color};color:#fff">★ ${expLv.name} (${Math.round(c.garrison.exp)} XP)</div>
    </div>
  `;

  // 외교
  let html = '';
  if (owner.wars.length) html += '<div>전쟁중: ' + owner.wars.map(w => `<span class="rel-tag rel-war">${State.countries[w].name}</span>`).join('') + '</div>';
  if (owner.allies.length) html += '<div>동맹: ' + owner.allies.map(a => `<span class="rel-tag rel-ally">${State.countries[a].name}</span>`).join('') + '</div>';
  if (owner.naps && owner.naps.length) html += '<div>불가침: ' + owner.naps.map(a => `<span class="rel-tag rel-nap">${State.countries[a].name}</span>`).join('') + '</div>';
  if (owner.justifying && owner.justifying.length) {
    html += '<div>명분 작업중: ' + owner.justifying.map(j =>
      `<span class="rel-tag rel-justifying">${State.countries[j.target].name} (${Math.round(j.progress)}%)</span>`
    ).join('') + '</div>';
  }
  if (c.constructions && c.constructions.length) {
    html += '<div style="margin-top:6px;color:var(--accent-bright)">건설중: ' +
      c.constructions.map(x => `${x.type==='civ'?'민간':'군수'}공장(${x.remaining}개월)`).join(', ') + '</div>';
  }
  document.getElementById('cp-relations').innerHTML = html;

  renderActions(cc);
  refreshSelection();
}

function renderActions(cc) {
  const div = document.getElementById('actions');
  div.innerHTML = '';
  const target = State.countries[cc];
  const playerCC = currentPlayerCC();
  const player = State.countries[playerCC];

  // 자국 영토
  if (target.owner === playerCC) {
    addAction(div, `🏭 민간공장 건설`, `CP ${COSTS.civ}`, player.cp >= COSTS.civ,
      () => buildFactory(cc, 'civ'));
    addAction(div, `⚙️ 군수공장 건설`, `CP ${COSTS.mil}`, player.cp >= COSTS.mil,
      () => buildFactory(cc, 'mil'));

    divider(div, '병력');
    addAction(div, `👥 보병 +5`, `인력 5`, player.manpower >= 5,
      () => recruitDirect(cc, 'inf', 5));
    addAction(div, `🛡 전차 +2`, `인력 4 · 장비 10`, player.manpower >= 4 && player.eq >= 10,
      () => recruitDirect(cc, 'tank', 2));
    addAction(div, `✈ 항공 +2`, `인력 2 · 장비 8`, player.manpower >= 2 && player.eq >= 8,
      () => recruitDirect(cc, 'air', 2));
    addAction(div, `🎖 부대 훈련 (+30 XP)`, `CP 40`, player.cp >= 40,
      () => trainGarrison(cc));

    divider(div, '군사');
    const hasArmy = target.garrison.inf + target.garrison.tank + target.garrison.air > 0;
    addAction(div, `↔ 부대 이동`, '', hasArmy,
      () => beginMode('move', cc), 'success');
    addAction(div, `⚔ 공격 명령`, '', hasArmy,
      () => beginMode('attack', cc), 'danger');
    return;
  }

  // 외국
  const isAtWar = player.wars.includes(target.owner);
  const sameFaction = target.faction === player.faction && player.faction !== 'neutral';
  const isAllied = player.allies.includes(target.owner);
  const isNAP = (player.naps||[]).includes(target.owner);
  const isJustified = (player.justified||[]).includes(target.owner);
  const isJustifying = (player.justifying||[]).some(j => j.target === target.owner);

  if (!isAtWar) {
    if (sameFaction || isAllied) {
      addAction(div, '🤝 동맹국', '', false, ()=>{}, 'success');
    } else if (isJustified) {
      addAction(div, '⚔️ 선전포고 (명분 확보)', '', true, () => {
        declareWar(playerCC, target.owner);
        player.justified = player.justified.filter(x => x !== target.owner);
        selectCountry(cc);
      }, 'danger');
    } else if (isJustifying) {
      addAction(div, '⏳ 명분 작업중...', '', false, ()=>{});
    } else if (isNAP) {
      addAction(div, '🚫 불가침 조약 (위반시 6개월 명분 필요)', '', false, ()=>{});
      addAction(div, '⚖️ 명분 만들기 (조약 파기)', '6개월 소요', true, () => {
        startJustification(playerCC, target.owner);
        selectCountry(cc);
      });
    } else {
      addAction(div, '⚖️ 명분 만들기', '6개월 소요', true, () => {
        startJustification(playerCC, target.owner);
        selectCountry(cc);
      });
      addAction(div, '⚔️ 즉시 선전포고 (명분 없음)', '안정도 -', true, () => {
        if (confirm(`명분 없이 ${target.name}에 선전포고합니다. 계속하시겠습니까?`)) {
          declareWar(playerCC, target.owner);
          selectCountry(cc);
        }
      }, 'danger');
    }

    if (!sameFaction && !isAllied && target.faction === 'neutral') {
      addAction(div, '🤝 동맹 제안', '', true, () => {
        const ok = Math.random() < 0.45;
        if (ok) {
          formAlliance(playerCC, target.owner);
          modal('동맹 체결', `${target.name}이(가) 동맹 제안을 수락했다!`);
        } else {
          pushLog(`${target.name}이(가) 동맹 제안을 거절했다.`, 'important');
          modal('거절됨', `${target.name}이(가) 동맹 제안을 거절했다.`);
        }
        selectCountry(cc);
      });
    }

    if (!sameFaction && !isAllied && !isNAP) {
      addAction(div, '📜 불가침 조약 제안', '', true, () => {
        const ok = Math.random() < 0.7;
        if (ok) {
          signNAP(playerCC, target.owner);
          modal('조약 체결', `${target.name}와(과) 불가침 조약을 맺었다.`);
        } else {
          modal('거절됨', `${target.name}이(가) 불가침 조약 제안을 거절했다.`);
        }
        selectCountry(cc);
      });
    }
  } else {
    if (isPlayerAdjacent(target.cc)) {
      // 가장 병력 많은 인접 자국 찾기
      let bestFrom = null, bestStr = 0;
      for (const cc2 in State.countries) {
        const c2 = State.countries[cc2];
        if (c2.owner !== playerCC) continue;
        if (!c2.neighbors.includes(target.cc)) continue;
        const total = c2.garrison.inf + c2.garrison.tank + c2.garrison.air;
        if (total > bestStr) { bestStr = total; bestFrom = cc2; }
      }
      const fromName = bestFrom ? State.countries[bestFrom].name : '?';
      addAction(div, `⚔️ ${target.name} 즉시 공격`, `${fromName}에서`, bestFrom && bestStr >= 3, () => {
        executeAttack(bestFrom, target.cc);
      }, 'danger');
    } else {
      addAction(div, '🚫 인접하지 않음 (먼저 이동)', '', false, ()=>{});
    }
    addAction(div, '🕊️ 강화 제안', '', true, () => {
      proposePeace(playerCC, target.owner);
      selectCountry(cc);
    });
  }
}

function addAction(parent, label, cost, enabled, fn, cls='') {
  const b = document.createElement('button');
  b.className = 'action-btn ' + cls;
  b.innerHTML = `<span>${label}</span>${cost?`<span class="cost">${cost}</span>`:''}`;
  b.disabled = !enabled;
  b.onclick = () => { Audio.play('click'); fn(); };
  parent.appendChild(b);
}

function divider(parent, label) {
  const d = document.createElement('div');
  d.className = 'section-divider';
  d.textContent = label;
  parent.appendChild(d);
}

function isPlayerAdjacent(targetCC) {
  const playerCC = currentPlayerCC();
  for (const cc in State.countries) {
    const c = State.countries[cc];
    if (c.owner !== playerCC) continue;
    if (c.neighbors.includes(targetCC)) return true;
  }
  return false;
}

function onCountryClick(cc) {
  // 모드 처리
  if (State.mode === 'move' && State.modeFromCC) {
    const from = State.countries[State.modeFromCC];
    const target = State.countries[cc];
    if (from.neighbors.includes(cc) && target.owner === currentPlayerCC()) {
      moveTroops(State.modeFromCC, cc);
      return;
    } else {
      pushLog('이동 불가: 인접한 자국 영토를 선택하세요.', 'important');
    }
  }
  if (State.mode === 'attack' && State.modeFromCC) {
    const from = State.countries[State.modeFromCC];
    const target = State.countries[cc];
    if (from.neighbors.includes(cc) && State.countries[currentPlayerCC()].wars.includes(target.owner)) {
      executeAttack(State.modeFromCC, cc);
      return;
    } else {
      pushLog('공격 불가: 인접한 적국을 선택하세요.', 'important');
    }
  }
  selectCountry(cc);
}

function beginMode(mode, fromCC) {
  State.mode = mode;
  State.modeFromCC = fromCC;
  const fromName = State.countries[fromCC].name;
  if (mode === 'move') {
    showModeIndicator(`📍 ${fromName} 부대를 옮길 영토를 선택`, 'move');
  } else {
    showModeIndicator(`⚔ ${fromName} 부대로 공격할 적국을 선택`, 'attack');
  }
  refreshSelection();
}

// ================= 메커니즘 =================
const COSTS = { civ: 100, mil: 140 };

function pushLog(msg, type='') {
  State.log.unshift({ msg, type });
  if (State.log.length > 40) State.log.pop();
  renderLog();
}

function renderLog() {
  const ul = document.getElementById('log');
  if (!ul) return;
  ul.innerHTML = '';
  for (const e of State.log) {
    const li = document.createElement('li');
    li.className = e.type;
    li.textContent = e.msg;
    ul.appendChild(li);
  }
}

function updateTopBar() {
  const p = State.countries[currentPlayerCC()];
  if (!p) return;
  document.getElementById('date-display').textContent = `${State.year}년 ${State.month}월`;
  document.getElementById('r-manpower').textContent = Math.round(p.manpower);
  document.getElementById('r-civ').textContent = p.civFactories;
  document.getElementById('r-mil').textContent = p.milFactories;
  document.getElementById('r-cp').textContent = Math.round(p.cp);
  document.getElementById('r-eq').textContent = Math.round(p.eq);
  document.getElementById('r-rp').textContent = Math.round(p.rp);
}

// === 외교 ===
function declareWar(aCC, bCC, silent=false) {
  const a = State.countries[aCC], b = State.countries[bCC];
  if (!a || !b) return;
  if (!a.wars.includes(bCC)) a.wars.push(bCC);
  if (!b.wars.includes(aCC)) b.wars.push(aCC);
  // 동맹 참전
  for (const ally of [...a.allies]) {
    if (!State.countries[ally].wars.includes(bCC)) {
      State.countries[ally].wars.push(bCC);
      State.countries[bCC].wars.push(ally);
    }
  }
  for (const ally of [...b.allies]) {
    if (!State.countries[ally].wars.includes(aCC)) {
      State.countries[ally].wars.push(aCC);
      State.countries[aCC].wars.push(ally);
    }
  }
  // NAP 자동 파기
  a.naps = (a.naps||[]).filter(x => x !== bCC);
  b.naps = (b.naps||[]).filter(x => x !== aCC);
  if (!silent) {
    pushLog(`⚔ ${a.name}이(가) ${b.name}에 선전포고했다!`, 'war');
    Audio.play('war');
  }
  renderMap();
}

function formAlliance(aCC, bCC) {
  const a = State.countries[aCC], b = State.countries[bCC];
  if (!a.allies.includes(bCC)) a.allies.push(bCC);
  if (!b.allies.includes(aCC)) b.allies.push(aCC);
  if (a.faction !== 'neutral') b.faction = a.faction;
  else if (b.faction !== 'neutral') a.faction = b.faction;
  pushLog(`🤝 ${a.name}와(과) ${b.name}이(가) 동맹을 맺었다.`, 'important');
  renderMap();
}

function signNAP(aCC, bCC) {
  const a = State.countries[aCC], b = State.countries[bCC];
  if (!a.naps) a.naps = [];
  if (!b.naps) b.naps = [];
  if (!a.naps.includes(bCC)) a.naps.push(bCC);
  if (!b.naps.includes(aCC)) b.naps.push(aCC);
  pushLog(`📜 ${a.name}와(과) ${b.name}이(가) 불가침 조약을 체결했다.`, 'important');
}

function startJustification(aCC, bCC) {
  const a = State.countries[aCC];
  if (!a.justifying) a.justifying = [];
  if (a.justifying.some(j => j.target === bCC)) return;
  a.justifying.push({ target: bCC, progress: 0 });
  pushLog(`⚖️ ${a.name}이(가) ${State.countries[bCC].name}에 대한 명분 작업을 시작했다.`, 'important');
}

function proposePeace(aCC, bCC) {
  const a = State.countries[aCC], b = State.countries[bCC];
  const aStr = totalStrength(aCC);
  const bStr = totalStrength(bCC);
  const ratio = aStr / (aStr + bStr);
  let accept = false;
  if (ratio < 0.4) accept = true;
  else if (ratio > 0.65) accept = Math.random() < 0.3;
  else accept = Math.random() < 0.5;

  if (accept) {
    makePeace(aCC, bCC);
    modal('강화 성립', `${a.name}와(과) ${b.name}이(가) 강화조약을 체결했다.`);
  } else {
    pushLog(`${b.name}이(가) 강화 제안을 거절했다.`, 'important');
    modal('거절됨', `${b.name}이(가) 강화 제안을 거절했다.`);
  }
}

function makePeace(aCC, bCC) {
  const a = State.countries[aCC], b = State.countries[bCC];
  a.wars = a.wars.filter(w => w !== bCC);
  b.wars = b.wars.filter(w => w !== aCC);
  pushLog(`🕊️ ${a.name}와(과) ${b.name}이(가) 강화조약을 체결했다.`, 'important');
  renderMap();
}

function totalStrength(cc) {
  let ar = 0, mp=0, fc=0;
  for (const k in State.countries) {
    const c = State.countries[k];
    if (c.owner === cc) {
      const eff = (k===cc) ? 1.0 : 0.4;
      ar += unitTotalStr(c.garrison, cc, false);
      mp += c.manpower * eff;
      fc += (c.civFactories + c.milFactories*2) * eff;
    }
  }
  return ar + mp * 0.3 + fc;
}

// === 건설/모집/훈련 ===
function buildFactory(cc, type) {
  const player = State.countries[currentPlayerCC()];
  let cost = COSTS[type];
  // 건설 보너스
  const bonus = getTechBonus(player, 'build_speed');
  cost = Math.round(cost / (1 + bonus));
  if (player.cp < cost) return;
  player.cp -= cost;
  const target = State.countries[cc];
  target.constructions = target.constructions || [];
  target.constructions.push({ type, remaining: type==='civ'?3:4 });
  pushLog(`🏗 ${target.name}에 ${type==='civ'?'민간공장':'군수공장'} 건설 시작.`);
  Audio.play('build');
  updateTopBar();
  selectCountry(cc);
}

function recruitDirect(cc, unit, count) {
  const player = State.countries[currentPlayerCC()];
  const stats = UNIT_STATS[unit];
  const mpCost = stats.mpCost * count;
  const eqCost = stats.eqCost * count;
  if (player.manpower < mpCost) return;
  if (unit !== 'inf' && player.eq < eqCost) return;
  player.manpower -= mpCost;
  if (unit !== 'inf') player.eq -= eqCost;
  const target = State.countries[cc];
  target.garrison[unit] += count;
  pushLog(`👥 ${target.name}에 ${stats.name} ${count} 부대를 배치했다.`);
  Audio.play('build');
  updateTopBar();
  selectCountry(cc);
  renderMap();
}

function trainGarrison(cc) {
  const player = State.countries[currentPlayerCC()];
  if (player.cp < 40) return;
  player.cp -= 40;
  const target = State.countries[cc];
  target.garrison.exp = (target.garrison.exp||0) + 30;
  pushLog(`🎖 ${target.name} 부대 훈련 완료 (+30 XP)`);
  Audio.play('build');
  updateTopBar();
  selectCountry(cc);
}

// === 이동 / 공격 ===
function moveTroops(fromCC, toCC) {
  const from = State.countries[fromCC];
  const to = State.countries[toCC];
  // 70% 이동
  const m = {
    inf: Math.floor(from.garrison.inf * 0.7),
    tank: Math.floor(from.garrison.tank * 0.7),
    air: Math.floor(from.garrison.air * 0.7)
  };
  from.garrison.inf -= m.inf;
  from.garrison.tank -= m.tank;
  from.garrison.air -= m.air;
  to.garrison.inf += m.inf;
  to.garrison.tank += m.tank;
  to.garrison.air += m.air;
  // 경험치 합산 (가중 평균)
  const fromTotal = m.inf+m.tank+m.air;
  const toTotal = to.garrison.inf+to.garrison.tank+to.garrison.air;
  if (toTotal > 0) {
    to.garrison.exp = ((to.garrison.exp||0)*(toTotal-fromTotal) + (from.garrison.exp||0)*fromTotal) / toTotal;
  }
  pushLog(`📦 ${from.name} → ${to.name}: 보병 ${m.inf}·전차 ${m.tank}·항공 ${m.air}`);
  animateMove(fromCC, toCC);
  Audio.play('build');
  cancelMode();
  updateTopBar();
  renderMap();
  selectCountry(toCC);
}

// === 전투 ===
function unitTotalStr(garr, ownerCC, isAttacker) {
  const c = State.countries[ownerCC];
  const expLv = getExpLevel(garr.exp);
  const infStr  = garr.inf  * UNIT_STATS.inf.baseStr  * (1 + getTechBonus(c,'inf_str'));
  const tankStr = garr.tank * UNIT_STATS.tank.baseStr * (1 + getTechBonus(c,'tank_str'));
  const airStr  = garr.air  * UNIT_STATS.air.baseStr  * (1 + getTechBonus(c,'air_str'));
  const combined = (garr.tank > 0 && garr.air > 0) ? (1.1 + getTechBonus(c,'combined_arms')) : 1.0;
  let total = (infStr + tankStr + airStr) * combined * expLv.mult;
  // 교리 보너스
  if (isAttacker) {
    total *= (1 + getTechBonus(c,'tank_attack') * (garr.tank>0?1:0));
    total *= (1 + getTechBonus(c,'inf_attack') * (garr.inf>0?1:0));
    total *= (1 + getTechBonus(c,'all_attack'));
  } else {
    total *= (1 + getTechBonus(c,'all_defense'));
  }
  return total;
}

function executeAttack(fromCC, defCC) {
  const from = State.countries[fromCC];
  const def = State.countries[defCC];
  const playerCC = currentPlayerCC();
  const fromOwner = State.countries[from.owner];

  const totalAtt = from.garrison.inf + from.garrison.tank + from.garrison.air;
  if (totalAtt < 3) {
    modal('병력 부족', '공격하려면 최소 3개 유닛이 필요합니다.');
    cancelMode();
    return;
  }

  // 투입 부대: 70%
  const sent = {
    inf: Math.floor(from.garrison.inf * 0.7),
    tank: Math.floor(from.garrison.tank * 0.7),
    air: Math.floor(from.garrison.air * 0.7),
    exp: from.garrison.exp || 0
  };
  if (sent.inf+sent.tank+sent.air < 3) {
    modal('전선 병력 부족', `${from.name}에 출격 가능한 병력이 부족합니다.`);
    cancelMode();
    return;
  }

  animateAttack(fromCC, defCC);

  const defOriginal = { ...def.garrison }; // 모달용
  const attStr = unitTotalStr(sent, fromCC, true) * (0.85 + Math.random()*0.3);
  const defStr = unitTotalStr(def.garrison, defCC, false) * 1.3 * (0.85 + Math.random()*0.3);

  const lossRedAtt = getTechBonus(fromOwner, 'inf_loss_red');
  const lossRedDef = getTechBonus(State.countries[def.owner], 'inf_loss_red');

  let result;
  const attUnitTotal = sent.inf+sent.tank+sent.air;
  const defUnitTotal = def.garrison.inf+def.garrison.tank+def.garrison.air;
  const baseAttLoss = Math.max(1, Math.round(Math.min(attUnitTotal, defUnitTotal) * 0.35 * (1-lossRedAtt)));
  const baseDefLoss = Math.max(1, Math.round(Math.min(attUnitTotal, defUnitTotal) * 0.4 * (1-lossRedDef)));

  let attLoss, defLoss, win;
  if (attStr > defStr) {
    win = true;
    attLoss = Math.round(baseAttLoss * 0.7);
    defLoss = defUnitTotal; // 방어자 궤멸
  } else {
    win = false;
    attLoss = Math.round(baseAttLoss * 1.4);
    defLoss = Math.round(baseDefLoss * 0.4);
  }

  // 손실 분배
  const attLossDist = distributeLoss(sent, attLoss);
  const defLossDist = distributeLoss(def.garrison, defLoss);

  // 적용
  from.garrison.inf -= attLossDist.inf; // 출발지에는 70%만 남았던 게 아니라 출격 70%인데 손실은 전체에서
  from.garrison.tank -= attLossDist.tank;
  from.garrison.air -= attLossDist.air;
  from.garrison.inf = Math.max(0, from.garrison.inf);
  from.garrison.tank = Math.max(0, from.garrison.tank);
  from.garrison.air = Math.max(0, from.garrison.air);

  def.garrison.inf = Math.max(0, def.garrison.inf - defLossDist.inf);
  def.garrison.tank = Math.max(0, def.garrison.tank - defLossDist.tank);
  def.garrison.air = Math.max(0, def.garrison.air - defLossDist.air);

  // 경험치 부여 (전투 참여)
  from.garrison.exp = (from.garrison.exp||0) + (win ? 18 : 8);
  def.garrison.exp = (def.garrison.exp||0) + (win ? 5 : 12);

  let occupied = false;
  if (win) {
    // 살아남은 출격 부대를 점령지로 이동
    const survivors = {
      inf:  Math.max(0, sent.inf  - attLossDist.inf),
      tank: Math.max(0, sent.tank - attLossDist.tank),
      air:  Math.max(0, sent.air  - attLossDist.air)
    };
    // 본대에서 출격분 차감 (이미 손실로 빠진 만큼 추가)
    // 실제로는 from.garrison에서 sent만큼 빼고 survivors만 to에 더하면 됨
    // 위에서 loss를 from.garrison에서 뺐으므로, sent의 나머지(생존자)를 더 빼야 함
    // 단순화: 본대에 남은 비율은 (1-0.7)+생존손실은 위에서 처리됨. 보강: 출격분 만큼 빼고 생존자 이동.
    // 보다 명확하게: 다시 계산
    // 이미 from에서 attLoss만큼 뺐으므로, 추가로 sent에서 attLoss 뺀 만큼을 from에서 빼고 그걸 to로
    from.garrison.inf  = Math.max(0, from.garrison.inf  - survivors.inf);
    from.garrison.tank = Math.max(0, from.garrison.tank - survivors.tank);
    from.garrison.air  = Math.max(0, from.garrison.air  - survivors.air);

    def.owner = from.owner;
    def.garrison = { ...survivors, exp: from.garrison.exp };
    occupied = true;
    pushLog(`✅ ${fromOwner.name}이(가) ${def.name}을(를) 점령!`, 'victory');
    Audio.play('victory');

    // 수도 함락?
    const defOwnerCC = State.countries[def.cc].cc;
    // 위의 def.cc가 자기 자신을 가리키므로, 함락된 본국이라면 멸망 처리
    if (defCC === def.cc && fromOwner.cc !== defCC) {
      // 점령된 게 본국이고 그 본국의 owner가 자기자신이었으면 → 함락
      // 이미 def.owner 바꿨으므로, 원래 owner를 추적해야 함
    }
  } else {
    pushLog(`❌ ${fromOwner.name}의 ${def.name} 공격 실패`, 'war');
    Audio.play('defeat');
  }

  // 전투 결과 모달 (사람 차례면)
  if (currentPlayerCC() === fromOwner.cc || isHumanCountry(def.owner)) {
    showCombatResult({
      attCountry: fromOwner.name,
      defCountry: def.name + (occupied ? ' (점령됨)' : ''),
      attUnits: sent,
      defUnits: defOriginal,
      attStr: Math.round(attStr),
      defStr: Math.round(defStr),
      attLoss: attLossDist,
      defLoss: defLossDist,
      win,
      occupied
    });
  }

  cancelMode();
  updateTopBar();
  renderMap();
  if (State.selectedCC) selectCountry(State.selectedCC);
  result = win ? 'win' : 'lose';
  return result;
}

function distributeLoss(garr, totalLoss) {
  const total = garr.inf + garr.tank + garr.air;
  if (total === 0) return { inf:0, tank:0, air:0 };
  const infRatio = garr.inf / total;
  const tankRatio = garr.tank / total;
  const airRatio = garr.air / total;
  return {
    inf: Math.min(garr.inf, Math.round(totalLoss * infRatio)),
    tank: Math.min(garr.tank, Math.round(totalLoss * tankRatio)),
    air: Math.min(garr.air, Math.round(totalLoss * airRatio))
  };
}

function showCombatResult(r) {
  const body = document.getElementById('combat-body');
  body.innerHTML = `
    <div class="combat-outcome ${r.win?'win':'lose'}">${r.win?'🏆 승리':'💔 패배'}${r.occupied?' — 영토 점령':''}</div>
    <div class="combat-side">
      <div class="combat-team attacker">
        <h4>⚔ ${r.attCountry} (공격)</h4>
        <div class="ct-units">${UNIT_STATS.inf.icon} ${r.attUnits.inf}  ${UNIT_STATS.tank.icon} ${r.attUnits.tank}  ${UNIT_STATS.air.icon} ${r.attUnits.air}</div>
        <div class="ct-power">전력 ${r.attStr}</div>
        <div class="ct-losses">손실: ${r.attLoss.inf}/${r.attLoss.tank}/${r.attLoss.air}</div>
      </div>
      <div class="combat-team defender">
        <h4>🛡 ${r.defCountry} (방어)</h4>
        <div class="ct-units">${UNIT_STATS.inf.icon} ${r.defUnits.inf}  ${UNIT_STATS.tank.icon} ${r.defUnits.tank}  ${UNIT_STATS.air.icon} ${r.defUnits.air}</div>
        <div class="ct-power">전력 ${r.defStr}</div>
        <div class="ct-losses">손실: ${r.defLoss.inf}/${r.defLoss.tank}/${r.defLoss.air}</div>
      </div>
    </div>
  `;
  document.getElementById('combat-modal').classList.remove('hidden');
}

function animateAttack(fromCC, toCC) {
  const fx = document.getElementById('fx-layer');
  const a = State.countries[fromCC], b = State.countries[toCC];
  const t = document.createElementNS('http://www.w3.org/2000/svg','text');
  t.setAttribute('x', a.cx); t.setAttribute('y', a.cy);
  t.setAttribute('class','fx-sword');
  t.setAttribute('text-anchor','middle');
  t.textContent = '⚔';
  fx.appendChild(t);
  const dur = 600;
  const start = performance.now();
  function step(now) {
    const p = Math.min(1, (now-start)/dur);
    const x = a.cx + (b.cx - a.cx) * p;
    const y = a.cy + (b.cy - a.cy) * p - Math.sin(p*Math.PI) * 30;
    t.setAttribute('x', x); t.setAttribute('y', y);
    if (p < 1) requestAnimationFrame(step);
    else {
      // boom
      Audio.play('attack');
      const boom = document.createElementNS('http://www.w3.org/2000/svg','text');
      boom.setAttribute('x', b.cx); boom.setAttribute('y', b.cy);
      boom.setAttribute('class','fx-boom');
      boom.setAttribute('text-anchor','middle');
      boom.textContent = '💥';
      fx.appendChild(boom);
      t.remove();
      setTimeout(() => boom.remove(), 600);
    }
  }
  requestAnimationFrame(step);
}

function animateMove(fromCC, toCC) {
  const fx = document.getElementById('fx-layer');
  const a = State.countries[fromCC], b = State.countries[toCC];
  const t = document.createElementNS('http://www.w3.org/2000/svg','text');
  t.setAttribute('x', a.cx); t.setAttribute('y', a.cy);
  t.setAttribute('class','fx-sword');
  t.setAttribute('text-anchor','middle');
  t.textContent = '🚚';
  fx.appendChild(t);
  const dur = 500;
  const start = performance.now();
  function step(now) {
    const p = Math.min(1, (now-start)/dur);
    t.setAttribute('x', a.cx + (b.cx - a.cx) * p);
    t.setAttribute('y', a.cy + (b.cy - a.cy) * p);
    if (p < 1) requestAnimationFrame(step);
    else t.remove();
  }
  requestAnimationFrame(step);
}

// === 수도 함락 ===
function onCapitalFall(fallenCC, conquerorCC) {
  const fallen = State.countries[fallenCC];
  const conqueror = State.countries[conquerorCC];
  pushLog(`💀 ${fallen.name}의 수도가 함락! 정부 항복.`, 'victory');

  for (const cc in State.countries) {
    const c = State.countries[cc];
    if (c.owner === fallenCC) c.owner = conquerorCC;
  }
  fallen.wars.forEach(w => {
    State.countries[w].wars = State.countries[w].wars.filter(x => x !== fallenCC);
  });
  fallen.wars = [];
  fallen.allies.forEach(a => {
    State.countries[a].allies = State.countries[a].allies.filter(x => x !== fallenCC);
  });
  fallen.allies = [];

  // 사람 플레이어 멸망?
  const idx = State.players.findIndex(p => p.cc === fallenCC);
  if (idx >= 0) {
    State.players[idx].eliminated = true;
    if (State.players.every(p => p.eliminated)) {
      gameOver(false);
    }
  }
  checkVictory();
}

// === 기술 ===
function getTechBonus(country, effectKey) {
  let total = 0;
  for (const tid of (country.researched||[])) {
    const tech = TECHS[tid];
    if (tech && tech.effect && tech.effect[effectKey] != null) total += tech.effect[effectKey];
  }
  return total;
}

function getExpLevel(xp) {
  let lv = EXP_LEVELS[0];
  for (const e of EXP_LEVELS) if (xp >= e.min) lv = e;
  return lv;
}

function canResearch(country, techId) {
  const tech = TECHS[techId];
  if (!tech) return false;
  if (country.researched.includes(techId)) return false;
  if (tech.year > State.year) return false;
  if (tech.prereq) {
    for (const p of tech.prereq) if (!country.researched.includes(p)) return false;
  }
  return true;
}

function startResearch(techId) {
  const p = State.countries[currentPlayerCC()];
  if (!canResearch(p, techId)) return;
  p.currentResearch = techId;
  p.researchProgress = 0;
  pushLog(`🔬 ${TECHS[techId].name} 연구 시작.`, 'tech');
  Audio.play('click');
  renderTechModal();
}

function renderTechModal() {
  const p = State.countries[currentPlayerCC()];
  const status = document.getElementById('tech-status');
  if (p.currentResearch) {
    const t = TECHS[p.currentResearch];
    const pct = Math.min(100, (p.researchProgress/t.cost)*100);
    status.innerHTML = `
      <div class="ts-cur">연구중: ${t.name}</div>
      <div class="tech-progress"><div class="tech-progress-fill" style="width:${pct}%"></div></div>
      <div>${Math.round(p.researchProgress)} / ${t.cost}</div>
      <div>월 ${calcResearchRate(p)} 점</div>
    `;
  } else {
    status.innerHTML = `
      <div class="ts-cur">연구 없음 — 아래 기술 클릭하여 선택</div>
      <div>월 ${calcResearchRate(p)} 점</div>
    `;
  }

  const tree = document.getElementById('tech-tree');
  const cats = ['산업','보병','전차','항공','교리'];
  tree.innerHTML = '';
  for (const cat of cats) {
    const col = document.createElement('div');
    col.className = 'tech-cat';
    col.innerHTML = `<h3>${cat}</h3>`;
    const techs = Object.entries(TECHS).filter(([_,t]) => t.cat === cat);
    techs.sort((a,b) => a[1].year - b[1].year);
    for (const [tid, t] of techs) {
      const card = document.createElement('div');
      card.className = 'tech-card';
      let cls = '';
      if (p.researched.includes(tid)) cls = 'done';
      else if (p.currentResearch === tid) cls = 'current';
      else if (!canResearch(p, tid)) cls = 'locked';
      card.classList.add(cls);
      const eff = Object.entries(t.effect).map(([k,v]) => `${effLabel(k)} +${Math.round(v*100)}%`).join(', ');
      card.innerHTML = `
        <div class="tc-name">${t.name}</div>
        <div class="tc-meta">${t.year}년 · ${t.cost}점${t.prereq?` · ${t.prereq.map(p=>TECHS[p].name).join('/')} 필요`:''}</div>
        <div class="tc-eff">${eff}</div>
      `;
      if (!cls) {
        card.onclick = () => startResearch(tid);
      }
      col.appendChild(card);
    }
    tree.appendChild(col);
  }
}

function effLabel(k) {
  const labels = {
    inf_str:'보병 전력', tank_str:'전차 전력', air_str:'항공 전력',
    inf_attack:'보병 공격', tank_attack:'전차 공격', all_attack:'전체 공격', all_defense:'전체 방어',
    combined_arms:'제병협동', inf_loss_red:'손실 감소',
    factory_eff:'공장 효율', build_speed:'건설 속도', mp_regen:'인력 회복'
  };
  return labels[k] || k;
}

function calcResearchRate(c) {
  return Math.round(3 + c.civFactories * 0.3 + c.milFactories * 0.15);
}

// === 생산 모달 ===
function showProdModal() {
  const p = State.countries[currentPlayerCC()];
  const wrap = document.getElementById('prod-sliders');
  wrap.innerHTML = '';
  for (const u of ['inf','tank','air']) {
    const stats = UNIT_STATS[u];
    const row = document.createElement('div');
    row.className = 'prod-row';
    row.innerHTML = `
      <label>${stats.icon} ${stats.name}</label>
      <input type="range" min="0" max="100" value="${p.prodMix[u]}" data-u="${u}">
      <span class="pct" id="pct-${u}">${p.prodMix[u]}%</span>
    `;
    wrap.appendChild(row);
  }
  wrap.querySelectorAll('input').forEach(input => {
    input.oninput = () => {
      const u = input.dataset.u;
      document.getElementById('pct-'+u).textContent = input.value + '%';
      updateProdSummary();
    };
  });
  updateProdSummary();
  document.getElementById('prod-modal').classList.remove('hidden');
}

function updateProdSummary() {
  const p = State.countries[currentPlayerCC()];
  const vals = {};
  let sum = 0;
  document.querySelectorAll('#prod-sliders input').forEach(i => {
    vals[i.dataset.u] = +i.value;
    sum += +i.value;
  });
  if (sum === 0) sum = 1;
  const totalEq = p.milFactories * 2;
  const summary = ['inf','tank','air'].map(u => {
    const eqShare = totalEq * vals[u]/sum;
    const stats = UNIT_STATS[u];
    const units = Math.floor(eqShare / stats.eqCost);
    return `${stats.icon} ${stats.name}: 월 ${units} 부대 (장비 ${eqShare.toFixed(1)})`;
  }).join('<br>');
  document.getElementById('prod-summary').innerHTML =
    `<b>예상 월 생산 (군수공장 ${p.milFactories} 기준)</b><br>${summary}<br>` +
    `<small style="color:var(--text-dim)">합계가 100%가 아니어도 비율대로 배분됩니다.</small>`;
}

function saveProdMix() {
  const p = State.countries[currentPlayerCC()];
  document.querySelectorAll('#prod-sliders input').forEach(i => {
    p.prodMix[i.dataset.u] = +i.value;
  });
  pushLog('⚙️ 생산 배분 변경.');
  document.getElementById('prod-modal').classList.add('hidden');
}

// ================= 턴 처리 =================
function endTurn() {
  if (State.gameOver) return;
  cancelMode();
  Audio.play('click');

  // 다음 사람 차례 or 처리
  if (State.isMulti) {
    let next = (State.currentPlayerIdx + 1) % State.players.length;
    let safety = 0;
    while (State.players[next].eliminated && safety < 10) { next = (next+1) % State.players.length; safety++; }
    if (next === 0) {
      processWorldTurn();
      State.currentPlayerIdx = 0;
      // 사망자 스킵
      while (State.players[State.currentPlayerIdx].eliminated && State.currentPlayerIdx < State.players.length-1) {
        State.currentPlayerIdx++;
      }
      if (!State.gameOver) showHandoff();
    } else {
      State.currentPlayerIdx = next;
      showHandoff();
    }
  } else {
    processWorldTurn();
    if (!State.gameOver) enterGameScreen();
  }
}

function processWorldTurn() {
  State.turn++;

  // 1. 건설 진행
  for (const cc in State.countries) {
    const c = State.countries[cc];
    if (!c.constructions) continue;
    const completed = [];
    for (const con of c.constructions) {
      con.remaining--;
      if (con.remaining <= 0) {
        completed.push(con);
        if (con.type === 'civ') c.civFactories++;
        else c.milFactories++;
      }
    }
    c.constructions = c.constructions.filter(x => !completed.includes(x));
    if (completed.length && isHumanCountry(c.owner)) {
      pushLog(`🏭 ${c.name}: ${completed.length}개 공장 건설 완료`, 'important');
    }
  }

  // 2. 생산 & 자원
  for (const ownerCC in State.countries) {
    if (State.countries[ownerCC].owner !== ownerCC) continue;
    const owner = State.countries[ownerCC];
    let civ = 0, mil = 0, mpRegen = 0;
    const factoryEff = 1 + getTechBonus(owner, 'factory_eff');
    const mpRegenBonus = 1 + getTechBonus(owner, 'mp_regen');
    for (const tcc in State.countries) {
      const t = State.countries[tcc];
      if (t.owner !== ownerCC) continue;
      const eff = (tcc === ownerCC) ? 1.0 : 0.4;
      civ += t.civFactories * eff;
      mil += t.milFactories * eff;
      mpRegen += t.manpower * 0.005 * eff;
    }
    owner.cp += civ * factoryEff * 5;
    owner.eq += mil * factoryEff * 2;
    owner.manpower += mpRegen * mpRegenBonus;
    owner.rp += calcResearchRate(owner);

    // 자동 배치: prodMix에 따라 장비 → 유닛
    const mix = owner.prodMix || { inf:50, tank:30, air:20 };
    const sum = (mix.inf+mix.tank+mix.air) || 1;
    for (const u of ['inf','tank','air']) {
      const stats = UNIT_STATS[u];
      const eqShare = owner.eq * mix[u] / sum;
      let produced = Math.floor(eqShare / stats.eqCost);
      // 인력 제한
      produced = Math.min(produced, Math.floor(owner.manpower / stats.mpCost));
      if (produced > 0) {
        owner.eq -= produced * stats.eqCost;
        owner.manpower -= produced * stats.mpCost;
        owner.garrison[u] += produced;
      }
    }
    // 연구 진행
    if (owner.currentResearch) {
      owner.researchProgress += calcResearchRate(owner);
      const tech = TECHS[owner.currentResearch];
      if (owner.researchProgress >= tech.cost) {
        owner.researched.push(owner.currentResearch);
        if (isHumanCountry(ownerCC)) pushLog(`🔬 ${owner.name} 연구 완료: ${tech.name}`, 'tech');
        owner.currentResearch = null;
        owner.researchProgress = 0;
      }
    } else {
      // AI는 자동으로 연구 선택
      if (!isHumanCountry(ownerCC)) {
        const available = Object.keys(TECHS).filter(t => canResearch(owner, t));
        if (available.length) {
          owner.currentResearch = available[Math.floor(Math.random()*available.length)];
          owner.researchProgress = 0;
        }
      }
    }

    // 명분 진행
    if (owner.justifying) {
      owner.justifying.forEach(j => { j.progress = Math.min(100, j.progress + 100/6); }); // 6개월
      const done = owner.justifying.filter(j => j.progress >= 100);
      done.forEach(j => {
        owner.justified = owner.justified || [];
        owner.justified.push(j.target);
        if (isHumanCountry(ownerCC)) pushLog(`⚖️ ${owner.name}: ${State.countries[j.target].name}에 대한 명분 확보!`, 'tech');
      });
      owner.justifying = owner.justifying.filter(j => j.progress < 100);
    }
  }

  // 3. AI 행동
  aiActions();
  aiCombat();

  // 4. 수도 함락 체크 (전투 후)
  for (const cc in State.countries) {
    const c = State.countries[cc];
    if (c.fallen) continue;
    if (c.owner !== cc) {
      c.fallen = true;
      onCapitalFall(cc, c.owner);
    }
  }

  // 5. 시간 진행
  State.month++;
  if (State.month > 12) { State.month = 1; State.year++; }

  checkVictory();
  updateTopBar();
}

// ================= AI =================
function aiActions() {
  for (const cc in State.countries) {
    if (isHumanCountry(cc)) continue;
    const c = State.countries[cc];
    if (c.owner !== cc) continue;
    if (!c.ai) continue;

    // 진영 자동 합류
    if (c.wantsFaction && c.faction === 'neutral') {
      if (Math.random() < 0.04 * (State.turn / 6 + 1)) {
        joinFaction(cc, c.wantsFaction);
      }
    }

    // 건설
    if (c.cp >= COSTS.mil && Math.random() < 0.6) {
      c.cp -= COSTS.mil;
      c.constructions.push({ type:'mil', remaining: 4 });
    } else if (c.cp >= COSTS.civ && Math.random() < 0.7) {
      c.cp -= COSTS.civ;
      c.constructions.push({ type:'civ', remaining: 3 });
    }

    // 훈련
    if (c.cp >= 80 && Math.random() < 0.2) {
      c.cp -= 40;
      c.garrison.exp = (c.garrison.exp||0) + 30;
    }

    // 선전포고
    if (c.ai.target.length && c.wars.length < 3 && Math.random() < c.ai.aggression * 0.08) {
      for (const tg of c.ai.target) {
        const t = State.countries[tg];
        if (!t || t.owner !== tg) continue;
        if (c.wars.includes(tg)) continue;
        let adj = false;
        for (const k in State.countries) {
          if (State.countries[k].owner === cc && State.countries[k].neighbors.includes(tg)) { adj = true; break; }
        }
        if (!adj) continue;
        if (totalStrength(cc) > totalStrength(tg) * 0.7) {
          declareWar(cc, tg);
          break;
        }
      }
    }
  }
}

function joinFaction(cc, faction) {
  const c = State.countries[cc];
  c.faction = faction;
  pushLog(`📢 ${c.name}이(가) ${FACTIONS[faction].name}에 가담!`, 'important');
  for (const k in State.countries) {
    const o = State.countries[k];
    if (k === cc) continue;
    if (o.faction === faction && o.owner === k) {
      if (!c.allies.includes(k)) c.allies.push(k);
      if (!o.allies.includes(cc)) o.allies.push(cc);
      for (const e of o.wars) {
        if (State.countries[e].faction !== faction && !c.wars.includes(e)) {
          declareWar(cc, e, true);
        }
      }
    }
  }
  renderMap();
}

function aiCombat() {
  const order = Object.keys(State.countries).sort(()=>Math.random()-0.5);
  for (const cc of order) {
    if (isHumanCountry(cc)) continue;
    const c = State.countries[cc];
    if (c.owner !== cc) continue;
    if (!c.wars.length) continue;

    // 자국 또는 점령지에서 인접한 적 영토 찾기
    const targets = [];
    for (const k in State.countries) {
      const t = State.countries[k];
      if (!c.wars.includes(t.owner)) continue;
      for (const j in State.countries) {
        if (State.countries[j].owner !== cc) continue;
        if (State.countries[j].neighbors.includes(k)) {
          const total = State.countries[j].garrison.inf + State.countries[j].garrison.tank + State.countries[j].garrison.air;
          if (total >= 5) {
            targets.push({ from: j, to: k, str: totalStrengthOfGarr(State.countries[j].garrison, cc) });
          }
        }
      }
    }
    if (!targets.length) continue;
    targets.sort((a,b) => State.countries[a.to].garrison.inf - State.countries[b.to].garrison.inf);
    const t = targets[0];
    const aggression = c.ai ? c.ai.aggression : 0.5;
    if (Math.random() < aggression * 0.6) {
      // AI 공격 처리 (모달 없이)
      aiAttack(t.from, t.to);
    }
  }
}

function totalStrengthOfGarr(garr, ownerCC) {
  return unitTotalStr(garr, ownerCC, true);
}

function aiAttack(fromCC, defCC) {
  const from = State.countries[fromCC];
  const def = State.countries[defCC];
  const fromOwner = State.countries[from.owner];

  const sent = {
    inf: Math.floor(from.garrison.inf * 0.7),
    tank: Math.floor(from.garrison.tank * 0.7),
    air: Math.floor(from.garrison.air * 0.7),
    exp: from.garrison.exp || 0
  };
  if (sent.inf+sent.tank+sent.air < 3) return;

  const attStr = unitTotalStr(sent, fromCC, true) * (0.85 + Math.random()*0.3);
  const defStr = unitTotalStr(def.garrison, defCC, false) * 1.3 * (0.85 + Math.random()*0.3);

  const attUnitTotal = sent.inf+sent.tank+sent.air;
  const defUnitTotal = def.garrison.inf+def.garrison.tank+def.garrison.air;
  const baseAttLoss = Math.max(1, Math.round(Math.min(attUnitTotal, defUnitTotal) * 0.35));
  const baseDefLoss = Math.max(1, Math.round(Math.min(attUnitTotal, defUnitTotal) * 0.4));

  if (attStr > defStr) {
    const attLossD = distributeLoss(sent, Math.round(baseAttLoss * 0.7));
    from.garrison.inf -= attLossD.inf;
    from.garrison.tank -= attLossD.tank;
    from.garrison.air -= attLossD.air;
    const survivors = {
      inf:  Math.max(0, sent.inf - attLossD.inf),
      tank: Math.max(0, sent.tank - attLossD.tank),
      air:  Math.max(0, sent.air - attLossD.air)
    };
    from.garrison.inf  = Math.max(0, from.garrison.inf - survivors.inf);
    from.garrison.tank = Math.max(0, from.garrison.tank - survivors.tank);
    from.garrison.air  = Math.max(0, from.garrison.air - survivors.air);
    def.owner = from.owner;
    def.garrison = { ...survivors, exp: (from.garrison.exp||0)+18 };
    from.garrison.exp = (from.garrison.exp||0) + 18;
    pushLog(`⚔ ${fromOwner.name}이(가) ${def.name}을(를) 점령!`, 'war');
  } else {
    const attLossD = distributeLoss(sent, Math.round(baseAttLoss * 1.4));
    const defLossD = distributeLoss(def.garrison, Math.round(baseDefLoss * 0.4));
    from.garrison.inf = Math.max(0, from.garrison.inf - attLossD.inf);
    from.garrison.tank = Math.max(0, from.garrison.tank - attLossD.tank);
    from.garrison.air = Math.max(0, from.garrison.air - attLossD.air);
    def.garrison.inf = Math.max(0, def.garrison.inf - defLossD.inf);
    def.garrison.tank = Math.max(0, def.garrison.tank - defLossD.tank);
    def.garrison.air = Math.max(0, def.garrison.air - defLossD.air);
    from.garrison.exp = (from.garrison.exp||0) + 8;
    def.garrison.exp = (def.garrison.exp||0) + 12;
  }
}

// ================= 승리/패배 =================
function checkVictory() {
  // 사람 플레이어 1명 남고 모두 그 진영이거나 점령됨?
  const majors = ['GER','GBR','FRA','ITA','USR','POL'];

  for (const player of State.players) {
    if (player.eliminated) continue;
    const pc = State.countries[player.cc];
    let allDone = true;
    for (const m of majors) {
      if (m === player.cc) continue;
      const c = State.countries[m];
      if (c.owner === m) {
        if (c.faction !== pc.faction || pc.faction === 'neutral') { allDone = false; break; }
      } else if (State.countries[c.owner].faction !== pc.faction) {
        allDone = false; break;
      }
    }
    if (allDone) {
      gameOver(true, player);
      return;
    }
  }

  if (State.year >= 1948) gameOver(null);
}

function gameOver(win, player) {
  State.gameOver = true;
  if (win === true) {
    Audio.play('victory');
    const name = player ? `${player.name} (${State.countries[player.cc].name})` : '플레이어';
    modal('🏆 승리!', `${State.year}년 ${State.month}월, ${name}이(가) 유럽의 패권을 차지했다!`);
  } else if (win === false) {
    Audio.play('defeat');
    modal('💀 패배', `모든 플레이어가 멸망했다.`);
  } else {
    modal('🕊️ 종전', `1948년, 전쟁은 결판없이 끝났다.`);
  }
}

// ================= 모달 =================
function modal(title, body) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  document.getElementById('modal').classList.remove('hidden');
}

// ================= 초기화 =================
document.addEventListener('DOMContentLoaded', () => {
  setupStartScreen();

  document.getElementById('end-turn-btn').onclick = endTurn;
  document.getElementById('tech-btn').onclick = () => {
    Audio.play('click');
    renderTechModal();
    document.getElementById('tech-modal').classList.remove('hidden');
  };
  document.getElementById('prod-btn').onclick = () => {
    Audio.play('click');
    showProdModal();
  };
  document.getElementById('prod-save').onclick = saveProdMix;

  document.querySelectorAll('[data-close]').forEach(b => {
    b.onclick = () => {
      Audio.play('click');
      document.getElementById(b.dataset.close).classList.add('hidden');
    };
  });

  document.getElementById('modal-close').onclick = () => {
    Audio.play('click');
    document.getElementById('modal').classList.add('hidden');
    if (State.gameOver) {
      // 새 게임
      document.getElementById('game-screen').classList.add('hidden');
      document.getElementById('start-screen').classList.remove('hidden');
      State.gameOver = false;
      State.year = 1939; State.month = 9; State.turn = 0;
      State.log = []; State.selectedCC = null; State.players = [];
      resetStartScreen();
    }
  };

  // Esc로 모드 취소
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (State.mode) cancelMode();
      else {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      }
    }
    if (e.key === 'Enter' && !document.getElementById('game-screen').classList.contains('hidden')) {
      // Enter로 차례 종료
      // endTurn();  // 너무 위험하므로 주석
    }
  });

  // 오디오 활성화 (사용자 첫 클릭 후)
  document.addEventListener('click', () => Audio.init(), { once: true });
});
