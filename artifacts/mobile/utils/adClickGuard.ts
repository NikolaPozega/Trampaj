const clickLog: number[] = [];
const COOLDOWN_MS = 2500;
const MAX_PER_MINUTE = 8;

export function guardAdClick(openFn: () => void): void {
  const now = Date.now();

  while (clickLog.length > 0 && now - clickLog[0]! > 60_000) {
    clickLog.shift();
  }

  const last = clickLog[clickLog.length - 1];
  if (last !== undefined && now - last < COOLDOWN_MS) return;
  if (clickLog.length >= MAX_PER_MINUTE) return;

  clickLog.push(now);
  openFn();
}
