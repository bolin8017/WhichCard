import { describe, it, expect } from 'vitest';
import { buildStoreIndex, buildPrefixIndex } from '$lib/engine/index';
import type { CreditCard, Aliases } from '$lib/types';

const makeCard = (overrides: Partial<CreditCard> = {}): CreditCard => ({
	id: 'test-card',
	name: 'Test',
	bank: 'Bank',
	network: ['visa'],
	rewardType: '現金回饋',
	sourceUrl: 'https://example.com',
	updatedAt: '2026-01-01',
	rewards: [],
	...overrides
});

describe('buildStoreIndex', () => {
	it('maps store names to rule references', () => {
		const cards: CreditCard[] = [
			makeCard({
				rewards: [
					{ stores: ['全家'], region: 'domestic', rate: 3, limit: 0, limitUnit: '元' },
					{
						stores: ['*'],
						storeLabel: '國內全通路',
						region: 'domestic',
						rate: 1,
						limit: 0,
						limitUnit: '元'
					}
				]
			})
		];
		const index = buildStoreIndex(cards);
		expect(index.get('全家')).toHaveLength(1);
		expect(index.get('全家')![0]).toEqual({ cardIndex: 0, ruleIndex: 0 });
		expect(index.get('*')).toHaveLength(1);
		expect(index.get('*')![0]).toEqual({ cardIndex: 0, ruleIndex: 1 });
	});

	it('maps multiple cards to same store', () => {
		const cards: CreditCard[] = [
			makeCard({
				id: 'card-a',
				rewards: [{ stores: ['momo'], region: 'domestic', rate: 3, limit: 0, limitUnit: '元' }]
			}),
			makeCard({
				id: 'card-b',
				rewards: [{ stores: ['momo'], region: 'domestic', rate: 5, limit: 0, limitUnit: '元' }]
			})
		];
		const index = buildStoreIndex(cards);
		expect(index.get('momo')).toHaveLength(2);
	});

	it('handles rule with multiple stores', () => {
		const cards: CreditCard[] = [
			makeCard({
				rewards: [
					{ stores: ['momo', '蝦皮'], region: 'domestic', rate: 3, limit: 0, limitUnit: '元' }
				]
			})
		];
		const index = buildStoreIndex(cards);
		expect(index.get('momo')).toHaveLength(1);
		expect(index.get('蝦皮')).toHaveLength(1);
		// Both point to same rule
		expect(index.get('momo')![0]).toEqual(index.get('蝦皮')![0]);
	});
});

describe('buildPrefixIndex', () => {
	it('maps prefixes to canonical names', () => {
		const aliases: Aliases = { '全家': ['FamilyMart', '全家便利商店'] };
		const index = buildPrefixIndex(aliases);
		expect(index.get('全')).toContain('全家');
		expect(index.get('全家')).toContain('全家');
		expect(index.get('f')).toContain('全家');
		expect(index.get('fa')).toContain('全家');
		expect(index.get('familymart')).toContain('全家');
	});

	it('maps multiple stores with shared prefix', () => {
		const aliases: Aliases = { '全家': ['FamilyMart'], '全聯': ['PX Mart'] };
		const index = buildPrefixIndex(aliases);
		expect(index.get('全')).toContain('全家');
		expect(index.get('全')).toContain('全聯');
		expect(index.get('全家')).toContain('全家');
		expect(index.get('全家')).not.toContain('全聯');
	});

	it('is case-insensitive for Latin characters', () => {
		const aliases: Aliases = { 'momo': ['MOMO購物網'] };
		const index = buildPrefixIndex(aliases);
		expect(index.get('m')).toContain('momo');
		expect(index.get('momo')).toContain('momo');
	});

	it('does not duplicate canonical names', () => {
		const aliases: Aliases = { '好市多': ['Costco', 'costco'] };
		const index = buildPrefixIndex(aliases);
		const results = index.get('c')!;
		expect(results.filter((r) => r === '好市多')).toHaveLength(1);
	});
});
