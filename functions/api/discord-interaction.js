// /functions/api/discord-interaction.js - Cloudflare Optimized Handler
import nacl from 'tweetnacl';

// 디스코드 개발자 포털의 PUBLIC KEY
const PUBLIC_KEY = "5ce755c178c1e7737e5e60600f5fad9fffbed15f5fb3eb0cd33c4859520c7644";

/**
 * 16진수 문자열을 Uint8Array로 변환하는 헬퍼
 */
function hexToUint8Array(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(hex, 16)));
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // 디스코드 필수 헤더 추출
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  
  // 클론을 생성하여 원본 바디 읽기 (검증용)
  const body = await request.clone().text();

  if (!signature || !timestamp) {
    return new Response('Missing signature or timestamp', { status: 401 });
  }

  try {
    // 보안 서명 검증 수행
    const isVerified = nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + body),
      hexToUint8Array(signature),
      hexToUint8Array(PUBLIC_KEY)
    );

    if (!isVerified) {
      return new Response('invalid request signature', { status: 401 });
    }
  } catch (err) {
    return new Response('Verification failed', { status: 401 });
  }

  // 검증 성공 후 요청 처리
  try {
    const interaction = JSON.parse(body);

    // 1. 디스코드 PING 응답 (필수)
    if (interaction.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. 명령어 처리 (/대내모집)
    if (interaction.type === 2 && interaction.data.name === '대내모집') {
      return new Response(JSON.stringify({
        type: 4,
        data: {
          content: "🎮 **TRACKING SA 내전 인원 모집 중!**\n아래 버튼을 눌러 서든어택 닉네임을 입력하고 신청하세요.",
          components: [{
            type: 1,
            components: [{
              type: 2,
              label: "참가 신청",
              style: 1,
              custom_id: "join_match"
            }]
          }]
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 3. 버튼 클릭 처리 (참가 신청 버튼)
    if (interaction.type === 3 && interaction.data.custom_id === 'join_match') {
      return new Response(JSON.stringify({
        type: 9,
        data: {
          title: "대내 참가 신청",
          custom_id: "match_entry_modal",
          components: [{
            type: 1,
            components: [{
              type: 4,
              custom_id: "user_nickname",
              label: "서든어택 닉네임",
              style: 1,
              min_length: 2,
              max_length: 16,
              placeholder: "인게임 닉네임을 정확히 입력하세요.",
              required: true
            }]
          }]
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 4. 모달 제출 처리
    if (interaction.type === 5 && interaction.data.custom_id === 'match_entry_modal') {
      const nickname = interaction.data.components[0].components[0].value;
      return new Response(JSON.stringify({
        type: 4,
        data: {
          content: `✅ **${nickname}**님, 신청이 완료되었습니다! 웹사이트에서 확인하세요.`,
          flags: 64
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
