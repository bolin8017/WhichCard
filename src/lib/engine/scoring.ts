import type { RewardRule } from '$lib/types';

export function getRuleMaxReward(rule: RewardRule): number {
	const maxBonus =
		rule.tiers && rule.tiers.length > 0
			? Math.max(...rule.tiers.map((t) => t.bonus))
			: 0;
	return rule.rate + maxBonus;
}

export function computeMaxReward(matchedRule: RewardRule, baseRule?: RewardRule): number {
	const matchedMax = getRuleMaxReward(matchedRule);
	if (!baseRule) return matchedMax;
	return Math.max(matchedMax, getRuleMaxReward(baseRule));
}
