export function formatHash(value: number): string {
  if (!value || value < 1_000) {
    return Math.round(value || 0).toString();
  }

  const units = ["K", "M", "G", "T", "P"];
  let unitIndex = -1;
  let num = value;

  while (num >= 1_000 && unitIndex < units.length - 1) {
    num /= 1_000;
    unitIndex++;
  }

  const precision =
    num >= 100 ? 0 :
    num >= 10 ? 1 :
    2;

  return `${num.toFixed(precision)}${units[unitIndex]}`;
}