// 역전재판: 숙제 안 한 자의 변론 — AI Edition
// 학생(플레이어)가 자유 입력 → Claude API가 선생님의 반박을 생성

const State = {
  hp: 100,
  maxHp: 100,
  round: 0,
  conversation: [],  // [{role: 'user'|'assistant', content: string}, ...] — Claude API 형식
  typing: false,
  busy: false,       // API 호출 중
};

const LS_KEY = 'aceattorney_hw_gemini_key';
const LS_MODEL = 'aceattorney_hw_gemini_model';

// ===== DOM =====
const $ = (s) => document.querySelector(s);
const titleScreen = $('#title-screen');
const gameScreen = $('#game-screen');
const verdictScreen = $('#verdict-screen');
const apikeyModal = $('#apikey-modal');
const dialogText = $('#dialog-text');
const speakerName = $('#speaker-name');
const dialogNext = $('#dialog-next');
const teacherSprite = $('#teacher-sprite');
const studentSprite = $('#student-sprite');
const teacherFace = $('#teacher-face');
const studentFace = $('#student-face');
const hpFill = $('#hp-fill');
const hpText = $('#hp-text');
const roundText = $('#round-text');
const courtBg = $('#court-bg');
const inputArea = $('#input-area');
const studentInput = $('#student-input');
const submitBtn = $('#submit-btn');
const giveupBtn = $('#giveup-btn');
const thinkingOverlay = $('#thinking-overlay');

// ===== Audio =====
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
function shout(kind) {
  if (!audioCtx) return;
  const base = kind === 'objection' ? 220 : kind === 'takethat' ? 260 : 300;
  [base, base * 1.4, base * 1.05, base * 1.6].forEach((f, i) => {
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
function setRound(n) {
  State.round = n;
  roundText.textContent = `라운드 ${n} / ${MAX_ROUNDS}`;
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
function flashEffect(kind) {
  courtBg.classList.add(kind);
  setTimeout(() => courtBg.classList.remove(kind), 500);
}

// ===== Dialog (typewriter) =====
// 인용된 텍스트를 안전하게 렌더링: <강조></강조> 또는 <span class="emph"></span>만 허용
function sanitizeText(text) {
  // Convert <강조>...</강조> → <span class="emph">...</span>
  // and strip everything else
  let s = String(text || '');
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/&lt;강조&gt;/g, '<span class="emph">').replace(/&lt;\/강조&gt;/g, '</span>');
  // 이미 escape된 <span class="emph">와 </span>은 그대로 두기 위해, INTRO 등에서 쓰는 원본 <span class="emph"> 패턴도 허용
  s = s.replace(/&lt;span class=&quot;emph&quot;&gt;/g, '<span class="emph">');
  s = s.replace(/&lt;span class="emph"&gt;/g, '<span class="emph">');
  s = s.replace(/&lt;\/span&gt;/g, '</span>');
  return s;
}

function buildSegments(htmlSafe) {
  // htmlSafe is already-safe HTML — only contains <span class="emph"> and </span>
  const wrap = document.createElement('span');
  wrap.innerHTML = htmlSafe;
  const tokens = [];
  function walk(node, style) {
    if (node.nodeType === 3) {
      for (const ch of node.textContent) tokens.push({ ch, style });
    } else if (node.nodeType === 1) {
      const cls = node.getAttribute('class') || style;
      for (const c of node.childNodes) walk(c, cls);
    }
  }
  walk(wrap, '');
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
    if (ch === '\n') buf += '<br>';
    else if (ch === '<') buf += '&lt;';
    else if (ch === '>') buf += '&gt;';
    else if (ch === '&') buf += '&amp;';
    else buf += ch;
  }
  if (lastCls) buf += '</span>';
  return buf;
}

function say(speakerKey, displayName, face, rawText, opts = {}) {
  return new Promise((resolve) => {
    speakerName.textContent = displayName;
    if (speakerKey === 'teacher' || speakerKey === 'student') {
      spotlight(speakerKey);
      if (face) setFace(speakerKey, face);
    } else {
      spotlight(null);
    }
    const html = sanitizeText(rawText);
    const tokens = buildSegments(html);
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
        finish();
        return;
      }
      timer = setTimeout(tick, 22);
    }
    function finish() {
      if (timer) { clearTimeout(timer); timer = null; }
      i = tokens.length;
      dialogText.innerHTML = renderTokens(tokens, i);
      State.typing = false;
      dialogNext.classList.remove('hidden');
    }
    function advance(e) {
      if (e && e.target && (
        e.target.closest('#input-area') ||
        e.target.closest('#thinking-overlay') ||
        e.target.closest('#reset-key-btn') ||
        e.target.closest('#hp-bar-wrap')
      )) return;
      if (State.typing) { finish(); return; }
      if (done) return;
      done = true;
      document.removeEventListener('click', advance);
      document.removeEventListener('keydown', onKey);
      resolve();
    }
    function onKey(e) {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (document.activeElement === studentInput) return;
        e.preventDefault();
        advance({ target: document.body });
      }
    }
    document.addEventListener('click', advance);
    document.addEventListener('keydown', onKey);
    timer = setTimeout(tick, 22);
  });
}

// ===== Overlays =====
function showOverlay(id, ms = 1100) {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  const inner = el.firstElementChild;
  inner.style.animation = 'none';
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
  flashEffect('redflash'); shout('objection'); shakeSprite('student');
  await showOverlay('objection-overlay', 1200);
}
async function takeThat() {
  flashEffect('flash'); shout('takethat'); shakeSprite('teacher');
  await showOverlay('takethat-overlay', 1200);
}
async function holdIt() {
  flashEffect('flash'); shout('holdit');
  await showOverlay('holdit-overlay', 900);
}

// ===== Input =====
function showInput() {
  return new Promise((resolve) => {
    inputArea.classList.remove('hidden');
    studentInput.value = '';
    studentInput.disabled = false;
    submitBtn.disabled = false;
    giveupBtn.disabled = false;
    setTimeout(() => studentInput.focus(), 50);

    function cleanup() {
      submitBtn.removeEventListener('click', onSubmit);
      giveupBtn.removeEventListener('click', onGiveUp);
      studentInput.removeEventListener('keydown', onKey);
      inputArea.classList.add('hidden');
    }
    function onSubmit() {
      const text = studentInput.value.trim();
      if (!text) {
        studentInput.focus();
        return;
      }
      beep(660, 0.06, 'square', 0.1);
      cleanup();
      resolve({ type: 'argue', text });
    }
    function onGiveUp() {
      beep(220, 0.1, 'sawtooth', 0.1);
      cleanup();
      resolve({ type: 'giveup' });
    }
    function onKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    }
    submitBtn.addEventListener('click', onSubmit);
    giveupBtn.addEventListener('click', onGiveUp);
    studentInput.addEventListener('keydown', onKey);
  });
}

// ===== Gemini API =====
async function callGemini(userText) {
  const apiKey = localStorage.getItem(LS_KEY);
  const model = localStorage.getItem(LS_MODEL) || 'gemini-2.5-flash';
  if (!apiKey) throw new Error('API 키가 없습니다.');

  // Gemini 대화 형식: { role: 'user'|'model', parts: [{text}] }
  State.conversation.push({ role: 'user', parts: [{ text: userText }] });

  const generationConfig = {
    responseMimeType: 'application/json',
    responseSchema: REBUTTAL_SCHEMA,
    maxOutputTokens: 2048,
    temperature: 1.0
  };
  // flash 계열은 thinking 끄고 속도 우선 (pro는 thinking 유지)
  if (model.includes('flash')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: State.conversation,
    generationConfig
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    let detail = '';
    try {
      const errBody = await resp.json();
      detail = errBody?.error?.message || JSON.stringify(errBody);
    } catch (e) {
      detail = await resp.text();
    }
    throw new Error(`API ${resp.status}: ${detail}`);
  }

  const data = await resp.json();
  const cand = data.candidates && data.candidates[0];
  if (!cand) {
    const reason = data.promptFeedback?.blockReason;
    throw new Error('AI 응답 없음' + (reason ? ` (콘텐츠 차단: ${reason})` : ''));
  }
  const parts = (cand.content && cand.content.parts) || [];
  const textPart = parts.map((p) => p.text).filter(Boolean).join('');
  if (!textPart) {
    throw new Error('API 응답에 텍스트가 없습니다. (finishReason: ' + (cand.finishReason || '?') + ')');
  }

  let parsed;
  try {
    parsed = JSON.parse(textPart);
  } catch (e) {
    throw new Error('AI 응답 JSON 파싱 실패: ' + textPart.slice(0, 200));
  }

  // 모델 응답을 conversation에도 저장 (다음 라운드 컨텍스트용)
  State.conversation.push({ role: 'model', parts: [{ text: textPart }] });

  return parsed;
}

// ===== Game Flow =====
async function startGame() {
  ensureAudio();
  titleScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  State.hp = State.maxHp = 100;
  State.conversation = [];
  setHP(100);
  setRound(0);

  // 인트로
  for (const line of INTRO_SCRIPT) {
    if (line.speaker === 'narrator') {
      await say('narrator', line.name, null, line.text);
    } else {
      await say(line.speaker, line.name, line.face, line.text);
    }
  }

  // 라운드 루프
  for (let r = 1; r <= MAX_ROUNDS; r++) {
    setRound(r);
    // 선생님의 질문
    const q = r === 1 ? OPENING_QUESTION : FOLLOWUP_QUESTIONS[r - 2] || FOLLOWUP_QUESTIONS[FOLLOWUP_QUESTIONS.length - 1];
    await say('teacher', '영어학원 선생님', q.face, q.text);

    // 학생 입력
    const action = await showInput();
    if (action.type === 'giveup') {
      await say('student', '학생 (나)', '😞', '...죄송합니다. 사실 그냥 안 한 거예요.');
      return endGame('guilty', '자백');
    }

    // 학생 대사 표시
    await say('student', '학생 (나)', '😬', action.text);

    // OBJECTION! → API 호출
    await objection();

    let aiResult;
    try {
      thinkingOverlay.classList.remove('hidden');
      aiResult = await callGemini(action.text);
    } catch (err) {
      thinkingOverlay.classList.add('hidden');
      await say('narrator', '— 시스템 오류 —', null, `<span class="emph">API 호출 실패:</span>\n${err.message}\n\nAPI 키나 네트워크를 확인하세요.`);
      // 키 재설정 모달로
      gameScreen.classList.add('hidden');
      openApiKeyModal(err.message);
      return;
    } finally {
      thinkingOverlay.classList.add('hidden');
    }

    // 반박 표시
    await say('teacher', '영어학원 선생님', '😏', aiResult.rebuttal);

    // 데미지 적용
    const dmg = Math.max(0, Math.min(30, parseInt(aiResult.damage, 10) || 0));
    if (dmg > 0) {
      setHP(State.hp - dmg);
    }

    // 평결 체크
    if (aiResult.verdict === 'notguilty') {
      await takeThat();
      await say('student', '학생 (나)', '😎', '(이겼다... 선생님의 ChatGPT가 패배했다...!)');
      return endGame('notguilty');
    }
    if (aiResult.verdict === 'guilty' || State.hp <= 0) {
      await say('student', '학생 (나)', '😭', '아... 아니... 끝났다...');
      return endGame('guilty');
    }
  }

  // 라운드 다 씀
  if (State.hp >= 50) {
    return endGame('notguilty');
  }
  return endGame('timeout');
}

async function endGame(verdictKey, note) {
  const ending = ENDINGS[verdictKey] || ENDINGS.guilty;
  spotlight(null);
  if (verdictKey === 'notguilty') {
    await say('teacher', '영어학원 선생님', '😵', '...내... 내가 졌다. 너의 변론은 완벽했다.');
    await say('teacher', '영어학원 선생님', '😈', '하지만 다음 주 숙제는 두 배다.');
  } else if (verdictKey === 'timeout') {
    await say('teacher', '영어학원 선생님', '😤', '7라운드 다 썼지만 신뢰도가 부족하다.');
  } else {
    await say('teacher', '영어학원 선생님', '😤', '<span class="emph">유죄!</span>' + (note ? ` (${note})` : ''));
    await say('teacher', '영어학원 선생님', '📞', '어머님께 전화 한 통 드릴게.');
  }

  gameScreen.classList.add('hidden');
  verdictScreen.classList.remove('hidden');
  const title = $('#verdict-title');
  title.textContent = ending.title;
  title.className = '';
  title.classList.add(ending.titleClass);
  $('#verdict-desc').textContent = ending.desc;
  shout(verdictKey === 'notguilty' ? 'takethat' : 'objection');
}

// ===== API key modal =====
function openApiKeyModal(errorMsg) {
  titleScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  verdictScreen.classList.add('hidden');
  apikeyModal.classList.remove('hidden');
  const existing = localStorage.getItem(LS_KEY) || '';
  $('#apikey-input').value = existing;
  const existingModel = localStorage.getItem(LS_MODEL) || 'gemini-2.5-flash';
  $('#model-select').value = existingModel;
  const errEl = $('#apikey-error');
  if (errorMsg) {
    errEl.textContent = errorMsg;
    errEl.classList.remove('hidden');
  } else {
    errEl.classList.add('hidden');
  }
  setTimeout(() => $('#apikey-input').focus(), 50);
}
function closeApiKeyModal() {
  apikeyModal.classList.add('hidden');
  titleScreen.classList.remove('hidden');
}

// ===== Init =====
$('#start-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  ensureAudio();
  const key = localStorage.getItem(LS_KEY);
  if (!key) {
    openApiKeyModal();
    return;
  }
  setTimeout(startGame, 0);
});

$('#config-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  openApiKeyModal();
});

$('#apikey-save').addEventListener('click', (e) => {
  e.stopPropagation();
  const key = $('#apikey-input').value.trim();
  const errEl = $('#apikey-error');
  if (!key) {
    errEl.textContent = 'API 키를 입력하세요.';
    errEl.classList.remove('hidden');
    return;
  }
  if (!key.startsWith('AIza')) {
    errEl.textContent = 'Google Gemini API 키는 "AIza"로 시작합니다.';
    errEl.classList.remove('hidden');
    return;
  }
  localStorage.setItem(LS_KEY, key);
  localStorage.setItem(LS_MODEL, $('#model-select').value);
  apikeyModal.classList.add('hidden');
  ensureAudio();
  setTimeout(startGame, 0);
});

$('#apikey-cancel').addEventListener('click', (e) => {
  e.stopPropagation();
  closeApiKeyModal();
});

$('#reset-key-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  e.stopImmediatePropagation();
  gameScreen.classList.add('hidden');
  openApiKeyModal();
});

$('#restart-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  verdictScreen.classList.add('hidden');
  titleScreen.classList.remove('hidden');
});
