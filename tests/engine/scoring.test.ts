import { describe, it, expect } from 'vitest';
import { getRuleRateRange, combineRateRanges } from '$lib/engine/scoring';
import type { RewardRule } from '$lib/types';

const makeRule = (overrides: Partial<RewardRule> = {}): RewardRule => ({
	stores: ['*'],
	region: 'domestic',
	rate: 1,
	limit: 0,
	limitUnit: '元',
	...overrides
});

describe('getRuleRateRange', () => {
	it('no tiers: min = max = rate', () => {
		expect(getRuleRateRange(makeRule({ rate: 1.5 }))).toEqual({ min: 1.5, max: 1.5 });
	});

	it('tiers: max = rate + best bonus', () => {
		const rule = makeRule({
			rate: 1,
			tiers: [
				{ label: 'A', bonus: 2.5, limit: 400, limitUnit: '元', condition: 'a' },
				{ label: 'B', bonus: 4, limit: 1000, limitUnit: '元', condition: 'b' }
			]
		});
		expect(getRuleRateRange(rule)).toEqual({ min: 1, max: 5 });
	});

	it('authored maxTotalRate overrides tier derivation', () => {
		const rule = makeRule({
			rate: 1,
			maxTotalRate: 3, // bank says 最高3%, tiers would derive 5
			tiers: [
				{ label: 'A', bonus: 2, limit: 0, limitUnit: '元', condition: 'a' },
				{ label: 'B', bonus: 4, limit: 0, limitUnit: '元', condition: 'b' }
			]
		});
		expect(getRuleRateRange(rule)).toEqual({ min: 1, max: 3 });
	});

	it('zero-base rule (悠遊卡 pattern): min 0', () => {
		const rule = makeRule({
			rate: 0,
			tiers: [{ label: '大戶', bonus: 3, limit: 100, limitUnit: '元', condition: 'c' }]
		});
		expect(getRuleRateRange(rule)).toEqual({ min: 0, max: 3 });
	});

	it('empty tiers array: min = max = rate', () => {
		expect(getRuleRateRange(makeRule({ rate: 2, tiers: [] }))).toEqual({ min: 2, max: 2 });
	});
});

describe('combineRateRanges', () => {
	it('no base: matched range unchanged', () => {
		expect(combineRateRanges({ min: 2, max: 2 })).toEqual({ min: 2, max: 2 });
	});

	it('base with higher ceiling raises max only', () => {
		expect(combineRateRanges({ min: 2, max: 2 }, { min: 1, max: 5 })).toEqual({
			min: 2,
			max: 5
		});
	});

	it('min always stays the matched rule floor (specific rule overrides base)', () => {
		expect(combineRateRanges({ min: 0, max: 3 }, { min: 1, max: 1 })).toEqual({
			min: 0,
			max: 3
		});
	});
});
