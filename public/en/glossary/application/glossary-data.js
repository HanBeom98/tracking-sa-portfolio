// src/domains/glossary/application/glossary-data.js

export const glossaryData = [
    {
        id: "LLM",
        term: {
            ko: "LLM (대형 언어 모델)",
            en: "LLM (Large Language Model)"
        },
        category: {
            ko: "AI 기술",
            en: "AI Technology"
        },
        shortDesc: {
            ko: "글을 기가 막히게 잘 쓰는 초대형 앵무새",
            en: "A giant parrot that writes surprisingly well"
        },
        longDesc: {
            ko: "수많은 텍스트 데이터를 학습하여 사람처럼 문장을 만들어내는 AI 모델입니다. 투자 관점에서는 '누가 가장 똑똑하고 가성비 좋은 앵무새를 만들어 시장을 독점할 것인가'가 핵심 경쟁 포인트입니다. OpenAI의 GPT, 구글의 Gemini, 앤트로픽의 Claude 등이 대표적입니다.",
            en: "An AI model trained on massive text data to generate human-like sentences. From an investor view, the key question is who can build the smartest and most cost-efficient model at scale. Major examples include OpenAI GPT, Google Gemini, and Anthropic Claude."
        },
        impact: {
            ko: "검색 시장을 위협하고 B2B 업무 자동화의 핵심 엔진으로 작용하여 클라우드 서버(GPU) 수요를 폭발시키는 주범입니다.",
            en: "It disrupts search and powers B2B workflow automation, driving strong demand for cloud infrastructure and GPUs."
        }
    },
    {
        id: "RAG",
        term: {
            ko: "RAG (검색 증강 생성)",
            en: "RAG (Retrieval-Augmented Generation)"
        },
        category: {
            ko: "AI 기술",
            en: "AI Technology"
        },
        shortDesc: {
            ko: "앵무새에게 최신 백과사전을 쥐어주는 기술",
            en: "Giving your model an up-to-date encyclopedia"
        },
        longDesc: {
            ko: "LLM이 가진 치명적인 약점인 '환각(거짓말)'을 줄이기 위해, 대답하기 전에 외부 데이터베이스나 기업 내부 문서에서 먼저 정답을 '검색'한 뒤 그 내용을 바탕으로 대답을 '생성'하게 하는 기술입니다.",
            en: "To reduce hallucinations, RAG first retrieves relevant facts from external databases or internal documents, then generates responses based on those sources."
        },
        impact: {
            ko: "기업들이 보안 문제로 자체 데이터를 AI에 넘기길 꺼리는 상황에서, B2B AI 솔루션이 돈을 벌기 위해 반드시 갖춰야 할 필수 기능으로 평가받습니다.",
            en: "As enterprises hesitate to expose private data directly to AI, RAG is considered a must-have capability for monetizable B2B AI solutions."
        }
    },
    {
        id: "NPU",
        term: {
            ko: "NPU (신경망 처리 장치)",
            en: "NPU (Neural Processing Unit)"
        },
        category: {
            ko: "반도체/하드웨어",
            en: "Semiconductor/Hardware"
        },
        shortDesc: {
            ko: "AI 연산만을 위해 태어난 전용 계산기",
            en: "A chip built specifically for AI workloads"
        },
        longDesc: {
            ko: "CPU가 다재다능한 천재, GPU가 단순 노동을 잘하는 일꾼이라면, NPU는 오직 'AI 신경망 연산' 하나만 기가 막히게 잘하도록 설계된 맞춤형 칩입니다. 전력 소모가 적고 효율이 높습니다.",
            en: "If CPU is general-purpose and GPU is great at parallel tasks, NPU is specialized for neural network inference with better power efficiency."
        },
        impact: {
            ko: "스마트폰, 자동차 등 인터넷이 안 터지는 곳(온디바이스)에서도 AI를 팡팡 돌리기 위해 필수적이라, 애플, 퀄컴 등 모바일 칩셋 회사들의 새로운 캐시카우입니다.",
            en: "NPUs are key for on-device AI in phones and vehicles, making them a major growth driver for mobile chipset vendors like Apple and Qualcomm."
        }
    },
    {
        id: "On-Device-AI",
        term: {
            ko: "온디바이스 AI (On-Device AI)",
            en: "On-Device AI"
        },
        category: {
            ko: "트렌드",
            en: "Trend"
        },
        shortDesc: {
            ko: "클라우드 서버에 돈 안 내고 내 폰에서 직접 도는 AI",
            en: "AI that runs directly on your device"
        },
        longDesc: {
            ko: "인터넷 연결이나 막대한 비용이 드는 외부 클라우드 서버를 거치지 않고, 스마트폰이나 PC 기기 자체에서 직접 AI 모델을 구동하는 방식입니다.",
            en: "A method where AI models run directly on smartphones or PCs without depending on always-on internet or costly cloud servers."
        },
        impact: {
            ko: "애플(Apple Intelligence)과 삼성(Galaxy AI)이 가장 혈안이 되어 있는 분야입니다. 기기 교체 주기(슈퍼 사이클)를 앞당기고 클라우드 유지비용을 줄여주는 마법의 단어입니다.",
            en: "This is a key battleground for Apple Intelligence and Galaxy AI, with potential to accelerate device upgrades and reduce cloud costs."
        }
    },
    {
        id: "Token",
        term: {
            ko: "토큰 (Token)",
            en: "Token"
        },
        category: {
            ko: "AI 기술",
            en: "AI Technology"
        },
        shortDesc: {
            ko: "AI 세계의 유료 데이터 화폐 단위",
            en: "The basic billing unit of AI usage"
        },
        longDesc: {
            ko: "AI가 글을 읽고 쓸 때 글자를 쪼개는 최소 단위입니다. 보통 영어 1단어가 1토큰, 한글은 글자당 여러 토큰으로 쪼개집니다.",
            en: "A token is the smallest text unit an AI model reads or writes. Pricing is usually based on input and output token volume."
        },
        impact: {
            ko: "AI 회사들의 '수익 모델' 그 자체입니다. '입력 100만 토큰당 얼마, 출력 100만 토큰당 얼마' 식으로 과금하므로, 투자자들은 모델의 성능보다 '토큰당 처리 비용이 얼마나 싸졌는가'를 더 꼼꼼히 따집니다.",
            en: "Token pricing is central to AI business models, so investors closely track cost per token as much as raw model quality."
        }
    },
    {
        id: "Agentic-AI",
        term: {
            ko: "에이전틱 AI (Agentic AI)",
            en: "Agentic AI"
        },
        category: {
            ko: "트렌드",
            en: "Trend"
        },
        shortDesc: {
            ko: "알아서 생각하고, 알아서 행동하는 AI 비서",
            en: "An AI assistant that plans and acts autonomously"
        },
        longDesc: {
            ko: "단순히 질문에 답만 하는 챗봇을 넘어, 목표를 주면 스스로 계획을 세우고, 인터넷을 검색하고, 마우스/키보드를 움직여(코딩 등) 임무를 완수하는 주도적인 AI입니다.",
            en: "Beyond simple chatbots, this AI can plan tasks, search the web, and execute actions (including coding workflows) to complete goals."
        },
        impact: {
            ko: "SaaS(서비스형 소프트웨어) 시장을 통째로 집어삼킬 잠재력을 가진 다음 세대의 핵심 테마입니다. 단순히 '도구'를 파는 시대에서 '디지털 노동력' 자체를 파는 시대로의 전환을 의미합니다.",
            en: "It is a next-generation theme with potential to reshape SaaS from selling tools to delivering digital labor."
        }
    }
];
