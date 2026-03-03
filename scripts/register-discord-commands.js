/**
 * Discord Slash Command Registration Script
 * Run this to register the /대내모집 command.
 */
import dotenv from 'dotenv';
dotenv.config();

const APP_ID = "1478495458900054300";
const BOT_TOKEN = process.env.DISCORD_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ 에러: .env 파일에 DISCORD_TOKEN 이 없습니다.');
  process.exit(1);
}

const commands = [
  {
    name: "대내모집",
    description: "서든어택 대내 인원을 모집합니다 (참여하기 버튼 생성)",
    type: 1
  },
  {
    name: "전적검색",
    description: "크루원의 전적(MMR, 승률 등)을 검색합니다",
    type: 1,
    options: [
      {
        name: "닉네임",
        description: "검색할 유저의 인게임 닉네임",
        type: 3, // STRING
        required: true
      }
    ]
  }
];

async function registerCommands() {
  console.log('🚀 디스코드 명령어 등록 시작...');
  try {
    const response = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands)
    });

    if (response.ok) {
      console.log('✅ 명령어 등록 성공! 이제 디스코드에서 /대내모집을 사용할 수 있습니다.');
    } else {
      const error = await response.json();
      console.error('❌ 등록 실패:', error);
    }
  } catch (err) {
    console.error('❌ 네트워크 오류:', err);
  }
}

registerCommands();
