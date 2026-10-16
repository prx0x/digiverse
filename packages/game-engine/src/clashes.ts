import type { ClashResolution, TeamPick } from './types.js';

/**
 * Resolves clashing picks among teams.
 * When two or more teams pick the exact same number, their picks clash and are discarded
 * from statistical calculations.
 */
export function resolveClashes(picks: TeamPick[]): ClashResolution {
  const countMap = new Map<number, TeamPick[]>();

  for (const item of picks) {
    const list = countMap.get(item.pick) ?? [];
    list.push(item);
    countMap.set(item.pick, list);
  }

  const validPicks: TeamPick[] = [];
  const clashingPicks: TeamPick[] = [];
  const clashGroups: Record<number, string[]> = {};

  for (const [pick, teamList] of countMap.entries()) {
    if (teamList.length === 1) {
      validPicks.push(teamList[0]);
    } else {
      clashGroups[pick] = teamList.map((t) => t.teamId);
      for (const t of teamList) {
        clashingPicks.push(t);
      }
    }
  }

  // Sort deterministically by pick then teamId
  validPicks.sort((a, b) => a.pick - b.pick || a.teamId.localeCompare(b.teamId));
  clashingPicks.sort((a, b) => a.pick - b.pick || a.teamId.localeCompare(b.teamId));

  return {
    validPicks,
    clashingPicks,
    clashGroups,
  };
}
