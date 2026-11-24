import { finiteNumber } from './share-card-model.js';

export const SHARE_PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const SHARE_PROFILE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function getShareProfileImageError(file) {
  if (!file) return '사진을 선택해 주세요.';
  if (!SHARE_PROFILE_IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
    return 'PNG, JPG, WebP 이미지만 사용할 수 있습니다.';
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > SHARE_PROFILE_IMAGE_MAX_BYTES) {
    return '프로필 사진은 5MB 이하만 사용할 수 있습니다.';
  }
  return '';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getShareProfilePlacement(imageWidth, imageHeight, frameWidth, frameHeight, adjustment = {}) {
  const zoom = clamp(finiteNumber(adjustment.zoom, 1), .5, 3);
  const focusX = clamp(finiteNumber(adjustment.focusX, .5), 0, 1);
  const focusY = clamp(finiteNumber(adjustment.focusY, .5), 0, 1);
  const coverScale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
  const width = imageWidth * coverScale * zoom;
  const height = imageHeight * coverScale * zoom;
  return {
    x: width > frameWidth ? (frameWidth - width) * focusX : (frameWidth - width) / 2,
    y: height > frameHeight ? (frameHeight - height) * focusY : (frameHeight - height) / 2,
    width,
    height,
  };
}

export function createShareProfileImageController({
  panel, status, profileImageInput, resetProfileImageButton, profileAdjustments,
  profileZoomInput, profileZoomValue, resetProfilePositionButton,
  documentRef, urlRef, windowRef, ResizeObserverRef, onImageSelected
}) {
  let profileImageUrl = '';
  let profileImageDimensions = null;
  let profileAdjustment = { zoom: 1, focusX: .5, focusY: .5 };
  let dragState = null;

  function syncProfileImagePreview() {
    const image = panel?.querySelector('[data-share-profile-image]');
    const frame = panel?.querySelector('[data-share-profile-frame]');
    if (image) {
      image.src = profileImageUrl;
      image.hidden = !profileImageUrl;
      if (profileImageUrl && profileImageDimensions && frame?.clientWidth && frame?.clientHeight) {
        const placement = getShareProfilePlacement(
          profileImageDimensions.width,
          profileImageDimensions.height,
          frame.clientWidth,
          frame.clientHeight,
          profileAdjustment,
        );
        image.style.left = `${placement.x}px`;
        image.style.top = `${placement.y}px`;
        image.style.width = `${placement.width}px`;
        image.style.height = `${placement.height}px`;
      } else {
        image.style.left = '';
        image.style.top = '';
        image.style.width = '';
        image.style.height = '';
      }
      image.parentElement?.classList.toggle('has-custom-image', Boolean(profileImageUrl));
    }
    resetProfileImageButton?.classList.toggle('hidden', !profileImageUrl);
    profileAdjustments?.classList.toggle('hidden', !profileImageUrl);
    if (profileZoomInput) profileZoomInput.value = String(Math.round(profileAdjustment.zoom * 100));
    if (profileZoomValue) profileZoomValue.textContent = `${Math.round(profileAdjustment.zoom * 100)}%`;
  }

  function resetProfilePosition({ announce = false } = {}) {
    profileAdjustment = { zoom: 1, focusX: .5, focusY: .5 };
    syncProfileImagePreview();
    if (announce && status) status.textContent = '사진 위치와 확대 비율을 초기화했습니다.';
  }

  function resetProfileImage({ announce = false } = {}) {
    if (profileImageUrl) urlRef?.revokeObjectURL?.(profileImageUrl);
    profileImageUrl = '';
    profileImageDimensions = null;
    if (profileImageInput) profileImageInput.value = '';
    resetProfilePosition();
    syncProfileImagePreview();
    if (announce && status) status.textContent = '기본 이미지로 돌아왔습니다.';
  }

  function verifyImage(url) {
    return new Promise((resolve, reject) => {
      const image = documentRef.createElement('img');
      image.onload = () => resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
      image.onerror = () => reject(new Error('INVALID_PROFILE_IMAGE'));
      image.src = url;
    });
  }

  async function selectProfileImage() {
    const file = profileImageInput?.files?.[0];
    const validationError = getShareProfileImageError(file);
    if (validationError) {
      if (profileImageInput) profileImageInput.value = '';
      if (status) status.textContent = validationError;
      return;
    }
    const nextUrl = urlRef?.createObjectURL?.(file);
    if (!nextUrl) {
      if (status) status.textContent = '사진을 불러오지 못했습니다. 다시 선택해 주세요.';
      return;
    }
    try {
      const dimensions = await verifyImage(nextUrl);
      if (profileImageUrl) urlRef.revokeObjectURL(profileImageUrl);
      profileImageUrl = nextUrl;
      profileImageDimensions = dimensions;
      resetProfilePosition();
      syncProfileImagePreview();
      onImageSelected();
      windowRef?.requestAnimationFrame?.(syncProfileImagePreview);
      if (status) status.textContent = '이 사진은 현재 카드에만 적용됩니다.';
    } catch {
      urlRef.revokeObjectURL(nextUrl);
      if (profileImageInput) profileImageInput.value = '';
      if (status) status.textContent = '올바른 이미지 파일을 선택해 주세요.';
    }
  }

  function updateZoom() {
    profileAdjustment.zoom = clamp(Number(profileZoomInput?.value) / 100 || 1, .5, 3);
    syncProfileImagePreview();
  }

  function startProfileDrag(event) {
    if (!profileImageUrl || event.button > 0) return;
    const frame = panel?.querySelector('[data-share-profile-frame]');
    if (!frame) return;
    dragState = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      focusX: profileAdjustment.focusX,
      focusY: profileAdjustment.focusY,
      width: frame.clientWidth || 1,
      height: frame.clientHeight || 1,
    };
    frame.classList.add('is-dragging');
    frame.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function moveProfileImage(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const placement = profileImageDimensions
      ? getShareProfilePlacement(
        profileImageDimensions.width,
        profileImageDimensions.height,
        dragState.width,
        dragState.height,
        profileAdjustment,
      )
      : null;
    if (placement?.width > dragState.width) {
      profileAdjustment.focusX = clamp(
        dragState.focusX - (event.clientX - dragState.x) / (placement.width - dragState.width),
        0,
        1,
      );
    }
    if (placement?.height > dragState.height) {
      profileAdjustment.focusY = clamp(
        dragState.focusY - (event.clientY - dragState.y) / (placement.height - dragState.height),
        0,
        1,
      );
    }
    syncProfileImagePreview();
    event.preventDefault();
  }

  function endProfileDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const frame = panel?.querySelector('[data-share-profile-frame]');
    frame?.classList.remove('is-dragging');
    frame?.releasePointerCapture?.(event.pointerId);
    dragState = null;
  }

  profileImageInput?.addEventListener('change', selectProfileImage);
  resetProfileImageButton?.addEventListener('click', () => resetProfileImage({ announce: true }));
  profileZoomInput?.addEventListener('input', updateZoom);
  resetProfilePositionButton?.addEventListener('click', () => resetProfilePosition({ announce: true }));
  const profileFrame = panel?.querySelector('[data-share-profile-frame]');
  profileFrame?.addEventListener('pointerdown', startProfileDrag);
  profileFrame?.addEventListener('pointermove', moveProfileImage);
  profileFrame?.addEventListener('pointerup', endProfileDrag);
  profileFrame?.addEventListener('pointercancel', endProfileDrag);
  const profileFrameObserver = profileFrame && ResizeObserverRef
    ? new ResizeObserverRef(syncProfileImagePreview)
    : null;
  profileFrameObserver?.observe(profileFrame);

  return {
    resetProfileImage,
    resetProfilePosition,
    syncPreview: syncProfileImagePreview,
    getImageOptions: () => ({ profileImageUrl, profileAdjustment: { ...profileAdjustment } }),
  };
}
