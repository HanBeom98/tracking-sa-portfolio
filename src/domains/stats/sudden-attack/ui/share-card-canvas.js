import { formatMetric } from './share-card-model.js';
import { getShareProfilePlacement } from './share-profile-image.js';

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 675;
export function withDeadline(promise, milliseconds) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('CARD_IMAGE_TIMEOUT'), { name: 'TimeoutError', code: 'REQUEST_TIMEOUT' })), milliseconds); }),
  ]).finally(() => clearTimeout(timer));
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.closePath();
}

function drawMetricIcon(context, type, x, y) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = '#8994a4';
  context.lineWidth = 2.2;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  if (type === 'win') {
    context.rect(-6, -8, 12, 7);
    context.moveTo(-6, -6); context.lineTo(-11, -6); context.quadraticCurveTo(-10, 0, -5, 1);
    context.moveTo(6, -6); context.lineTo(11, -6); context.quadraticCurveTo(10, 0, 5, 1);
    context.moveTo(0, -1); context.lineTo(0, 6); context.moveTo(-5, 8); context.lineTo(5, 8);
  } else if (type === 'kd') {
    context.arc(0, 0, 7, 0, Math.PI * 2);
    context.moveTo(0, -11); context.lineTo(0, -6); context.moveTo(0, 6); context.lineTo(0, 11);
    context.moveTo(-11, 0); context.lineTo(-6, 0); context.moveTo(6, 0); context.lineTo(11, 0);
    context.moveTo(2, 0); context.arc(0, 0, 2, 0, Math.PI * 2);
  } else if (type === 'headshot') {
    context.arc(0, -3, 5, 0, Math.PI * 2);
    context.moveTo(-7, 10); context.quadraticCurveTo(-6, 3, 0, 3); context.quadraticCurveTo(6, 3, 7, 10);
    context.moveTo(4, -8); context.lineTo(10, -12); context.moveTo(7, -12); context.lineTo(10, -12); context.lineTo(10, -9);
  } else {
    const sniper = type === 'sniper';
    const smg = type === 'special';
    const left = sniper ? -12 : -10;
    const right = sniper ? 9 : (smg ? 8 : 7);
    context.moveTo(left, -4); context.lineTo(right, -4);
    context.lineTo(12, -1); context.lineTo(12, 3); context.lineTo(-2, 3);
    context.lineTo(-5, 10); context.lineTo(-9, 10); context.lineTo(-7, 3); context.lineTo(left, 3); context.closePath();
    context.moveTo(-5, -4); context.lineTo(-5, -8); context.lineTo(smg ? 3 : 5, -8); context.lineTo(smg ? 3 : 5, -4);
    if (sniper) {
      context.moveTo(0, -8); context.lineTo(9, -8);
      context.moveTo(5, -11); context.lineTo(5, -5);
    } else {
      context.moveTo(2, 3); context.lineTo(5, 9);
    }
  }
  context.stroke();
  context.restore();
}

function drawMetric(context, type, label, value, x, y) {
  context.textAlign = 'center';
  context.fillStyle = '#8994a4';
  context.font = '700 19px "Arial", "Noto Sans KR", sans-serif';
  const labelWidth = context.measureText(label).width;
  drawMetricIcon(context, type, x - labelWidth / 2 - 15, y - 6);
  context.fillText(label, x + 8, y);
  context.fillStyle = '#25c8ff';
  context.font = '900 29px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(value, x, y + 38);
  context.textAlign = 'left';
}

function drawTierCard(context, label, tier, image, x, y, width) {
  context.fillStyle = 'rgba(255,255,255,.025)';
  context.strokeStyle = 'rgba(37,200,255,.2)';
  context.lineWidth = 1.5;
  roundedRect(context, x, y, width, 112, 14);
  context.fill();
  context.stroke();

  context.fillStyle = '#8994a4';
  context.font = '800 17px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(label, x + 18, y + 30);
  if (image) context.drawImage(image, x + 18, y + 48, 42, 42);
  context.fillStyle = '#f7f9fc';
  context.font = '900 22px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(tier || 'UNRANK', x + 72, y + 78, width - 88);
}

function drawCoverImage(context, image, x, y, width, height, adjustment) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const placement = getShareProfilePlacement(
    sourceWidth,
    sourceHeight,
    width,
    height,
    adjustment,
  );
  context.drawImage(
    image,
    x + placement.x,
    y + placement.y,
    placement.width,
    placement.height,
  );
}

function drawEmblemSlot(context, profileImage, profileAdjustment) {
  const x = 32;
  const y = 32;
  const width = 292;
  const height = 544;
  const panel = context.createLinearGradient(x, y, x + width, y + height);
  panel.addColorStop(0, '#16191d');
  panel.addColorStop(1, '#0d1014');
  context.fillStyle = panel;
  context.strokeStyle = 'rgba(37,200,255,.58)';
  context.lineWidth = 3;
  roundedRect(context, x, y, width, height, 18);
  context.fill();
  context.stroke();

  if (profileImage) {
    context.save();
    roundedRect(context, x + 2, y + 2, width - 4, height - 4, 16);
    context.clip();
    drawCoverImage(context, profileImage, x + 2, y + 2, width - 4, height - 4, profileAdjustment);
    const shade = context.createLinearGradient(x, y + height * .55, x, y + height);
    shade.addColorStop(0, 'rgba(4,9,14,0)');
    shade.addColorStop(1, 'rgba(4,9,14,.55)');
    context.fillStyle = shade;
    context.fillRect(x, y, width, height);
    context.restore();
  } else {
  const glow = context.createRadialGradient(178, 320, 12, 178, 320, 150);
  glow.addColorStop(0, 'rgba(255,255,255,.13)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = glow;
  context.fillRect(x, y, width, height);

  [[96, 190, 5], [260, 208, 7], [248, 390, 6], [92, 430, 5]].forEach(([px, py, radius]) => {
    context.fillStyle = 'rgba(220,228,240,.3)';
    context.beginPath();
    context.arc(px, py, radius, 0, Math.PI * 2);
    context.fill();
  });

  context.save();
  context.translate(178, 330);
  context.rotate(-0.13);
  context.textAlign = 'center';
  context.fillStyle = 'rgba(230,235,244,.34)';
  context.font = '950 37px "Arial Black", "Arial", sans-serif';
  context.fillText('Tracking', 0, -11);
  context.fillStyle = 'rgba(165,174,188,.48)';
  context.font = '950 82px "Arial Black", "Arial", sans-serif';
  context.fillText('SA', 0, 66);
  context.restore();
  }

  context.fillStyle = '#25c8ff';
  context.font = '800 18px "Arial", sans-serif';
  context.textAlign = 'left';
  context.fillText('TrackingSA.com', x + 16, 626);
  context.textAlign = 'left';
}

export function drawShareCard(canvas, model, assets = {}) {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext('2d');
  const background = context.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  background.addColorStop(0, '#17191d');
  background.addColorStop(1, '#0f1115');
  context.fillStyle = background;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  context.strokeStyle = 'rgba(37,200,255,.22)';
  context.lineWidth = 1;
  roundedRect(context, 12, 12, 1056, 651, 18);
  context.stroke();

  drawEmblemSlot(context, assets.profileImage, assets.profileAdjustment);

  const contentX = 368;
  context.fillStyle = '#9ba5b5';
  context.font = '700 18px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(model.clanName || (model.isCrew ? 'interval' : '공개 전적'), contentX + 72, 70);
  if (assets.rankImage) {
    context.save();
    context.shadowColor = 'rgba(37,200,255,.5)';
    context.shadowBlur = 18;
    context.drawImage(assets.rankImage, contentX, 82, 58, 58);
    context.restore();
  } else {
    context.fillStyle = 'rgba(220,228,240,.12)';
    roundedRect(context, contentX, 82, 58, 58, 13);
    context.fill();
    context.fillStyle = '#aeb7c5';
    context.font = '900 18px "Arial", "Noto Sans KR", sans-serif';
    context.textAlign = 'center';
    context.fillText((model.rankName || 'SA').slice(0, 2), contentX + 29, 117);
    context.textAlign = 'left';
  }
  context.fillStyle = '#f8f9fb';
  context.font = '900 40px "Arial", "Noto Sans KR", sans-serif';
  context.fillText(model.nickname, contentX + 72, 126, 600);
  context.strokeStyle = 'rgba(37,200,255,.2)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(contentX, 166);
  context.lineTo(1040, 166);
  context.stroke();

  drawTierCard(context, '솔랭', model.soloTier, assets.soloImage, contentX, 188, 322);
  drawTierCard(context, '파랭', model.partyTier, assets.partyImage, 706, 188, 332);
  context.strokeStyle = 'rgba(37,200,255,.16)';
  context.beginPath();
  context.moveTo(contentX, 324);
  context.lineTo(1040, 324);
  context.stroke();

  const columns = [454, 704, 954];
  drawMetric(context, 'win', '승률', `${formatMetric(model.winRate, 0)}%`, columns[0], 382);
  drawMetric(context, 'kd', '킬뎃', `${formatMetric(model.kdPercent, 1)}%`, columns[1], 382);
  drawMetric(context, 'headshot', '헤드샷', `${formatMetric(model.headshotRate, 1)}%`, columns[2], 382);
  drawMetric(context, 'assault', '라플', `${formatMetric(model.assaultRate, 1)}%`, columns[0], 492);
  drawMetric(context, 'sniper', '스나', `${formatMetric(model.sniperRate, 1)}%`, columns[1], 492);
  drawMetric(context, 'special', '특수', `${formatMetric(model.specialRate, 1)}%`, columns[2], 492);

  context.fillStyle = '#707986';
  context.font = '700 15px "Arial", "Noto Sans KR", sans-serif';
  context.textAlign = 'right';
  context.fillText(`${model.date} · 최근 ${model.matchCount || 0}경기`, 1038, 636);
  context.textAlign = 'left';
  return canvas;
}

export async function createShareCardBlob(
  model,
  documentRef = document,
  { profileImageUrl = '', profileAdjustment } = {},
) {
  // A font or decorative badge must not leave image generation pending forever.
  await withDeadline(Promise.resolve(documentRef.fonts?.ready), 2000).catch(() => {});
  const canvas = documentRef.createElement('canvas');
  const apiBaseUrl = String(globalThis.runtimeConfig?.apiBaseUrl || '').replace(/\/$/, '');
  const imageProxyUrl = apiBaseUrl ? `${apiBaseUrl}/sa-image` : '/api/sa-image';
  const proxyImageSource = (src) => {
    if (!src) return '';
    try {
      const url = new URL(src);
      if (url.origin !== 'https://open.api.nexon.com'
        || !/^\/static\/suddenattack\/img\/[a-f0-9]{32}$/i.test(url.pathname)) return '';
      return `${imageProxyUrl}?path=${encodeURIComponent(url.pathname)}`;
    } catch {
      return '';
    }
  };
  const loadImage = (src, { crossOrigin = true } = {}) => {
    if (!src) return Promise.resolve(null);
    return new Promise((resolve) => {
      const image = documentRef.createElement('img');
      const finish = value => {
        clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        resolve(value);
      };
      const timer = setTimeout(() => { finish(null); image.removeAttribute('src'); }, 6000);
      if (crossOrigin) image.crossOrigin = 'anonymous';
      image.onload = () => finish(image);
      image.onerror = () => finish(null);
      image.src = src;
    });
  };
  const [rankImage, soloImage, partyImage, profileImage] = await Promise.all([
    loadImage(proxyImageSource(model.rankImage)),
    loadImage(proxyImageSource(model.soloImage)),
    loadImage(proxyImageSource(model.partyImage)),
    loadImage(profileImageUrl, { crossOrigin: false }),
  ]);
  drawShareCard(canvas, model, {
    rankImage,
    soloImage,
    partyImage,
    profileImage,
    profileAdjustment,
  });
  return withDeadline(new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('CARD_IMAGE_FAILED')), 'image/png', 1);
  }), 5000);
}

