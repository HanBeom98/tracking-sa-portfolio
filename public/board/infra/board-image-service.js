import { assertBoardAttachmentOwnership, isOwnedBoardImagePath } from '../domain/attachment-ownership.js?v=f5ecd5ffbd05';

export const BOARD_IMAGE_LIMIT = 3;
export const BOARD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BOARD_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FIREBASE_STORAGE_SDK_URL = 'https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js';
let storageRuntimePromise = null;

export function parseBoardImageToken(line, attachmentCount = BOARD_IMAGE_LIMIT) {
  const match = String(line || '').match(/^\[\[board-image:(\d+)\]\]$/);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 && index < attachmentCount ? index : null;
}

export function validateBoardImageFile(file) {
  if (!file || !BOARD_IMAGE_TYPES.has(file.type)) {
    throw Object.assign(new Error('IMAGE_TYPE_NOT_ALLOWED'), { code: 'IMAGE_TYPE_NOT_ALLOWED' });
  }
  if (file.size > BOARD_IMAGE_MAX_BYTES) {
    throw Object.assign(new Error('IMAGE_TOO_LARGE'), { code: 'IMAGE_TOO_LARGE' });
  }
}

export function normalizeBoardAttachment(attachment = {}) {
  const width = Math.min(100, Math.max(25, Number(attachment.width) || 100));
  const align = ['left', 'center', 'right'].includes(attachment.align) ? attachment.align : 'center';
  return {
    url: String(attachment.url || ''),
    path: String(attachment.path || ''),
    width,
    align,
    name: String(attachment.name || '').slice(0, 120),
  };
}

export async function optimizeBoardImage(file, { maxDimension = 1920, quality = 0.82 } = {}) {
  validateBoardImageFile(file);
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('IMAGE_OPTIMIZE_FAILED')),
      'image/webp',
      quality
    );
  });
}

export async function ensureBoardImageStorage(storage = globalThis.window?.storage) {
  if (storage) return storage;
  if (typeof window === 'undefined' || !window.firebase) return null;

  if (typeof window.firebase.storage === 'function') {
    window.storage = window.firebase.storage();
    return window.storage;
  }

  if (!storageRuntimePromise) {
    storageRuntimePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${FIREBASE_STORAGE_SDK_URL}"]`);
      const script = existing || document.createElement('script');
      const complete = () => {
        if (typeof window.firebase.storage !== 'function') {
          reject(new Error('IMAGE_STORAGE_NOT_READY'));
          return;
        }
        window.storage = window.firebase.storage();
        resolve(window.storage);
      };
      script.addEventListener('load', complete, { once: true });
      script.addEventListener('error', () => reject(new Error('IMAGE_STORAGE_NOT_READY')), { once: true });
      if (!existing) {
        script.src = FIREBASE_STORAGE_SDK_URL;
        document.head.appendChild(script);
      }
    }).catch((error) => {
      storageRuntimePromise = null;
      throw error;
    });
  }

  return storageRuntimePromise;
}

export async function uploadBoardImages({ items = [], uid, storage = null }) {
  if (!items.length) return { attachments: [], uploadedPaths: [] };
  assertBoardAttachmentOwnership(items.filter((item) => !item.file), uid);
  if (!isOwnedBoardImagePath(`board-images/${uid}/validation.webp`, uid)) throw new Error('IMAGE_STORAGE_NOT_READY');
  const resolvedStorage = await ensureBoardImageStorage(storage);
  if (!uid || !resolvedStorage) throw new Error('IMAGE_STORAGE_NOT_READY');

  const uploadedPaths = [];
  try {
    const attachments = [];
    for (const item of items.slice(0, BOARD_IMAGE_LIMIT)) {
      if (!item.file) {
        attachments.push(normalizeBoardAttachment(item));
        continue;
      }

      const blob = await optimizeBoardImage(item.file);
      const imageId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const path = `board-images/${uid}/${imageId}.webp`;
      const reference = resolvedStorage.ref(path);
      await reference.put(blob, {
        contentType: 'image/webp',
        customMetadata: { ownerUid: uid },
      });
      uploadedPaths.push(path);
      attachments.push(normalizeBoardAttachment({
        url: await reference.getDownloadURL(),
        path,
        width: item.width,
        align: item.align,
        name: item.file.name,
      }));
    }
    return { attachments, uploadedPaths };
  } catch (error) {
    error.imageCleanupResult = await deleteBoardImages(uploadedPaths, { ownerUid: uid, storage: resolvedStorage });
    throw error;
  }
}

export async function deleteBoardImages(paths = [], { ownerUid = '', storage = null } = {}) {
  // Never trust attachment paths from an existing post, even for an admin.
  const uniquePaths = [...new Set(paths)];
  const ownedPaths = uniquePaths.filter((path) => isOwnedBoardImagePath(path, ownerUid));
  const result = { deletedPaths: [], missingPaths: [], failed: [],
    skippedPaths: uniquePaths.filter((path) => !isOwnedBoardImagePath(path, ownerUid)) };
  if (!ownedPaths.length) return result;
  let resolvedStorage;
  try {
    resolvedStorage = await ensureBoardImageStorage(storage);
    if (!resolvedStorage) throw new Error('IMAGE_STORAGE_NOT_READY');
  } catch (error) {
    result.failed = ownedPaths.map((path) => ({ path, code: error.code || 'IMAGE_STORAGE_NOT_READY', attempts: 0 }));
    return result;
  }
  const outcomes = await Promise.all(ownedPaths.map(async (path) => {
    for (let attempts = 1; attempts <= 3; attempts++) {
      try {
        await resolvedStorage.ref(path).delete();
        return { path, status: 'deletedPaths' };
      } catch (error) {
        const code = error?.code || 'IMAGE_DELETE_FAILED';
        if (code === 'storage/object-not-found') return { path, status: 'missingPaths' };
        const transient = ['storage/retry-limit-exceeded', 'storage/unknown', 'storage/network-request-failed'].includes(code);
        if (!transient || attempts === 3) return { path, code, attempts, status: 'failed' };
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempts - 1)));
      }
    }
  }));
  for (const { path, status, code, attempts } of outcomes) {
    result[status].push(status === 'failed' ? { path, code, attempts } : path);
  }
  return result;
}
