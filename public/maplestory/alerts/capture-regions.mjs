export function frameSizeKey({ width, height }) {
    return `${width}x${height}`;
}

export function sameCaptureViewport(a, b) {
    return a === b || Boolean(a && b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);
}

export function captureViewport({ width, height }, rect) {
    if (!rect) return { x: 0, y: 0, width, height };
    const x = Math.round(rect.x * width);
    const y = Math.round(rect.y * height);
    return { x, y, width: Math.round((rect.x + rect.w) * width) - x, height: Math.round((rect.y + rect.h) * height) - y };
}

export function savedCaptureRegions(saved) {
    const regions = saved?.rect ? [saved] : Object.values(saved ?? {});
    return Object.fromEntries(regions.filter((region) => {
        const { width, height, rect } = region ?? {};
        return Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0 &&
            rect && rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0 &&
            rect.x + rect.w <= 1.000001 && rect.y + rect.h <= 1.000001;
    })
        .map((region) => [frameSizeKey(region), region]));
}
