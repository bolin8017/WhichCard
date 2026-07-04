import type { RewardRule } from '$lib/types';

export interface RateRange {
	min: number;
	max: number;
}

export function getRuleRateRange(rule: RewardRule): RateRange {
	const maxBonus =
		rule.tiers && rule.tiers.length > 0 ? Math.max(...rule.tiers.map((t) => t.bonus)) : 0;
	return { min: rule.rate, max: rule.maxTotalRate ?? rule.rate + maxBonus };
}

export function combineRateRanges(matched: RateRange, base?: RateRange): RateRange {
	if (!base) return matched;
	return { min: matched.min, max: Math.max(matched.max, base.max) };
}
