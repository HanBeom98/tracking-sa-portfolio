function isVividRune(r, g, b) {
    return r >= 170 && b >= 125 && r - g >= 43 && b - g >= 29 && r + 35 >= b;
}

function isMutedRune(r, g, b) {
    return r >= 115 && b >= 125 && r - g >= 35 && b - g >= 40 && b >= r - 25 && b <= r + 65;
}

function hasBrightOutline({ data, width, height }, { left, right, top, bottom, cx, cy }) {
    let leftEdge = false;
    let rightEdge = false;
    let topEdge = false;
    let bottomEdge = false;

    for (let y = Math.max(0, top - 3); y <= Math.min(height - 1, bottom + 3); y++) {
        for (let x = Math.max(0, left - 3); x <= Math.min(width - 1, right + 3); x++) {
            if (x >= left && x <= right && y >= top && y <= bottom) continue;
            const pixel = (y * width + x) * 4;
            const r = data[pixel];
            const g = data[pixel + 1];
            const b = data[pixel + 2];
            const darkest = Math.min(r, g, b);
            if (darkest < 100 || Math.max(r, g, b) - darkest > 39) continue;
            if (Math.abs(y - cy) <= 1) {
                leftEdge ||= x < left;
                rightEdge ||= x > right;
            }
            if (Math.abs(x - cx) <= 1) {
                topEdge ||= y < top;
                bottomEdge ||= y > bottom;
            }
        }
    }

    return Number(leftEdge) + Number(rightEdge) + Number(topEdge) + Number(bottomEdge) >= 3;
}

function findRuneByColor(image, isRuneColor, requireOutline) {
    const { data, width, height } = image;
    // Resampling can weaken and shrink the colored center of a small marker.
    const minSize = requireOutline ? 3 : 4;
    const maxSize = requireOutline ? 12 : 30;
    const mask = new Uint8Array(width * height);
    const queue = new Int32Array(mask.length);
    for (let i = 0; i < mask.length; i++) {
        const pixel = i * 4;
        const r = data[pixel];
        const g = data[pixel + 1];
        const b = data[pixel + 2];
        mask[i] = isRuneColor(r, g, b);
    }

    for (let i = 0; i < mask.length; i++) {
        if (!mask[i]) continue;

        let count = 1;
        let left = width;
        let right = 0;
        let top = height;
        let bottom = 0;
        mask[i] = 0;
        queue[0] = i;

        for (let j = 0; j < count; j++) {
            const pixel = queue[j];
            const x = pixel % width;
            const y = Math.floor(pixel / width);
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);

            for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
                for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
                    const neighbor = ny * width + nx;
                    if (!mask[neighbor]) continue;
                    mask[neighbor] = 0;
                    queue[count++] = neighbor;
                }
            }
        }

        const w = right - left + 1;
        const h = bottom - top + 1;
        const fill = count / (w * h);
        if (w < minSize || h < minSize || w > maxSize || h > maxSize || w / h < 0.7 || w / h > 1.4
            || fill < 0.37 || fill > 0.72 || left === 0 || top === 0
            || right === width - 1 || bottom === height - 1) continue;

        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        let inside = 0;
        for (let j = 0; j < count; j++) {
            const x = queue[j] % width;
            const y = Math.floor(queue[j] / width);
            if (Math.abs(x - cx) / (w / 2) + Math.abs(y - cy) / (h / 2) <= 1.13) inside++;
        }
        if (inside / count < (requireOutline ? 0.78 : 0.9)) continue;
        if (!requireOutline || hasBrightOutline(image, { left, right, top, bottom, cx, cy })) return { x: cx, y: cy };
    }

    return null;
}

export function findRune(image) {
    return findRuneByColor(image, isVividRune, false) ?? findRuneByColor(image, isMutedRune, true);
}

export function detectionState() {
    return { present: 0, absent: 0, latched: false };
}

export function confirmDetection(state, present) {
    if (!present) {
        state.present = 0;
        if (++state.absent >= 3) state.latched = false;
        return false;
    }

    state.absent = 0;
    if (state.latched || ++state.present < 3) return false;
    state.latched = true;
    return true;
}
