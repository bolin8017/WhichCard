import { describe, it, expect } from 'vitest';
import { getRuleMaxReward, computeMaxReward } from '$lib/engine/scoring';
import type { RewardRule } from '$lib/types';

const makeRule = (overrides: Partial<RewardRule> = {}): RewardRule => ({
	stores: ['*'],
	region: 'domestic',
	rate: 1,
	limit: 0,
	limitUnit: '元',
	...overrides
});

describe('getRuleMaxReward', () => {
	it('rule with no tiers: maxReward = rate', () => {
		expect(getRuleMaxReward(makeRule({ rate: 1.5 }))).toBe(1.5);
	});

	it('rule with tiers: maxReward = rate + max(tier.bonus)', () => {
		const rule = makeRule({
			rate: 1,
			tiers: [
				{ label: 'A', bonus: 2.5, limit: 400, limitUnit: '元', condition: 'cond A' },
				{ label: 'B', bonus: 4, limit: 1000, limitUnit: '元', condition: 'cond B' }
			]
		});
		expect(getRuleMaxReward(rule)).toBe(5); // 1 + 4
	});

	it('rate 0 with tiers: maxReward = max(tier.bonus)', () => {
		const rule = makeRule({
			rate: 0,
			tiers: [
				{ label: 'A', bonus: 3, limit: 100, limitUnit: '元', condition: 'cond' },
				{ label: 'B', bonus: 5, limit: 500, limitUnit: '元', condition: 'cond' }
			]
		});
		expect(getRuleMaxReward(rule)).toBe(5); // 0 + 5
	});

	it('empty tiers array: maxReward = rate', () => {
		expect(getRuleMaxReward(makeRule({ rate: 2, tiers: [] }))).toBe(2);
	});
});

describe('computeMaxReward', () => {
	it('single rule: uses that rule reward', () => {
		const specific = makeRule({ rate: 3 });
		expect(computeMaxReward(specific)).toBe(3);
	});

	it('specific + wildcard: takes max of both', () => {
		const specific = makeRule({ rate: 3 });
		const wildcard = makeRule({
			rate: 1,
			tiers: [{ label: 'X', bonus: 4, limit: 0, limitUnit: '元', condition: 'c' }]
		});
		expect(computeMaxReward(specific, wildcard)).toBe(5); // max(3, 1+4)
	});

	it('specific higher than wildcard', () => {
		const specific = makeRule({
			rate: 3,
			tiers: [{ label: 'X', bonus: 5, limit: 0, limitUnit: '元', condition: 'c' }]
		});
		const wildcard = makeRule({ rate: 1 });
		expect(computeMaxReward(specific, wildcard)).toBe(8); // max(3+5, 1)
	});
});
