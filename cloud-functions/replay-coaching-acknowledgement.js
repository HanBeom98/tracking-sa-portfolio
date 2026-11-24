const { createHash } = require('node:crypto');
const VERSION = 'purchase_preview_20261027_v1';
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const id = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const time = v => Number.isSafeInteger(v) && v >= 0 && Number.isFinite(new Date(v).getTime());
const hasAck = value => Object.hasOwn(value, 'acknowledgement');
const reject = (code, status) => { throw Object.assign(Error(code), { code, status }); };
function offer(value) {
  return { id: value.product || value.id, quantity: value.quantity, amountKRW: value.amountKRW, currency: 'KRW',
    termsVersion: value.termsVersion, expiresAt: Object.hasOwn(value, 'validDays') ? null : value.expiresAt,
    ...(Object.hasOwn(value, 'validDays') ? { validDays: value.validDays } : {}) };
}
function disclosureDigest(product, d) {
  return createHash('sha256').update(JSON.stringify({ purpose: d.purpose, version: d.version,
    title: d.title, text: d.text, offer: offer(product) })).digest('hex');
}
function validDocument(d) {
  return d && ['preview', 'sale'].includes(d.purpose) && id(d.version) && typeof d.title === 'string' && d.title.trim().length > 0
    && Buffer.byteLength(d.title, 'utf8') <= 120 && typeof d.text === 'string' && d.text.trim().length > 0
    && Buffer.byteLength(d.text, 'utf8') <= 1400 && typeof d.digest === 'string' && /^[a-f0-9]{64}$/.test(d.digest);
}
function validDisclosure(product, d) {
  return exact(d, ['purpose', 'version', 'title', 'text', 'digest']) && validDocument(d) && d.digest === disclosureDigest(product, d);
}
function previewDisclosure(product) {
  const expiry = Object.hasOwn(product, 'validDays') ? `결제 완료일부터 ${product.validDays}일`
    : product.expiresAt === null ? '기한 미지정(개발 설정)' : new Date(product.expiresAt).toISOString();
  const d = { purpose: 'preview', version: VERSION, title: '개발 미리보기 구매 조건 확인',
    text: `실제 판매 전 구매 흐름 검증용입니다. 실제 결제 약관에 대한 동의가 아닙니다.\n구성: ${product.quantity}회 / ${product.amountKRW.toLocaleString('ko-KR')}원\n이용 기간: ${expiry}\n단건 구매이며 자동 갱신하지 않습니다. 기본 리플레이 분석은 계속 무료입니다.\n제공·환불 등 추가 조건은 확정 전이며 실제 판매를 시작하지 않았습니다.\n조건 버전: ${product.termsVersion}` };
  return { ...d, digest: disclosureDigest(product, d) };
}
function saleDisclosure(product, document) {
  if (!exact(document, ['purpose', 'version', 'title', 'text']) || document.purpose !== 'sale') reject('CREDIT_PRODUCT_NOT_CONFIGURED', 503);
  const value = { ...document, digest: disclosureDigest(product, document) };
  if (!validDisclosure(product, value)) reject('CREDIT_PRODUCT_NOT_CONFIGURED', 503);
  return value;
}
function verifyAcknowledgement(product, request, expected) {
  if (!exact(request, ['accepted', 'version', 'digest']) || request.accepted !== true) reject('PURCHASE_ACKNOWLEDGEMENT_REQUIRED', 400);
  const d = expected || previewDisclosure(product);
  if (!validDisclosure(product, d)) reject('CREDIT_PRODUCT_NOT_CONFIGURED', 503);
  if (request.version !== d.version || request.digest !== d.digest) reject('ORDER_TERMS_CHANGED', 409);
  return d;
}
function acknowledgement(product, disclosure, acceptedAt) {
  if (!validDisclosure(product, disclosure) || !time(acceptedAt)) reject('CREDIT_STATE_INVALID', 503);
  return { schemaVersion: 1, ...disclosure, acceptedAt };
}
function validAcknowledgement(record, order) {
  return exact(record, ['schemaVersion', 'purpose', 'version', 'title', 'text', 'digest', 'acceptedAt'])
    && record.schemaVersion === 1 && validDocument(record) && time(record.acceptedAt) && record.acceptedAt === order.createdAt
    && record.digest === disclosureDigest(order, record);
}
const identity = r => ({ purpose: r.purpose, version: r.version, digest: r.digest, acceptedAt: r.acceptedAt });
function validIdentity(r, createdAt) {
  return exact(r, ['purpose', 'version', 'digest', 'acceptedAt']) && ['preview', 'sale'].includes(r.purpose) && id(r.version)
    && typeof r.digest === 'string' && /^[a-f0-9]{64}$/.test(r.digest) && time(r.acceptedAt) && r.acceptedAt === createdAt;
}
function sameAcknowledgement(a, b) {
  return hasAck(a) === hasAck(b) && (!hasAck(a)
    || ['purpose', 'version', 'digest', 'acceptedAt'].every(k => a.acknowledgement[k] === b.acknowledgement[k]));
}
module.exports = { saleDisclosure, previewDisclosure, verifyAcknowledgement, acknowledgement, validAcknowledgement, validDisclosure,
  hasAck, identity, validIdentity, sameAcknowledgement, disclosureDigest };
