import { Injectable } from "@nestjs/common";

@Injectable()
export class LevelService {
  /**
   * XP gagnée sur un round.
   *
   * Règles :
   * - 0 share => 0 XP
   * - sharesCount ne sert que de condition d'éligibilité
   * - bestShare est le facteur principal
   * - streak est un multiplicateur important mais contrôlé
   */
  computeXpGain(params: {
    bestShare: number;
    sharesCount: number;
    streak: number;
  }): number {
    const { bestShare, sharesCount, streak } = params;

    if (sharesCount <= 0) {
      return 0;
    }

    const safeBestShare = Math.max(0, bestShare);
    const safeStreak = Math.max(0, streak);

    const participationBase = 15;

    const bestShareScore = Math.pow(Math.log10(safeBestShare + 1), 2.35) * 9;

    const streakMultiplier = 1 + Math.min(Math.sqrt(safeStreak) * 0.18, 2.5);

    const xp = (participationBase + bestShareScore) * streakMultiplier;

    return Math.round(xp);
  }

  /**
   * XP totale requise pour atteindre un niveau donné.
   *
   * Calibration cible :
   * - niveau 100 ≈ 1 an
   * - niveau 600 ≈ 10 ans
   *
   * Hypothèse de référence utilisée ici :
   * - ~1 647 XP / round
   * - ~144 rounds / jour
   *
   * Donc :
   * - xp niveau 100 ≈ 86 566 320
   * - xp niveau 600 ≈ 865 663 200
   *
   * Niveau 1 : 0 XP
   */
  xpRequiredForLevel(level: number): number {
    if (level <= 1) {
      return 0;
    }

    const n = level - 1;

    /**
     * Courbe de base calibrée pour :
     * - lvl 100 = ~86.6M XP
     * - lvl 600 = ~865.7M XP
     */
    const A = 242496.57683726068;
    const P = 1.2791132118216553;

    const baseXp = A * Math.pow(n, P);

    /**
     * Easing early game :
     * - rend les premiers niveaux beaucoup plus accessibles
     * - rejoint progressivement la courbe de base au niveau 100
     *
     * lvl 2 = 2% de la courbe brute
     * lvl 100 = 100% de la courbe brute
     */
    if (level < 100) {
      const t = (level - 2) / 98;
      const minFactor = 0.02;
      const easePower = 1.25;

      const easingFactor =
        minFactor + (1 - minFactor) * Math.pow(t, easePower);

      return Math.floor(baseXp * easingFactor);
    }

    return Math.floor(baseXp);
  }

  /**
   * Calcule le niveau à partir de l'XP totale.
   */
  computeLevel(totalXp: number): number {
    const xp = Math.max(0, totalXp);

    let level = 1;

    while (xp >= this.xpRequiredForLevel(level + 1)) {
      level++;
    }

    return level;
  }

  /**
   * XP restante avant le prochain niveau.
   */
  xpToNextLevel(totalXp: number): number {
    const xp = Math.max(0, totalXp);
    const currentLevel = this.computeLevel(xp);
    const nextLevelXp = this.xpRequiredForLevel(currentLevel + 1);

    return Math.max(0, nextLevelXp - xp);
  }

  /**
   * Progression entre le niveau courant et le suivant.
   * Retourne une valeur entre 0 et 1.
   */
  progressInCurrentLevel(totalXp: number): number {
    const xp = Math.max(0, totalXp);
    const currentLevel = this.computeLevel(xp);

    const currentLevelXp = this.xpRequiredForLevel(currentLevel);
    const nextLevelXp = this.xpRequiredForLevel(currentLevel + 1);

    if (nextLevelXp <= currentLevelXp) {
      return 1;
    }

    return Math.max(
      0,
      Math.min(1, (xp - currentLevelXp) / (nextLevelXp - currentLevelXp)),
    );
  }
}