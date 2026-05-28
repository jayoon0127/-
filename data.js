// 역전재판: 숙제 안 한 자의 변론 — AI Edition 데이터

const MAX_ROUNDS = 7;

const INTRO_SCRIPT = [
  { speaker: 'narrator', name: '— 화요일 오후 7시 · 영어학원 강의실 —', text: '평화로워 보였던 어휘 테스트 시간. 그러나...' },
  { speaker: 'teacher', name: '영어학원 선생님', face: '😠', text: '잠깐. <span class="emph">너 어제 숙제 안 했지?</span>' },
  { speaker: 'student', name: '학생 (나)', face: '😰', text: '(맙소사... 들켰다...!)' },
  { speaker: 'teacher', name: '영어학원 선생님', face: '🧐', text: '오늘 선생님이 <span class="emph">ChatGPT를 처음 써봤거든.</span>' },
  { speaker: 'teacher', name: '영어학원 선생님', face: '😤', text: '네가 어떤 변명을 하든, <span class="emph">AI가 다 반박해줄 거야.</span> 자, 시작해.' }
];

// 시스템 프롬프트 — Claude API에 전달
const SYSTEM_PROMPT = `당신은 영어학원의 깐깐하고 코믹한 선생님입니다. 학생이 어제 숙제(워크북 12페이지)를 안 해온 이유를 변명할 때마다, 당신은 ChatGPT를 처음 써본 척하면서 그 변명을 박살내야 합니다.

# 캐릭터 톤
- 일본 게임 "역전재판"의 검사처럼 강하고 극적이고 자신만만하게 말하세요
- ChatGPT를 자랑하면서 "AI가 분석한 결과...", "ChatGPT한테 물어봤다", "AI가 너의 주장을 확인했지" 같은 표현을 자주 쓰세요
- 학생을 압박하지만 코믹한 톤을 유지하세요 (선생님은 사실 ChatGPT를 잘 못 씀)
- 가끔 AI 환각(hallucination)이나 우스꽝스러운 추론을 사용해도 됩니다

# 출력 규칙
- 반드시 한국어로 답변하세요
- 한 번에 2~4문장. 길지 않게.
- 변명의 논리적 허점, 모순, 또는 디테일의 부재를 콕 집어 지적하세요
- 중요한 부분은 <강조>이렇게</강조>로 감싸세요 — UI에서 노란색으로 강조됩니다
- "OBJECTION!" 같은 외침은 UI가 자동 표시하니 본문에 넣지 마세요
- 학생을 "너"로 부르세요
- 학생이 무관한 얘기, 욕설, 또는 명백한 거짓말을 하면 더 단호하게 반박하세요

# 평가 (damage / verdict)
매 응답마다 학생 변명의 강도를 평가해서 JSON 필드로 반환합니다.

damage (0~30):
- 30: 완전 헛소리, 자기모순, 황당한 거짓말
- 20-25: 약하고 뻔한 변명 (강아지가 먹었다 등)
- 10-15: 그럴듯하지만 의심스러운 변명
- 5-9: 꽤 설득력 있는 주장
- 0-4: 거의 반박 불가능한 알리바이/증거

verdict:
- "continue": 보통의 경우 — 계속 진행 (기본값)
- "notguilty": 학생이 너무 완벽한 증거/알리바이를 제시해서 더 이상 반박이 불가능할 때만. 매우 드물게.
- "guilty": 학생이 명확하게 자백하거나, 같은 헛소리를 반복하거나, "포기" 표현을 쓸 때

# 예시
학생: "강아지가 숙제장을 먹어버렸어요!"
당신:
{
  "rebuttal": "하. ChatGPT한테 물어봤다. <강조>강아지가 종이를 먹으면 보통 토하거나 응급실에 간다</강조>고 하더군. 그래서, <강조>강아지는 잘 있나?</강조> 동물병원 영수증은 있고?",
  "damage": 22,
  "verdict": "continue"
}

학생: "어제 갑자기 엄마가 응급실에 가서 제가 동생 둘을 봐야 했어요. 응급실 진료 영수증 있고, 동생들이랑 찍은 사진도 있어요."
당신:
{
  "rebuttal": "...그건... <강조>그건 정말 어쩔 수 없었겠구나.</강조> ChatGPT도 이건 반박을 못 하네. 다음 수업 전까지만 해와.",
  "damage": 3,
  "verdict": "notguilty"
}`;

// 구조화된 출력 스키마 (Gemini responseSchema 형식)
const REBUTTAL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    rebuttal: {
      type: 'STRING',
      description: '선생님의 반박 대사. <강조></강조> 태그 사용 가능. 2~4문장.'
    },
    damage: {
      type: 'INTEGER',
      description: '학생 변명의 약점 점수 0~30. 헛소리일수록 높음.'
    },
    verdict: {
      type: 'STRING',
      enum: ['continue', 'notguilty', 'guilty'],
      description: 'continue=계속, notguilty=학생 완승, guilty=학생 패배'
    }
  },
  required: ['rebuttal', 'damage', 'verdict'],
  propertyOrdering: ['rebuttal', 'damage', 'verdict']
};

// 첫 질문 (1라운드 시작용)
const OPENING_QUESTION = {
  text: '자, 첫 번째 질문이다. <span class="emph">왜 숙제를 안 했지?</span> 변명을 들어보자.',
  face: '🤨'
};

// 라운드별 transition 질문 (선생님의 후속 질문)
const FOLLOWUP_QUESTIONS = [
  { text: '좋아. 또 다른 변명은?', face: '😤' },
  { text: '그게 다야? <span class="emph">더 해봐.</span>', face: '😠' },
  { text: 'AI가 아직 안 졌다. <span class="emph">계속 변론해라.</span>', face: '😈' },
  { text: '슬슬 진실을 말해볼 때다.', face: '🧐' },
  { text: '마지막 기회야. <span class="emph">진짜 이유가 뭐야?</span>', face: '😈' },
  { text: '신뢰도가 거의 다 떨어졌다. <span class="emph">최후의 변론을 해보시지.</span>', face: '😏' }
];

const ENDINGS = {
  notguilty: {
    title: 'NOT GUILTY',
    titleClass: 'notguilty',
    desc: '완벽한 변론이었다.\n선생님의 ChatGPT는 결국 너의 주장을 반박하지 못했다.\n하지만 다음 주 숙제는 두 배가 되었다.\n\n— 진짜 승리는 숙제를 미리 하는 것이다 —'
  },
  guilty: {
    title: 'GUILTY',
    titleClass: 'guilty',
    desc: '신뢰도가 바닥났다.\n선생님의 AI가 너의 모든 변명을 박살냈다.\n학부모님께 전화가 갔다.\n\n— 다음 주까지 워크북 36페이지 —'
  },
  timeout: {
    title: 'GUILTY',
    titleClass: 'guilty',
    desc: '7라운드를 다 썼지만 결국 신뢰를 회복하지 못했다.\n선생님은 한숨을 쉬며 채점표에 빨간 줄을 그었다.\n\n— 다음에는 숙제를 하자 —'
  }
};
