export function reportImageCleanup(result) {
  if (!result?.failed?.length) return;
  console.warn('Board image cleanup incomplete:', result.failed);
  alert('일부 첨부 이미지를 정리하지 못했습니다. 글 저장·삭제 결과에는 영향이 없습니다. 문제가 계속되면 운영자에게 문의해 주세요.');
}
