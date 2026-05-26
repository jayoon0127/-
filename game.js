// 역전재판: 숙제 안 한 자의 변론 — 게임 로직

const State = {
  hp: 100,
  maxHp: 100,
  roundIndex: 0,
  currentRound: null,
  currentExcuse: null,
  honestWin: false,
  typing: false,
  typingTimer: null,
  pendingResolve: null,
  inventory: {}  // evidence keys -> true
};

// ===== DOM =====
const $ = (sel) => document.querySelector(sel);
const titleScreen = $('#title-screen');
const gameScreen = $('#game-screen');
const verdictScreen = $('#verdict-screen');
const dialogBox = $('#dialog-box');
const dialogText = $('#dialog-text');
const speakerName = $('#speaker-name');
const dialogNext = $('#dialog-next');
const choicesEl = $('#choices');
const actionBar = $('#action-bar');
const evidencePanel = $('#evidence-panel');
const evidenceList = $('#evidence-list');
const teacherSprite = $('#teacher-sprite');
const studentSprite = $('#student-sprite');
const teacherFace = $('#teacher-face');
const studentFace = $('#student-face');
const hpFill = $('#hp-fill');
const hpText = $('#hp-text');
const courtBg = $('#court-bg');

// ===== Audio (Web Audio synth — no external files) =====
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
  }
}
function beep(freq = 440, dur = 0.08, type = 'square', vol = 0.08) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = vol;
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}
function shout(kind = 'objection') {
  if (!audioCtx) return;
  // 음 시퀀스로 외침 효과
  const base = kind === 'objection' ? 220 : kind === 'takethat' ? 260 : 300;
  const seq = [base, base * 1.4, base * 1.05, base * 1.6];
  seq.forEach((f, i) => {
    setTimeout(() => beep(f, 0.12, 'sawtooth', 0.14), i * 60);
  });
}
function thump() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(120, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.25);
  gain.gain.value = 0.25;
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

// ===== Helpers =====
function setHP(newHp) {
  State.hp = Math.max(0, Math.min(State.maxHp, newHp));
  const pct = (State.hp / State.maxHp) * 100;
  hpFill.style.width = pct + '%';
  hpText.textContent = `${State.hp} / ${State.maxHp}`;
  hpFill.classList.remove('warning', 'danger');
  if (pct <= 30) hpFill.classList.add('danger');
  else if (pct <= 60) hpFill.classList.add('warning');
}

function setFace(who, emoji) {
  if (who === 'teacher') teacherFace.textContent = emoji;
  else if (who === 'student') studentFace.textContent = emoji;
}

function spotlight(who) {
  if (who === 'teacher') {
    teacherSprite.classList.add('active');
    teacherSprite.classList.remove('dimmed');
    studentSprite.classList.add('dimmed');
    studentSprite.classList.remove('active');
    setTimeout(() => teacherSprite.classList.remove('active'), 600);
  } else if (who === 'student') {
    studentSprite.classList.add('active');
    studentSprite.classList.remove('dimmed');
    teacherSprite.classList.add('dimmed');
    teacherSprite.classList.remove('active');
    setTimeout(() => studentSprite.classList.remove('active'), 600);
  } else {
    teacherSprite.classList.remove('dimmed', 'active');
    studentSprite.classList.remove('dimmed', 'active');
  }
}

function shakeSprite(who) {
  const sp = who === 'teacher' ? teacherSprite : studentSprite;
  sp.classList.add('shake');
  setTimeout(() => sp.classList.remove('shake'), 400);
  thump();
}

function flash(kind = 'flash') {
  courtBg.classList.add(kind);
  setTimeout(() => courtBg.classList.remove(kind), 500);
}

// ===== Dialog (typewriter with skip) =====
function buildSegments(html) {
  // Parse HTML into [{ ch, style }] tokens
  const wrapper = document.createElement('span');
  wrapper.innerHTML = html;
  const tokens = [];
  function walk(node, style) {
    if (node.nodeType === 3) {
      for (const ch of node.textContent) tokens.push({ ch, style });
    } else if (node.nodeType === 1) {
      const cls = node.getAttribute('class') || style;
      for (const c of node.childNodes) walk(c, cls);
    }
  }
  walk(wrapper, '');
  return tokens;
}
function renderTokens(tokens, n) {
  let buf = '';
  let lastCls = '';
  for (let i = 0; i < n && i < tokens.length; i++) {
    const { ch, style } = tokens[i];
    if (style !== lastCls) {
      if (lastCls) buf += '</span>';
      if (style) buf += `<span class="${style}">`;
      lastCls = style;
    }
    buf += ch === '\n' ? '<br>' : escapeChar(ch);
  }
  if (lastCls) buf += '</span>';
  return buf;
}
function escapeChar(c) {
  if (c === '<') return '&lt;';
  if (c === '>') return '&gt;';
  if (c === '&') return '&amp;';
  return c;
}

function say(speakerKey, displayName, face, htmlText) {
  return new Promise((resolve) => {
    speakerName.textContent = displayName;
    if (speakerKey === 'teacher' || speakerKey === 'student') {
      spotlight(speakerKey);
      if (face) setFace(speakerKey, face);
    } else {
      spotlight(null);
    }

    const tokens = buildSegments(htmlText);
    let i = 0;
    let timer = null;
    let done = false;
    State.typing = true;
    dialogText.innerHTML = '';
    dialogNext.classList.add('hidden');

    function tick() {
      i++;
      dialogText.innerHTML = renderTokens(tokens, i);
      if (i % 3 === 0 && tokens[i - 1] && tokens[i - 1].ch.trim()) {
        beep(660 + Math.random() * 80, 0.02, 'square', 0.03);
      }
      if (i >= tokens.length) {
        finishTyping();
        return;
      }
      timer = setTimeout(tick, 22);
    }
    function finishTyping() {
      if (timer) { clearTimeout(timer); timer = null; }
      i = tokens.length;
      dialogText.innerHTML = renderTokens(tokens, i);
      State.typing = false;
      dialogNext.classList.remove('hidden');
    }
    function onAdvance(e) {
      if (e && e.target && (
        e.target.closest('#choices') ||
        e.target.closest('#action-bar') ||
        e.target.closest('#evidence-panel')
      )) return;
      if (State.typing) {
        finishTyping();
        return;
      }
      if (done) return;
      done = true;
      document.removeEventListener('click', onAdvance);
      document.removeEventListener('keydown', onKey);
      resolve();
    }
    function onKey(e) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        onAdvance({ target: document.body });
      }
    }
    document.addEventListener('click', onAdvance);
    document.addEventListener('keydown', onKey);
    timer = setTimeout(tick, 22);
  });
}

// ===== Overlays =====
function showOverlay(id, ms = 1100) {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  // restart animation
  const inner = el.firstElementChild;
  inner.style.animation = 'none';
  // force reflow
  void inner.offsetWidth;
  inner.style.animation = '';
  return new Promise((resolve) => {
    setTimeout(() => {
      el.classList.add('hidden');
      resolve();
    }, ms);
  });
}

async function objection() {
  flash('redflash');
  shout('objection');
  shakeSprite('student');
  await showOverlay('objection-overlay', 1200);
}
async function takeThat() {
  flash('flash');
  shout('takethat');
  shakeSprite('teacher');
  await showOverlay('takethat-overlay', 1200);
}
async function holdIt() {
  flash('flash');
  shout('holdit');
  await showOverlay('holdit-overlay', 900);
}

// ===== Choices =====
function showChoices(options, label = null) {
  return new Promise((resolve) => {
    choicesEl.innerHTML = '';
    choicesEl.classList.remove('hidden');
    options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = `${i + 1}. ${opt.text}`;
      btn.onclick = () => {
        choicesEl.classList.add('hidden');
        beep(660, 0.06, 'square', 0.1);
        resolve(opt);
      };
      choicesEl.appendChild(btn);
    });
  });
}

function showActionBar() {
  return new Promise((resolve) => {
    actionBar.classList.remove('hidden');
    const handlers = {};
    actionBar.querySelectorAll('.action-btn').forEach((btn) => {
      const action = btn.dataset.action;
      const h = () => {
        actionBar.classList.add('hidden');
        actionBar.querySelectorAll('.action-btn').forEach((b) => {
          b.removeEventListener('click', handlers[b.dataset.action]);
        });
        beep(880, 0.06, 'square', 0.1);
        resolve(action);
      };
      handlers[action] = h;
      btn.addEventListener('click', h);
    });
  });
}

function showEvidence() {
  return new Promise((resolve) => {
    evidenceList.innerHTML = '';
    const keys = Object.keys(State.inventory).filter((k) => State.inventory[k]);
    if (keys.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'grid-column: 1/-1; text-align:center; color:#888; padding:20px;';
      empty.textContent = '(가진 증거가 없다...)';
      evidenceList.appendChild(empty);
    }
    keys.forEach((k) => {
      const ev = EVIDENCE[k];
      const item = document.createElement('div');
      item.className = 'evidence-item';
      item.innerHTML = `<div class="evidence-icon">${ev.icon}</div><div class="evidence-name">${ev.name}</div>`;
      item.title = ev.desc;
      item.onclick = () => {
        evidencePanel.classList.add('hidden');
        beep(880, 0.06, 'square', 0.1);
        resolve(k);
      };
      evidenceList.appendChild(item);
    });
    evidencePanel.classList.remove('hidden');
    const cancel = $('#cancel-evidence');
    const onCancel = () => {
      cancel.removeEventListener('click', onCancel);
      evidencePanel.classList.add('hidden');
      resolve(null);
    };
    cancel.addEventListener('click', onCancel);
  });
}

// ===== Main flow =====
async function startGame() {
  ensureAudio();
  titleScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  State.hp = State.maxHp = 100;
  State.roundIndex = 0;
  State.honestWin = false;
  // 학생은 모든 증거를 보유
  State.inventory = {};
  Object.keys(EVIDENCE).forEach((k) => { State.inventory[k] = true; });
  setHP(100);

  // 인트로
  for (const line of INTRO_SCRIPT) {
    if (line.speaker === 'narrator') {
      await say('narrator', line.name, null, line.text);
    } else if (line.speaker === 'teacher') {
      await say('teacher', line.name, line.face, line.text);
    } else {
      await say('student', line.name, line.face, line.text);
    }
    if (State.hp <= 0) break;
  }

  // 라운드 진행
  for (State.roundIndex = 0; State.roundIndex < ROUNDS.length; State.roundIndex++) {
    if (State.hp <= 0) break;
    const finished = await playRound(ROUNDS[State.roundIndex]);
    if (finished === 'honest') { State.honestWin = true; break; }
    if (State.hp <= 0) break;
  }

  await endGame();
}

async function playRound(round) {
  State.currentRound = round;
  // 선생님의 질문
  await say('teacher', '영어학원 선생님', round.question.face, round.question.text);

  // 학생이 변명 선택
  await say('narrator', '— 변명을 선택하라 —', null, '어떻게 대답할 것인가...?');
  const excuse = await showChoices(round.excuses);
  State.currentExcuse = excuse;

  // 학생이 변명을 말함
  await say('student', '학생 (나)', '😬', excuse.studentLine);

  // 선생님이 OBJECTION! → AI 반박
  await objection();
  await say('teacher', '영어학원 선생님', excuse.rebuttal.face, excuse.rebuttal.text);

  // 정직 자백은 즉시 honest 엔딩으로
  if (excuse.honest) {
    setHP(State.hp - excuse.damage);
    await say('student', '학생 (나)', '😌', '...정말 죄송합니다. 다음부터는 미리 할게요.');
    return 'honest';
  }

  // 학생 행동 선택 루프
  let resolved = false;
  while (!resolved) {
    if (State.hp <= 0) break;
    await say('narrator', '— 어떻게 대응할 것인가? —', null,
      '<span class="emph">이의제기</span>: 말로 반박 (도박)\n<span class="emph">증거제출</span>: 인벤토리에서 증거 제시 (정공법)\n<span class="emph">자백</span>: 변명 포기 (피해 최소)');
    const action = await showActionBar();

    if (action === 'argue') {
      // 말로 반박 — 약점이 없으면 큰 피해
      await holdIt();
      await say('student', '학생 (나)', '😤', '잠깐만요! 그건 말이 안 돼요! 그러니까... 어... 그게...');
      if (excuse.weakness) {
        // 증거가 필요한데 말로만 반박 → 부분 피해
        setHP(State.hp - Math.floor(excuse.damage * 0.7));
        await say('teacher', '영어학원 선생님', '😏',
          '<span class="emph">근거가 뭐냐?</span> ChatGPT는 근거 없는 주장을 인정하지 않는다.');
        resolved = false;  // 다시 선택
      } else {
        // 약점이 없다 = 그 변명은 어차피 반박 불가
        setHP(State.hp - excuse.damage);
        await say('teacher', '영어학원 선생님', '😤', '말장난은 그만하자.');
        resolved = true;
      }
    } else if (action === 'evidence') {
      const key = await showEvidence();
      if (!key) continue;
      const ev = EVIDENCE[key];
      // 일치하는 증거인가?
      if (excuse.weakness && ev.counters.includes(excuse.weakness)) {
        await takeThat();
        await say('student', '학생 (나)', '😎', ev.counterLine);
        await say('teacher', '영어학원 선생님', '😱',
          '<span class="emph">뭐... 뭐라고?!</span> 이... 이건 예상 못 했다!');
        await say('teacher', '영어학원 선생님', '😣',
          '(ChatGPT한테 어떻게 반박해야 하지... 으...) 좋다, 이 라운드는 너의 승리다.');
        // 적중 보너스
        setHP(State.hp + 10);
        resolved = true;
      } else {
        // 엉뚱한 증거
        setHP(State.hp - 20);
        await say('teacher', '영어학원 선생님', '😏',
          `<span class="emph">${ev.name}?</span> 그게 지금 이 변명이랑 무슨 상관이지?`);
        resolved = false;
      }
    } else if (action === 'admit') {
      setHP(State.hp - Math.floor(excuse.damage * 0.4));
      await say('student', '학생 (나)', '😞', '...죄송해요. 그 변명은 거짓말이었어요.');
      await say('teacher', '영어학원 선생님', '😐', '솔직한 건 봐주마. 하지만 점수는 깎인다.');
      resolved = true;
    }
  }
  return 'continue';
}

async function endGame() {
  let ending;
  if (State.honestWin) ending = ENDINGS.honest;
  else if (State.hp <= 0) ending = ENDINGS.lose;
  else ending = ENDINGS.win;

  // 결말 대사
  spotlight(null);
  if (ending === ENDINGS.win) {
    await say('teacher', '영어학원 선생님', '😵', '...내... 내가 졌다. 너의 변론은 완벽했다.');
    await say('teacher', '영어학원 선생님', '😈', '하지만 다음 주 숙제는 두 배다.');
    await say('student', '학생 (나)', '😎', '(이겼다... 하지만 진정한 적은 다음 주의 나다...)');
  } else if (ending === ENDINGS.lose) {
    await say('teacher', '영어학원 선생님', '😤', '신뢰도 0. <span class="emph">유죄!</span>');
    await say('teacher', '영어학원 선생님', '📞', '어머님께 전화 한 통 드릴게.');
    await say('student', '학생 (나)', '😭', '아아... 끝났다...');
  } else {
    await say('student', '학생 (나)', '🙏', '정말 죄송해요. 다음부터는 절대 안 까먹을게요.');
    await say('teacher', '영어학원 선생님', '😌', '...그래. 가봐.');
  }

  // 평결 화면
  gameScreen.classList.add('hidden');
  verdictScreen.classList.remove('hidden');
  const title = $('#verdict-title');
  title.textContent = ending.title;
  title.className = '';
  title.classList.add(ending.titleClass);
  $('#verdict-desc').textContent = ending.desc;
  // 효과음
  if (ending === ENDINGS.lose) {
    shout('objection');
  } else {
    shout('takethat');
  }
}

// ===== Init =====
$('#start-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  ensureAudio();
  // 다음 tick에 startGame을 호출해서 이 click 이벤트가
  // 다이얼로그 advance로 잘못 잡히지 않게 한다.
  setTimeout(startGame, 0);
});
$('#restart-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  verdictScreen.classList.add('hidden');
  titleScreen.classList.remove('hidden');
});

// 키보드: 숫자키로 선택지 선택
document.addEventListener('keydown', (e) => {
  if (choicesEl.classList.contains('hidden')) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 9) {
    const btn = choicesEl.querySelectorAll('.choice-btn')[n - 1];
    if (btn) btn.click();
  }
});
