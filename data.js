// 역전재판: 숙제 안 한 자의 변론 — 시나리오 데이터
// 학원 선생님 (AI 무장) vs 학생 (당신)

const INTRO_SCRIPT = [
  { speaker: 'narrator', name: '— 화요일 오후 7시 · 영어학원 강의실 —', text: '평화로워 보였던 어휘 테스트 시간. 그러나...' },
  { speaker: 'teacher', name: '영어학원 선생님', face: '😠', text: '잠깐. <span class="emph">너 어제 숙제 안 했지?</span>' },
  { speaker: 'student', name: '학생 (나)', face: '😰', text: '(맙소사... 들켰다...!)' },
  { speaker: 'teacher', name: '영어학원 선생님', face: '🧐', text: '오늘 선생님이 <span class="emph">ChatGPT를 처음 써봤거든.</span>' },
  { speaker: 'teacher', name: '영어학원 선생님', face: '😤', text: '네가 어떤 변명을 하든, <span class="emph">AI가 다 반박해줄 거야.</span>' },
  { speaker: 'student', name: '학생 (나)', face: '😨', text: '(...이건 역전재판이다!!)' }
];

// 각 라운드는 학생이 변명을 고르고, 선생님이 AI 반박을 한 뒤,
// 학생이 행동(이의제기/증거제출/자백)을 선택한다.
const ROUNDS = [
  {
    id: 1,
    question: {
      speaker: 'teacher', face: '🤨',
      text: '자, 첫 번째 질문이다. <span class="emph">왜 숙제를 안 했지?</span> 변명을 들어보자.'
    },
    excuses: [
      {
        text: '강아지가 숙제장을 먹어버렸어요!',
        studentLine: '저... 저희 집 강아지가 숙제장을 먹어버렸어요! 진짜예요!',
        rebuttal: {
          face: '😏',
          text: '하. ChatGPT한테 물어봤다. <span class="emph">"강아지가 종이를 먹으면 위장에 무리가 가서 보통은 토하거나 응급실에 갑니다."</span> ...그래서, <span class="emph">강아지는 잘 있나?</span>'
        },
        weakness: 'dogPhoto',  // 강아지 사진으로 반박 가능
        damage: 25
      },
      {
        text: '인터넷이 끊겨서 온라인 숙제를 못 했어요',
        studentLine: '어제 저희 동네 인터넷이 다 끊겨서요... 온라인 숙제를 못 했어요.',
        rebuttal: {
          face: '😎',
          text: 'AI가 KT, SK, LG U+ 어제 장애 보고를 모두 확인했지. <span class="emph">너네 동네는 멀쩡했다.</span> 게다가 어제 숙제는 <span class="emph">종이 워크북</span>이었는데?'
        },
        weakness: 'workbookPage',
        damage: 35
      },
      {
        text: '학교 시험 공부 때문에 너무 바빴어요',
        studentLine: '내일 학교에서 중간고사라서요... 진짜 공부할 게 너무 많았어요.',
        rebuttal: {
          face: '🧐',
          text: 'ChatGPT가 너네 학교 시간표를 확인했다. (사실은 내가 학부모 단톡방에서 봤지만) <span class="emph">중간고사는 다음 주야.</span>'
        },
        weakness: 'schedule',
        damage: 30
      }
    ]
  },
  {
    id: 2,
    question: {
      speaker: 'teacher', face: '😠',
      text: '좋아. 그럼 <span class="emph">왜 하필 어제 안 했는지</span> 설명해봐.'
    },
    excuses: [
      {
        text: '갑자기 동생이 아파서 병원에 갔어요',
        studentLine: '어제 동생이 갑자기 열이 너무 심해서요... 엄마랑 병원 응급실에 같이 갔어요.',
        rebuttal: {
          face: '😏',
          text: 'AI한테 시켰지. <span class="emph">"어제 저녁 7시~10시 사이 인근 응급실 방문 기록 조회"</span>. ...물론 그건 못 하지만, <span class="emph">너 어제 PC방에서 봤다는 제보가 들어왔다.</span>'
        },
        weakness: 'pcbang',
        damage: 30
      },
      {
        text: '학원 가방을 깜빡하고 학교에 두고 왔어요',
        studentLine: '어제 가방을 학교 사물함에 두고 와서요... 숙제장을 꺼낼 수가 없었어요.',
        rebuttal: {
          face: '😤',
          text: 'ChatGPT가 분석한다. <span class="emph">"숙제 앱은 모바일로도 접속 가능하며, 워크북은 PDF로도 배포되었습니다."</span> 변명이 너무 90년대다.'
        },
        weakness: 'app',
        damage: 25
      },
      {
        text: '폰이 고장나서 숙제 알림을 못 봤어요',
        studentLine: '제 폰이 어제부터 좀 이상해서요... 학원 알림톡을 못 받았어요.',
        rebuttal: {
          face: '🧐',
          text: '<span class="emph">학원 단톡방 어제 밤 11시 23분에 너 \'ㅇㅋ\'라고 답장했더라.</span> AI가 단톡방 캡쳐를 분석했다.'
        },
        weakness: 'kakao',
        damage: 40
      }
    ]
  },
  {
    id: 3,
    question: {
      speaker: 'teacher', face: '😈',
      text: '마지막 기회다. <span class="emph">그래서, 진짜 이유가 뭐야?</span>'
    },
    excuses: [
      {
        text: '솔직히 게임하느라 못 했어요...',
        studentLine: '...죄송해요. 사실은... 어제 친구랑 게임 한 판만 하려다가...',
        rebuttal: {
          face: '😌',
          text: '<span class="emph">호. 드디어 진실을 말하는군.</span> 그래도 거짓말은 아니다. 정직은 인정한다. 하지만 숙제는 숙제다.'
        },
        weakness: null,  // 자백 → 약점 없음
        damage: 10,
        honest: true
      },
      {
        text: 'AI한테 시켰는데 AI도 까먹었어요',
        studentLine: '사실 ChatGPT한테 숙제 풀어달라고 했는데... AI가 답을 안 주더라고요.',
        rebuttal: {
          face: '🤬',
          text: '<span class="emph">뭐?!</span> AI한테 시켰다고?! ChatGPT가 안 했다고?! <span class="emph">너 지금 AI 핑계까지 대는 거냐?!</span>'
        },
        weakness: 'chatgptLog',
        damage: 45
      },
      {
        text: '제가 숙제가 있다는 걸 몰랐어요',
        studentLine: '저... 어제 숙제가 있었어요? 처음 듣는 얘긴데요?',
        rebuttal: {
          face: '😡',
          text: '<span class="emph">!!!</span> AI도 이건 못 막아준다. 내가 직접 너 눈 보고 말했다. <span class="emph">"내일까지 워크북 12페이지!"</span> 너 분명 고개 끄덕였어!'
        },
        weakness: 'memory',
        damage: 50
      }
    ]
  }
];

// 증거 인벤토리 — 게임 시작시 학생이 가지고 있음
const EVIDENCE = {
  dogPhoto: {
    icon: '🐶',
    name: '강아지 사진',
    desc: '입에 종이를 문 강아지',
    counters: ['dogPhoto'],
    counterLine: '여기 보세요! 우리집 강아지가 진짜 숙제장 먹는 사진이에요! 어제 동물병원 다녀온 영수증도 있어요!'
  },
  workbookPage: {
    icon: '📖',
    name: '찢어진 워크북',
    desc: '강아지가 먹다 남긴 워크북',
    counters: ['workbookPage'],
    counterLine: '워크북이 종이라서 강아지가 먹은 거잖아요! 여기 이빨 자국이요!'
  },
  schedule: {
    icon: '📅',
    name: '학교 시간표',
    desc: '실제 중간고사 일정 캡쳐',
    counters: ['schedule'],
    counterLine: '선생님이 잘못 아신 거예요! 학부모 단톡방 정보는 작년 시간표거든요! 올해는 일주일 당겨졌어요!'
  },
  pcbang: {
    icon: '🎮',
    name: 'PC방 알리바이',
    desc: '그 시간 친구가 PC방에 있었던 영수증',
    counters: ['pcbang'],
    counterLine: '제보가 잘못된 거예요! 어제 PC방에 있었던 건 제 쌍둥이 사촌이에요! 영수증 보세요!'
  },
  app: {
    icon: '📱',
    name: '앱 오류 캡쳐',
    desc: '숙제 앱이 다운된 스크린샷',
    counters: ['app'],
    counterLine: '앱도 어제 점검 중이었어요! 여기 공지 보세요!'
  },
  kakao: {
    icon: '💬',
    name: '동생의 카톡 자백',
    desc: '동생이 폰 만진 증거',
    counters: ['kakao'],
    counterLine: '그 ㅇㅋ는 제 동생이 보낸 거예요! 제 폰을 몰래 가져갔거든요! 여기 동생 자백 카톡!'
  },
  chatgptLog: {
    icon: '🤖',
    name: 'ChatGPT 대화 로그',
    desc: 'AI가 진짜로 답을 못 한 캡쳐',
    counters: ['chatgptLog'],
    counterLine: '진짜예요! 보세요, ChatGPT가 "그 문제는 풀 수 없습니다"라고 했잖아요! AI도 못 푸는 숙제를 어떻게 풀어요?!'
  },
  memory: {
    icon: '🎧',
    name: '그때의 이어폰',
    desc: '그날 끼고 있던 무선 이어폰',
    counters: ['memory'],
    counterLine: '죄송해요... 사실 그때 이어폰 끼고 있어서 못 들었어요! 고개 끄덕인 건 음악 박자에 맞춘 거였어요!'
  }
};

const ENDINGS = {
  win: {
    title: 'NOT GUILTY',
    titleClass: 'notguilty',
    desc: '완벽한 변론이었다.\n선생님은 입을 다물지 못했다.\n하지만 다음 주 숙제는 두 배가 되었다.\n\n— 진짜 승리는 숙제를 미리 하는 것이다 —'
  },
  lose: {
    title: 'GUILTY',
    titleClass: 'guilty',
    desc: '신뢰도가 바닥났다.\n선생님의 AI가 너의 모든 변명을 박살냈다.\n학부모님께 전화가 갔다.\n\n— 다음 주까지 워크북 36페이지 —'
  },
  honest: {
    title: '정상참작',
    titleClass: 'notguilty',
    desc: '정직하게 자백했다.\n선생님은 잠시 고민하더니, 한숨을 쉬며 말했다.\n"...다음에는 미리 말해. 가."\n\n— 진실은 때로 최고의 방어다 —'
  }
};
