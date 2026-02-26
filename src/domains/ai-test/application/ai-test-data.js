export const AI_TEST_QUESTIONS = [
  {
    q: {
      ko: "새로운 기술이나 AI 도구가 나오면 즉시 써보는 편인가요?",
      en: "Do you try new AI tools as soon as they are released?",
    },
    a: [
      { ko: "완전 내 이야기!", en: "Totally me!", score: 3 },
      { ko: "관심은 가요", en: "I'm interested", score: 2 },
      { ko: "남들 쓰는거 보고", en: "After seeing others", score: 1 },
      { ko: "별로 안 궁금함", en: "Not really", score: 0 },
    ],
  },
  {
    q: {
      ko: "문제를 해결할 때 논리적인 분석보다 직관을 더 믿나요?",
      en: "Do you trust intuition more than logical analysis when solving problems?",
    },
    a: [
      { ko: "무조건 논리!", en: "Logic only!", score: 0 },
      { ko: "대체로 분석적", en: "Mostly analytical", score: 1 },
      { ko: "가끔은 직관", en: "Sometimes intuitive", score: 2 },
      { ko: "직관이 최고", en: "Intuition is best", score: 3 },
    ],
  },
  {
    q: {
      ko: "반복적인 단순 업무를 자동화하는 것에 즐거움을 느끼나요?",
      en: "Do you find joy in automating repetitive tasks?",
    },
    a: [
      { ko: "희열을 느껴요", en: "Absolute joy", score: 3 },
      { ko: "좋아하는 편", en: "I like it", score: 2 },
      { ko: "그저 그래요", en: "It's okay", score: 1 },
      { ko: "직접 하는게 편함", en: "Doing it manually is better", score: 0 },
    ],
  },
  {
    q: {
      ko: "AI가 인간의 창의성을 완전히 대체할 수 있다고 생각하나요?",
      en: "Do you think AI can completely replace human creativity?",
    },
    a: [
      { ko: "당연히 가능!", en: "Absolutely!", score: 3 },
      { ko: "어느 정도는", en: "To some extent", score: 2 },
      { ko: "아직은 멀었음", en: "Not yet", score: 1 },
      { ko: "절대 불가능", en: "Never", score: 0 },
    ],
  },
  {
    q: {
      ko: "복잡한 코드를 보거나 로직을 설계할 때 흥분되나요?",
      en: "Do you get excited when seeing complex code or designing logic?",
    },
    a: [
      { ko: "너무 재밌음!", en: "So much fun!", score: 3 },
      { ko: "즐기는 편", en: "I enjoy it", score: 2 },
      { ko: "가끔은 힘듦", en: "Sometimes hard", score: 1 },
      { ko: "머리 아파요", en: "It's a headache", score: 0 },
    ],
  },
];

export const AI_TEST_MODELS = [
  {
    name: "GPT-4o",
    desc: {
      ko: "당신은 다재다능하고 논리적인 완벽주의자입니다.",
      en: "You are a versatile and logical perfectionist.",
    },
    color: "oklch(55% 0.15 150)",
    icon: "🤖",
  },
  {
    name: "Claude 3.5 Sonnet",
    desc: {
      ko: "당신은 따뜻한 감성과 정교한 필력을 가진 예술가형입니다.",
      en: "You are an artist type with warm sensitivity and sophisticated writing.",
    },
    color: "oklch(60% 0.15 40)",
    icon: "✍️",
  },
  {
    name: "Gemini Pro",
    desc: {
      ko: "당신은 방대한 정보를 연결하는 창의적인 전략가입니다.",
      en: "You are a creative strategist connecting vast amounts of information.",
    },
    color: "oklch(55% 0.2 260)",
    icon: "✨",
  },
  {
    name: "Llama 3",
    desc: {
      ko: "당신은 자유롭고 거침없는 오픈소스 정신의 소유자입니다.",
      en: "You are a free-spirited owner of the open-source spirit.",
    },
    color: "oklch(50% 0.2 230)",
    icon: "🦙",
  },
];
