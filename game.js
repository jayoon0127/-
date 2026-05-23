// The Great War — 게임 로직

const State = {
  year: 1939,
  month: 9,
  playerCC: null,
  selectedCC: null,
  countries: {},
  log: [],
  gameOver: false,
  turn: 0
};

// ============== 초기화 ==============
function initGame() {
  // 깊은 복사
  State.countries = JSON.parse(JSON.stringify(COUNTRIES));

  // 합병 처리 (오스트리아·체코슬로바키아 → 독일)
  for (const cc in State.countries) {
    const c = State.countries[cc];
    c.cc = cc;
    c.owner = cc;
    c.wars = [];
    c.allies = [];
    c.cp = 0;            // 건설점수
    c.constructions = []; // [{type:'civ'|'mil', remaining:n}]

    if (c.annexed) {
      const owner = State.countries[c.annexed];
      owner.manpower += c.manpower;
      owner.civFactories += c.civFactories;
      owner.milFactories += c.milFactories;
      owner.army += c.army;
      c.owner = c.annexed;
      c.manpower = 0; c.civFactories = 0; c.milFactories = 0; c.army = 0;
    }
  }

  // 초기 전쟁
  for (const [a,b] of INITIAL_WARS) {
    declareWar(a, b, true);
  }
}

// ============== 화면 그리기 ==============
function renderStartScreen() {
  const sel = document.getElementById('nation-select');
  sel.innerHTML = '';
  for (const cc of PLAYABLE) {
    const c = COUNTRIES[cc];
    const d = PLAYABLE_DESC[cc];
    const card = document.createElement('div');
    card.className = 'nation-card';
    card.innerHTML = `
      <div>
        <span class="flag">${FLAGS[cc]||''}</span>
        <span class="nname">${c.name}</span>
      </div>
      <div class="nfaction">${d.faction}</div>
      <div class="ndesc">${d.desc}</div>
      <div class="nstats">
        <span>인력 ${c.manpower}</span>
        <span>병력 ${c.army}</span>
        <span>공장 ${c.civFactories+c.milFactories}</span>
      </div>
    `;
    card.onclick = () => startGame(cc);
    sel.appendChild(card);
  }
}

function startGame(cc) {
  State.playerCC = cc;
  initGame();
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('player-name').textContent = COUNTRIES[cc].name;
  renderMap();
  selectCountry(cc);
  updateTopBar();
  pushLog('전쟁이 시작되었다. ' + COUNTRIES[cc].name + '의 운명은 당신 손에 달렸다.', 'important');
}

function factionColor(faction) {
  return FACTIONS[faction]?.color || '#666';
}

function ownerColor(cc) {
  const c = State.countries[cc];
  const owner = State.countries[c.owner];
  if (c.owner === State.playerCC) return '#f0c060';
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

  // 국가 polygon
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

    // 병력 수
    const a = document.createElementNS('http://www.w3.org/2000/svg','text');
    a.setAttribute('x', c.cx); a.setAttribute('y', c.cy + 12);
    a.setAttribute('class','country-army');
    a.textContent = c.army > 0 ? `⚔ ${Math.round(c.army)}` : '';
    lblG.appendChild(a);
  }

  refreshSelection();
}

function refreshSelection() {
  document.querySelectorAll('.country-shape').forEach(el => {
    el.classList.remove('selected','adj-attackable');
  });
  if (!State.selectedCC) return;
  const sel = document.querySelector(`.country-shape[data-cc="${State.selectedCC}"]`);
  if (sel) sel.classList.add('selected');

  // 플레이어가 본국 선택했을 때 공격 가능한 이웃 표시
  const player = State.countries[State.playerCC];
  if (State.selectedCC === State.playerCC || State.countries[State.selectedCC].owner === State.playerCC) {
    const sc = State.countries[State.selectedCC];
    for (const n of sc.neighbors) {
      const nb = State.countries[n];
      if (nb && player.wars.includes(nb.owner)) {
        const el = document.querySelector(`.country-shape[data-cc="${n}"]`);
        if (el) el.classList.add('adj-attackable');
      }
    }
  }
}

// ============== 사이드바 ==============
function selectCountry(cc) {
  State.selectedCC = cc;
  const c = State.countries[cc];
  const owner = State.countries[c.owner];

  document.getElementById('cp-name').textContent =
    c.owner === cc ? c.name : `${c.name} (${owner.name} 점령)`;

  const flagLine = document.getElementById('cp-flag-line');
  flagLine.innerHTML = `
    <span class="flag">${FLAGS[c.owner] || FLAGS[cc] || ''}</span>
    <span>소속: <b style="color:${factionColor(owner.faction)}">${FACTIONS[owner.faction].name}</b></span>
  `;

  // 통계
  const isOccupied = c.owner !== cc;
  const eff = isOccupied ? 0.4 : 1.0; // 점령지는 효율 40%
  const stats = document.getElementById('cp-stats');
  stats.innerHTML = `
    <div class="stat"><span class="stat-label">인력</span><span class="stat-val">${Math.round(c.manpower*eff)}K</span></div>
    <div class="stat"><span class="stat-label">민간공장</span><span class="stat-val">${Math.round(c.civFactories*eff)}</span></div>
    <div class="stat"><span class="stat-label">군수공장</span><span class="stat-val">${Math.round(c.milFactories*eff)}</span></div>
    <div class="stat"><span class="stat-label">주둔 병력</span><span class="stat-val">${Math.round(c.army)}K</span></div>
  `;

  // 외교 관계
  const rel = document.getElementById('cp-relations');
  let html = '';
  if (owner.wars.length) {
    html += '<div>전쟁중: ';
    html += owner.wars.map(w => `<span class="rel-tag rel-war">${State.countries[w].name}</span>`).join('');
    html += '</div>';
  }
  if (owner.allies.length) {
    html += '<div>동맹: ';
    html += owner.allies.map(a => `<span class="rel-tag rel-ally">${State.countries[a].name}</span>`).join('');
    html += '</div>';
  }
  if (c.constructions && c.constructions.length) {
    html += '<div style="margin-top:6px;color:var(--accent-bright)">건설중: ' +
      c.constructions.map(x => `${x.type==='civ'?'민간공장':'군수공장'}(${x.remaining}개월)`).join(', ') + '</div>';
  }
  rel.innerHTML = html;

  renderActions(cc);
  refreshSelection();
}

function renderActions(cc) {
  const div = document.getElementById('actions');
  div.innerHTML = '';
  const target = State.countries[cc];
  const player = State.countries[State.playerCC];

  // 자국 행동
  if (target.owner === State.playerCC) {
    addAction(div, '🏭 민간공장 건설', `CP ${COSTS.civ}`, player.cp >= COSTS.civ,
      () => buildFactory(cc, 'civ'));
    addAction(div, '⚙️ 군수공장 건설', `CP ${COSTS.mil}`, player.cp >= COSTS.mil,
      () => buildFactory(cc, 'mil'));
    addAction(div, '👥 병력 모집 (+15K)', `인력 15`, player.manpower >= 15,
      () => recruit(cc, 15));
    addAction(div, '👥 대규모 모집 (+50K)', `인력 50`, player.manpower >= 50,
      () => recruit(cc, 50));
    return;
  }

  // 외국
  const isAtWar = player.wars.includes(target.owner);
  const adjacent = isPlayerAdjacent(target.cc);

  if (!isAtWar && target.owner !== State.playerCC) {
    if (!player.allies.includes(target.owner) && target.owner !== State.playerCC) {
      addAction(div, '⚔️ 선전포고', '', true, () => {
        declareWar(State.playerCC, target.owner);
        selectCountry(cc);
      }, 'danger');
    }
    if (target.faction === player.faction && !player.allies.includes(target.owner)) {
      // 같은 진영이면 동맹 자동
    } else if (target.faction === 'neutral' && !player.allies.includes(target.owner)) {
      addAction(div, '🤝 동맹 제안', '', true, () => {
        if (Math.random() < 0.4) {
          formAlliance(State.playerCC, target.owner);
          modal('동맹 체결', `${target.name}이(가) 동맹 제안을 수락했다!`);
        } else {
          pushLog(`${target.name}이(가) 우리의 동맹 제안을 거절했다.`, 'important');
          modal('거절됨', `${target.name}이(가) 동맹 제안을 거절했다.`);
        }
        selectCountry(cc);
      });
    }
  }

  if (isAtWar) {
    if (adjacent) {
      addAction(div, `⚔️ ${target.name} 공격`, '병력 사용', true, () => {
        attackCountry(State.playerCC, target.cc);
      }, 'danger');
    } else {
      addAction(div, '🚫 인접하지 않음', '', false, ()=>{});
    }
    addAction(div, '🕊️ 강화 제안', '', true, () => {
      proposePeace(State.playerCC, target.owner);
      selectCountry(cc);
    });
  }
}

function addAction(parent, label, cost, enabled, fn, cls='') {
  const b = document.createElement('button');
  b.className = 'action-btn ' + cls;
  b.innerHTML = `<span>${label}</span>${cost?`<span class="cost">${cost}</span>`:''}`;
  b.disabled = !enabled;
  b.onclick = fn;
  parent.appendChild(b);
}

function isPlayerAdjacent(targetCC) {
  // 플레이어가 소유한 영토의 이웃 중에 target이 있는가
  for (const cc in State.countries) {
    const c = State.countries[cc];
    if (c.owner !== State.playerCC) continue;
    if (c.neighbors.includes(targetCC)) return true;
  }
  return false;
}

function onCountryClick(cc) {
  selectCountry(cc);
}

// ============== 게임 메커니즘 ==============
const COSTS = {
  civ: 80,
  mil: 120
};

function pushLog(msg, type='') {
  State.log.unshift({ msg, type });
  if (State.log.length > 30) State.log.pop();
  renderLog();
}

function renderLog() {
  const ul = document.getElementById('log');
  ul.innerHTML = '';
  for (const e of State.log) {
    const li = document.createElement('li');
    li.className = e.type;
    li.textContent = e.msg;
    ul.appendChild(li);
  }
}

function updateTopBar() {
  const p = State.countries[State.playerCC];
  document.getElementById('date-display').textContent = `${State.year}년 ${State.month}월`;
  document.getElementById('r-manpower').textContent = Math.round(p.manpower);
  document.getElementById('r-civ').textContent = p.civFactories;
  document.getElementById('r-mil').textContent = p.milFactories;
  document.getElementById('r-cp').textContent = Math.round(p.cp);
  document.getElementById('r-army').textContent = Math.round(p.army);
}

function declareWar(aCC, bCC, silent=false) {
  const a = State.countries[aCC], b = State.countries[bCC];
  if (!a || !b) return;
  if (!a.wars.includes(bCC)) a.wars.push(bCC);
  if (!b.wars.includes(aCC)) b.wars.push(aCC);
  // 동맹국도 참전
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
  if (!silent) {
    pushLog(`${a.name}이(가) ${b.name}에 선전포고했다!`, 'war');
  }
  renderMap();
}

function formAlliance(aCC, bCC) {
  const a = State.countries[aCC], b = State.countries[bCC];
  if (!a.allies.includes(bCC)) a.allies.push(bCC);
  if (!b.allies.includes(aCC)) b.allies.push(aCC);
  // 진영 통일
  if (a.faction !== 'neutral') b.faction = a.faction;
  else if (b.faction !== 'neutral') a.faction = b.faction;
  pushLog(`${a.name}와(과) ${b.name}이(가) 동맹을 맺었다.`, 'important');
  renderMap();
}

function proposePeace(aCC, bCC) {
  const a = State.countries[aCC], b = State.countries[bCC];
  // 양측 전력 비교
  const aStr = totalStrength(aCC);
  const bStr = totalStrength(bCC);
  // 강자가 약자에게 강화 제안하면 거의 항상 수락
  // 약자가 강자에게 제안하면 강자의 야망에 따라
  const ratio = aStr / (aStr + bStr);
  let accept = false;
  if (ratio < 0.4) accept = true; // 약자가 제안 → 강자가 수락 (자비)
  else if (ratio > 0.6) accept = Math.random() < 0.3; // 강자가 제안 → 약자가 수락
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
  pushLog(`${a.name}와(과) ${b.name}이(가) 강화조약을 체결했다.`, 'important');
  renderMap();
}

function totalStrength(cc) {
  // cc 소유의 모든 영토 합계
  let mp=0, fc=0, mf=0, ar=0;
  for (const k in State.countries) {
    const c = State.countries[k];
    if (c.owner === cc) {
      const eff = (k===cc) ? 1.0 : 0.4;
      mp += c.manpower * eff;
      fc += c.civFactories * eff;
      mf += c.milFactories * eff;
      ar += c.army; // 군은 그대로
    }
  }
  return ar * 1.5 + mp * 0.3 + fc + mf * 2;
}

function buildFactory(cc, type) {
  const player = State.countries[State.playerCC];
  const cost = COSTS[type];
  if (player.cp < cost) return;
  player.cp -= cost;
  const target = State.countries[cc];
  target.constructions = target.constructions || [];
  target.constructions.push({ type, remaining: type==='civ'?3:4 });
  pushLog(`${target.name}에 ${type==='civ'?'민간공장':'군수공장'} 건설 시작.`);
  updateTopBar();
  selectCountry(cc);
}

function recruit(cc, n) {
  const player = State.countries[State.playerCC];
  if (player.manpower < n) return;
  player.manpower -= n;
  const target = State.countries[cc];
  target.army += n;
  pushLog(`${target.name}에서 ${n}K 병력을 모집했다.`);
  updateTopBar();
  selectCountry(cc);
  renderMap();
}

// ============== 전투 ==============
function attackCountry(attackerCC, defenderCC) {
  const att = State.countries[attackerCC]; // 공격국 (수도)
  const def = State.countries[defenderCC]; // 방어 영토 (개별)
  const defOwner = State.countries[def.owner];

  if (att.army < 5) {
    modal('병력 부족', '공격하려면 최소 5K의 병력이 필요하다.');
    return;
  }

  // 인접한 자국 영토에서 출격 (가장 가까운)
  let originCC = attackerCC;
  let originDist = 9999;
  for (const cc in State.countries) {
    const c = State.countries[cc];
    if (c.owner !== attackerCC) continue;
    if (!c.neighbors.includes(defenderCC)) continue;
    if (c.army < 5) continue;
    const d = Math.hypot(c.cx-def.cx, c.cy-def.cy);
    if (d < originDist) { originDist = d; originCC = cc; }
  }
  const origin = State.countries[originCC];

  // 투입 병력: origin 보유의 70%
  const sent = Math.floor(origin.army * 0.7);
  if (sent < 5) {
    modal('전선 병력 부족', `${origin.name} 전선의 병력이 부족하다.`);
    return;
  }

  // 전투 계산
  const attRoll = sent * (0.8 + Math.random()*0.5);
  const defRoll = def.army * 1.3 * (0.8 + Math.random()*0.5);
  const totalCasualties = Math.min(sent, def.army) * 0.4;

  let result;
  if (attRoll > defRoll) {
    // 공격 성공
    const attLoss = Math.round(totalCasualties * 0.6);
    const defLoss = Math.round(def.army);
    origin.army = Math.max(0, origin.army - attLoss);
    def.army = 0;
    // 점령
    const prevOwner = def.owner;
    def.owner = attackerCC;
    pushLog(`⚔️ ${att.name}이(가) ${def.name}을(를) 점령! (피해 ${attLoss}K)`, 'victory');

    // 본국 점령시 강제 강화 / 멸망
    if (defenderCC === defOwner.cc) {
      onCapitalFall(defenderCC, attackerCC);
    }
    result = 'win';
  } else {
    // 공격 실패
    const attLoss = Math.round(totalCasualties * 1.0);
    const defLoss = Math.round(totalCasualties * 0.5);
    origin.army = Math.max(0, origin.army - attLoss);
    def.army = Math.max(0, def.army - defLoss);
    pushLog(`✗ ${att.name}의 ${def.name} 공격 실패! (아군 ${attLoss}K, 적 ${defLoss}K 손실)`, 'war');
    result = 'lose';
  }

  updateTopBar();
  renderMap();
  selectCountry(defenderCC);
  return result;
}

function onCapitalFall(fallenCC, conquerorCC) {
  const fallen = State.countries[fallenCC];
  const conqueror = State.countries[conquerorCC];
  pushLog(`💀 ${fallen.name}의 수도가 함락! 정부가 항복했다.`, 'victory');

  // fallen이 소유한 모든 영토를 conqueror로 이전
  for (const cc in State.countries) {
    const c = State.countries[cc];
    if (c.owner === fallenCC) c.owner = conquerorCC;
  }
  // 동맹/전쟁 정리
  fallen.wars.forEach(w => {
    State.countries[w].wars = State.countries[w].wars.filter(x => x !== fallenCC);
  });
  fallen.wars = [];
  fallen.allies.forEach(a => {
    State.countries[a].allies = State.countries[a].allies.filter(x => x !== fallenCC);
  });
  fallen.allies = [];

  if (fallenCC === State.playerCC) {
    gameOver(false);
  } else {
    checkVictory();
  }
}

// ============== 턴 진행 ==============
function nextTurn() {
  if (State.gameOver) return;
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
    if (completed.length && c.owner === State.playerCC) {
      pushLog(`${c.name}에서 ${completed.length}개 공장 건설 완료!`, 'important');
    }
  }

  // 2. 생산: 각 국가가 자기 소유의 모든 영토에서 수확
  for (const ownerCC in State.countries) {
    if (State.countries[ownerCC].owner !== ownerCC) continue; // 멸망국 스킵
    const owner = State.countries[ownerCC];
    let totalCiv = 0, totalMil = 0, totalMpRegen = 0;
    for (const tcc in State.countries) {
      const t = State.countries[tcc];
      if (t.owner !== ownerCC) continue;
      const eff = (tcc === ownerCC) ? 1.0 : 0.4;
      totalCiv += t.civFactories * eff;
      totalMil += t.milFactories * eff;
      totalMpRegen += t.manpower * 0.005 * eff;
    }
    // 건설점수
    owner.cp += totalCiv * 5;
    // 군수공장 → 병력 자동 보충 (수도)
    const equip = totalMil * 2;
    const recruitable = Math.min(equip, owner.manpower);
    owner.army += recruitable;
    owner.manpower -= recruitable;
    // 인력 회복
    owner.manpower += totalMpRegen;
  }

  // 3. AI 행동
  aiActions();

  // 4. 전투 자동 (AI vs AI)
  aiCombat();

  // 5. 시간 진행
  State.month++;
  if (State.month > 12) { State.month = 1; State.year++; }

  // 6. 승리 체크
  checkVictory();

  updateTopBar();
  renderMap();
  if (State.selectedCC) selectCountry(State.selectedCC);
}

// ============== AI ==============
function aiActions() {
  for (const cc in State.countries) {
    if (cc === State.playerCC) continue;
    const c = State.countries[cc];
    if (c.owner !== cc) continue; // 멸망
    if (!c.ai) continue;

    // 진영 자동 합류 (전쟁이 격화되면)
    if (c.wantsFaction && c.faction === 'neutral') {
      // 일정 확률로 합류
      if (Math.random() < 0.04 * (State.turn / 6 + 1)) {
        joinFaction(cc, c.wantsFaction);
      }
    }

    // 건설
    if (c.cp >= COSTS.mil && Math.random() < 0.6) {
      c.cp -= COSTS.mil;
      c.constructions = c.constructions || [];
      c.constructions.push({ type:'mil', remaining: 4 });
    } else if (c.cp >= COSTS.civ && Math.random() < 0.7) {
      c.cp -= COSTS.civ;
      c.constructions = c.constructions || [];
      c.constructions.push({ type:'civ', remaining: 3 });
    }

    // 모집
    if (c.manpower >= 30 && Math.random() < 0.5) {
      const n = Math.min(30, c.manpower);
      c.manpower -= n; c.army += n;
    }

    // 선전포고: AI의 target 리스트에서 약한 이웃 침공
    if (c.ai.target.length && c.wars.length < 3 && Math.random() < c.ai.aggression * 0.08) {
      for (const tg of c.ai.target) {
        const t = State.countries[tg];
        if (!t || t.owner !== tg) continue;
        if (c.wars.includes(tg)) continue;
        // 인접한지 확인 (자국 또는 점령지에서)
        let adj = false;
        for (const k in State.countries) {
          if (State.countries[k].owner === cc && State.countries[k].neighbors.includes(tg)) { adj = true; break; }
        }
        if (!adj) continue;
        // 전력 비교
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
  pushLog(`📢 ${c.name}이(가) ${FACTIONS[faction].name}에 가담했다!`, 'important');
  // 진영 동맹 자동 연결
  for (const k in State.countries) {
    const o = State.countries[k];
    if (k === cc) continue;
    if (o.faction === faction && o.owner === k) {
      if (!c.allies.includes(k)) c.allies.push(k);
      if (!o.allies.includes(cc)) o.allies.push(cc);
      // 적의 적과 자동 전쟁
      for (const e of o.wars) {
        if (State.countries[e].faction && State.countries[e].faction !== faction && !c.wars.includes(e)) {
          declareWar(cc, e, true);
        }
      }
    }
  }
  renderMap();
}

function aiCombat() {
  // 각 AI 국가는 자기 전쟁 상대 중 인접한 약한 영토를 공격
  const order = Object.keys(State.countries).sort(()=>Math.random()-0.5);
  for (const cc of order) {
    if (cc === State.playerCC) continue;
    const c = State.countries[cc];
    if (c.owner !== cc) continue;
    if (!c.wars.length) continue;
    if (c.army < 10) continue;

    // 인접한 적 영토들
    const targets = [];
    for (const k in State.countries) {
      const t = State.countries[k];
      if (!c.wars.includes(t.owner)) continue;
      // 자국 또는 점령지에서 인접
      for (const j in State.countries) {
        if (State.countries[j].owner !== cc) continue;
        if (State.countries[j].neighbors.includes(k)) { targets.push(k); break; }
      }
    }
    if (!targets.length) continue;

    // 약한 영토 우선
    targets.sort((a,b) => State.countries[a].army - State.countries[b].army);
    const target = targets[0];
    const aggression = c.ai ? c.ai.aggression : 0.5;
    if (Math.random() < aggression * 0.6) {
      attackCountry(cc, target);
    }
  }
}

// ============== 승리/패배 ==============
function checkVictory() {
  const player = State.countries[State.playerCC];
  const playerFaction = player.faction;

  // 모든 강대국이 같은 진영이거나 점령됨?
  const majors = ['GER','GBR','FRA','ITA','USR','POL'];
  let allConquered = true;
  for (const m of majors) {
    if (m === State.playerCC) continue;
    const c = State.countries[m];
    if (c.owner === m) {
      // 살아있음. 같은 진영인지 확인
      if (c.faction !== playerFaction || playerFaction === 'neutral') {
        // 같은 진영도 아니고 점령도 안됐으면 미완성
        allConquered = false;
        break;
      }
    } else if (State.countries[c.owner].faction !== playerFaction) {
      allConquered = false;
      break;
    }
  }

  if (allConquered) {
    gameOver(true);
    return;
  }

  // 1948년까지 진행되면 평화
  if (State.year >= 1948) {
    gameOver(null);
  }
}

function gameOver(win) {
  State.gameOver = true;
  if (win === true) {
    modal('🏆 승리!', `${State.year}년 ${State.month}월, ${State.countries[State.playerCC].name}이(가) 유럽의 패권을 차지했다!`);
  } else if (win === false) {
    modal('💀 패배', `${State.countries[State.playerCC].name}의 수도가 함락되었다. 우리의 전쟁은 끝났다.`);
  } else {
    modal('🕊️ 종전', `1948년, 전쟁은 결판없이 끝났다.`);
  }
}

// ============== 모달 ==============
function modal(title, body) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  document.getElementById('modal').classList.remove('hidden');
}

// ============== 초기화 ==============
document.addEventListener('DOMContentLoaded', () => {
  renderStartScreen();
  document.getElementById('next-turn-btn').onclick = nextTurn;
  document.getElementById('modal-close').onclick = () => {
    document.getElementById('modal').classList.add('hidden');
    if (State.gameOver) {
      // 시작 화면으로 복귀
      document.getElementById('game-screen').classList.add('hidden');
      document.getElementById('start-screen').classList.remove('hidden');
      State.gameOver = false;
      State.year = 1939; State.month = 9; State.turn = 0;
      State.log = []; State.selectedCC = null;
    }
  };
});
