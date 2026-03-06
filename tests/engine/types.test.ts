import { describe, it, expect } from 'vitest';
import type { CreditCard, SearchIndex } from '$lib/types';
import { CARD_NETWORKS, REGIONS, REWARD_TYPES, CONDITION_TAGS } from '$lib/types';

describe('type constants', () => {
	it('has all expected card networks', () => {
		expect(CARD_NETWORKS).toContain('visa');
		expect(CARD_NETWORKS).toContain('mastercard');
		expect(CARD_NETWORKS).toContain('jcb');
		expect(CARD_NETWORKS).toContain('amex');
		expect(CARD_NETWORKS).toHaveLength(4);
	});

	it('has all expected regions', () => {
		expect(REGIONS).toContain('domestic');
		expect(REGIONS).toContain('international');
		expect(REGIONS).toContain('japan');
		expect(REGIONS).toContain('korea');
		expect(REGIONS).toContain('thailand');
		expect(REGIONS).toHaveLength(5);
	});

	it('has all expected reward types', () => {
		expect(REWARD_TYPES).toContain('現金回饋');
		expect(REWARD_TYPES).toContain('點數回饋');
		expect(REWARD_TYPES).toHaveLength(2);
	});

	it('has all expected condition tags', () => {
		expect(CONDITION_TAGS).toContain('自動扣繳');
		expect(CONDITION_TAGS).toContain('需登錄');
		expect(CONDITION_TAGS).toHaveLength(9);
	});
});
