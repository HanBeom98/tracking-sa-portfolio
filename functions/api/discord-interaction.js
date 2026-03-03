// /functions/api/discord-interaction.js - Secure Discord Interaction Handler
import nacl from 'tweetnacl';

const PUBLIC_KEY = "5ce755c178c1e7737e5e60600f5fad9fffbed15f5fb3eb0cd33c4859520c7644";

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // 1. 보안 서명 검증 (Discord Signature Verification)
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const bodyText = await request.text();

  if (!signature || !timestamp) {
    return new Response('Missing signature or timestamp', { status: 401 });
  }

  try {
    const isVerified = nacl.sign.detached.verify(
      Buffer.from(timestamp + bodyText),
      Buffer.from(signature, 'hex'),
      Buffer.from(PUBLIC_KEY, 'hex')
    );

    if (!isVerified) {
      console.warn('Invalid request signature');
      return new Response('invalid request signature', { status: 401 });
    }
  } catch (err) {
    console.error('Verification error:', err);
    return new Response('Verification failed', { status: 401 });
  }

  try {
    const interaction = JSON.parse(bodyText);

    // 2. Discord PING 요청 (URL 저장 시 디스코드가 보내는 확인 신호)
    if (interaction.type === 1) {
      console.log('✅ 디스코드 PING 수신 완료!');
      return new Response(JSON.stringify({ type: 1 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. 명령어 처리 (/대내모집)
    if (interaction.type === 2) {
      if (interaction.data.name === '대내모집') {
        return new Response(JSON.stringify({
          type: 4,
          data: {
            content: "🎮 **TRACKING SA 내전 인원 모집 중!**\n아래 버튼을 눌러 서든어택 닉네임을 입력하고 대기열에 참가하세요.",
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    label: "✅ 참가 신청하기",
                    style: 1,
                    custom_id: "join_match"
                  }
                ]
              }
            ]
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 4. 버튼 클릭 처리 (참가 신청하기 버튼)
    if (interaction.type === 3 && interaction.data.custom_id === 'join_match') {
      return new Response(JSON.stringify({
        type: 9,
        data: {
          title: "대내 참가 신청서",
          custom_id: "match_entry_modal",
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4, // Text input
                  custom_id: "user_nickname",
                  label: "서든어택 닉네임 (대소문자 구분)",
                  style: 1, // Short text
                  min_length: 2,
                  max_length: 16,
                  placeholder: "현재 사용 중인 인게임 닉네임",
                  required: true
                }
              ]
            }
          ]
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 5. 모달 제출 처리 (닉네임 입력 완료)
    if (interaction.type === 5 && interaction.data.custom_id === 'match_entry_modal') {
      const nickname = interaction.data.components[0].components[0].value;
      const discordUserId = interaction.member ? interaction.member.user.id : interaction.user.id;
      const discordUserName = interaction.member ? interaction.member.user.username : interaction.user.username;

      // TODO: Firebase DB (sa_match_lobby) 에 닉네임, 시간, 디스코드 정보 저장 연동
      // 현재는 성공 메시지만 바로 반환합니다.

      return new Response(JSON.stringify({
        type: 4,
        data: {
          content: `🎉 **${nickname}**님, 성공적으로 대기열에 등록되었습니다!\n웹사이트의 [팀 밸런서]에서 라인업을 확인해 주세요.`,
          flags: 64 // Ephemeral (사용자 본인에게만 보임)
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 기본 응답
    return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Interaction Processing Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
