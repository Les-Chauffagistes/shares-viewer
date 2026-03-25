import { Injectable } from "@nestjs/common";

@Injectable()
export class LevelService {
  computeXpGain(params: {
    bestShare: number;
    sharesCount: number;
    streak: number;
  }): number {
    const participationBase = 10;
    const streakBonus = params.streak * 2;
    const qualityBonus = Math.log10((params.bestShare || 0) + 1) * 12;
    const activityBonus = Math.min(params.sharesCount, 20) * 0.5;

    return Number(
      (participationBase + streakBonus + qualityBonus + activityBonus).toFixed(2),
    );
  }

  computeLevel(totalXp: number): number {
    return Math.floor(Math.sqrt(totalXp / 25)) + 1;
  }
}