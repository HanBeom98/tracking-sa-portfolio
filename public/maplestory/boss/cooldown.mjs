const percentPerFixedSecond = .05;
const fixedThreshold = 10;
const fixedMinimum = 5;

export function adjustedCooldownSeconds(baseSeconds, reduction) {
    const percent = reduction?.percent ?? 0;
    const fixed = reduction?.fixedSeconds ?? 0;
    const afterPercent = baseSeconds * (1 - percent / 100);
    if (fixed <= 0 || afterPercent <= fixedMinimum) return afterPercent;

    const secondsAboveThreshold = Math.max(0, afterPercent - fixedThreshold);
    const fixedAsSeconds = Math.min(fixed, secondsAboveThreshold);
    const remainingFixed = fixed - fixedAsSeconds;
    return Math.max(fixedMinimum, (afterPercent - fixedAsSeconds) * (1 - remainingFixed * percentPerFixedSecond));
}
