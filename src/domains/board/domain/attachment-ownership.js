const BOARD_IMAGE_BUCKETS = [
  'demo-tracking-sa-portfolio.firebasestorage.app',
  'demo-tracking-sa-portfolio.appspot.com',
];

export function isOwnedBoardImagePath(path, ownerUid) {
  if (typeof path !== 'string' || typeof ownerUid !== 'string' || !ownerUid) return false;
  if (ownerUid === '.' || ownerUid === '..' || /[\\/%?#\s]/.test(ownerUid)) return false;
  const parts = path.split('/');
  return parts.length === 3 && parts[0] === 'board-images' && parts[1] === ownerUid
    && /^[A-Za-z0-9-]+[.]webp$/.test(parts[2]);
}

export function isOwnedBoardAttachment(attachment, ownerUid) {
  if (!isOwnedBoardImagePath(attachment?.path, ownerUid) || typeof attachment?.url !== 'string') return false;
  try {
    const url = new URL(attachment.url);
    if (url.protocol !== 'https:' || url.host !== 'firebasestorage.googleapis.com'
      || url.username || url.password || url.hash) return false;
    return BOARD_IMAGE_BUCKETS.some((bucket) => (
      url.pathname === `/v0/b/${bucket}/o/${encodeURIComponent(attachment.path)}`
    ));
  } catch {
    return false;
  }
}

export function assertBoardAttachmentOwnership(attachments, ownerUid) {
  if (!Array.isArray(attachments) || attachments.some((item) => !isOwnedBoardAttachment(item, ownerUid))) {
    throw Object.assign(new Error('IMAGE_ATTACHMENT_NOT_OWNED'), { code: 'IMAGE_ATTACHMENT_NOT_OWNED' });
  }
}
