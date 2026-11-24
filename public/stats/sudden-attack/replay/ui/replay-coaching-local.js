import { getCurrentUser, subscribeAuthState } from '../../../../auth/infra/auth-gateway.js?v=512ed5fcfa8b';
import { createReplayCoachingSession, isLocalCoachingTest } from '../application/replay-coaching-session.js?v=67cf6cdaf591';
import { sendLocalReplayCoaching } from '../infra/replay-coaching-client.js?v=ad177f5b6f6a';
import { renderReplayCoachingPanel } from './replay-coaching-panel.js?v=d66857c5d0ed';

const errors = {
  UNAUTHENTICATED: '로그인 상태를 확인해 주세요.', TEST_ACCOUNT_REQUIRED: '허용된 테스트 계정만 사용할 수 있습니다.',
  USER_LIMIT: '계정의 이용 기간 모의 사용 한도에 도달했습니다.', GLOBAL_LIMIT: '전체 월 모의 사용 한도에 도달했습니다.',
  GLOBAL_BUDGET_LIMIT: '전체 모의 단위 한도에 도달했습니다.', ATTEMPT_LIMIT: '이용 기간 테스트 시도 한도에 도달했습니다.',
  ACCESS_NOT_STARTED: '테스트 이용 기간이 아직 시작되지 않았습니다.', ACCESS_EXPIRED: '테스트 이용 기간이 만료되었습니다.',
  ACCESS_PERIOD_CONFLICT: '서버의 이용 기간 설정이 기존 기록과 충돌합니다. 운영자 확인이 필요합니다.',
  COACHING_DISABLED: '모의 API가 비활성 상태입니다.', COACHING_NOT_CONFIGURED: '모의 API 설정을 확인해야 합니다.',
  REQUEST_IN_PROGRESS: '서버에서 같은 계정의 요청을 처리 중입니다.', REQUEST_UNRESOLVED: '서버 예약 결과가 미확정입니다. 운영자 확인이 필요합니다.',
  IDEMPOTENCY_CONFLICT: '요청 번호와 근거가 일치하지 않습니다.', PREVIOUS_ATTEMPT_FAILED: '이 요청은 실패로 종료되었습니다.',
  MOCK_RESPONSE_FAILED: '모의 해설 생성에 실패했습니다.', INSUFFICIENT_EVIDENCE: '검증된 근거가 부족합니다.',
  INVALID_REQUEST_ID: '요청 번호의 월이 지났거나 형식이 잘못되었습니다.', INVALID_RESPONSE: '응답의 형식이나 근거를 확인하지 못했습니다.',
};

export function createLocalReplayCoachingPanel(container, location) {
  if (!isLocalCoachingTest(location)) return null;
  let evidence = null;
  const session = createReplayCoachingSession({ getUser: getCurrentUser, send: sendLocalReplayCoaching,
    uuid: () => crypto.randomUUID(), onChange: render });
  function render(state) {
    const panel = container.querySelector('#replayCoachingPreview');
    if (!panel || !evidence) return;
    panel.outerHTML = renderReplayCoachingPanel(evidence, state.response, { serverMock: Boolean(state.response) });
    const target = container.querySelector('#replayCoachingPreview');
    const controls = document.createElement('div'); controls.className = 'coaching-local';
    const note = document.createElement('p');
    note.textContent = '로컬 서버 모의 테스트 · 버튼을 누르면 이름·좌표·원본 파일을 제외한 수치 요약과 로그인 토큰을 로컬 API에 보냅니다. 유료 AI 호출은 없습니다.';
    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.dataset.coachingStatus = '';
    status.textContent = ({ no_evidence: '플레이어나 경기 유형을 바꿨습니다. 다시 분석해 주세요.', insufficient: '검증된 라운드가 없어 요청할 수 없습니다.',
      signed_out: '로그인한 테스트 계정이 필요합니다.', ready: '아직 서버에 전송하지 않았습니다.', pending: '서버 모의 응답을 기다리고 있습니다…',
      completed: `서버 모의 해설 확인 완료 · 해당 이용 기간 모의 사용 ${state.used}회`,
      already_completed: `이미 완료된 요청입니다. 추가 차감은 없습니다.${state.response ? ' 앞서 받은 해설을 유지합니다.' : ' 서버는 해설을 저장하지 않아 재표시할 수 없습니다.'}`,
      blocked: errors[state.error] || '요청을 진행할 수 없습니다. 로컬 설정을 확인해 주세요.',
      unknown: `${errors[state.error] || '응답을 확인하지 못했습니다.'} 자동 재요청은 하지 않습니다. 같은 요청 번호로만 다시 확인할 수 있습니다.`,
      session_limit: '이 화면의 테스트 요청 보관 한도에 도달했습니다.',
    })[state.state];
    const button = document.createElement('button'); button.type = 'button'; button.dataset.coachingRequest = '';
    button.textContent = state.state === 'pending' ? '확인 중…'
      : ['unknown', 'completed', 'already_completed'].includes(state.state) ? '같은 요청 상태 확인' : '서버 모의 해설 요청';
    button.disabled = !['ready', 'unknown', 'completed', 'already_completed'].includes(state.state);
    button.addEventListener('click', () => session.request());
    controls.append(note, status, button); target.append(controls);
  }
  const unsubscribe = subscribeAuthState(() => session.authChanged());
  return { setEvidence(value) { evidence = value; session.setEvidence(value); },
    clear() { session.setEvidence(null); evidence = null; },
    dispose() { unsubscribe?.(); session.setEvidence(null); evidence = null; } };
}
