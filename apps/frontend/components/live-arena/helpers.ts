export function roundHexToDecimal(round: string | null): string {
  if (!round) return "Aucun";

  const parsed = parseInt(round, 16);
  if (Number.isNaN(parsed)) return round;

  return `${round} (${parsed.toLocaleString("fr-FR")})`;
}

export function extractMinerName(workerName: string): string {
  if (!workerName) return "worker?";

  const parts = workerName.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : workerName;
}