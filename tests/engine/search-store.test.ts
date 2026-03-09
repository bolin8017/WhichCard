import { describe, it, expect, beforeEach } from 'vitest';
import { searchStore, initSearchEngine } from '$lib/stores/search.svelte';
import type { CreditCard, Aliases, StoreRestriction } from '$lib/types';

const cards: CreditCard[] = [
	{
		id: 'test-card',
		name: 'Test Card',
		bank: 'Test Bank',
		network: ['visa'],
		rewardType: '現金回饋',
		sourceUrl: 'https://example.com',
		updatedAt: '2026-01-01',
		rewards: [
			{
				stores: ['momo'],
				region: 'domestic',
				rate: 5,
				limit: 0,
				limitUnit: '元'
			},
			{
				stores: ['*'],
				storeLabel: '國內全通路',
				region: 'domestic',
				rate: 1,
				limit: 0,
				limitUnit: '元'
			}
		]
	}
];

const aliases: Aliases = {
	momo: ['momo購物網']
};

const restrictions: Record<string, StoreRestriction> = {};

beforeEach(() => {
	initSearchEngine(cards, aliases, restrictions);
	searchStore.query = '';
	searchStore.region = 'domestic';
	searchStore.myCardIds = undefined;
});

describe('searchStore', () => {
	it('returns empty results for empty query', () => {
		expect(searchStore.results.specificMatches).toHaveLength(0);
		expect(searchStore.results.generalMatches).toHaveLength(0);
	});

	it('returns results when query matches', () => {
		searchStore.query = 'momo';
		expect(searchStore.results.specificMatches.length).toBeGreaterThan(0);
		expect(searchStore.results.specificMatches[0].card.id).toBe('test-card');
	});

	it('returns autocomplete suggestions', () => {
		searchStore.query = 'mo';
		expect(searchStore.suggestions).toContain('momo');
	});

	it('region change updates results', () => {
		searchStore.query = 'momo';
		searchStore.region = 'international';
		expect(searchStore.results.specificMatches).toHaveLength(0);
	});

	it('myCardIds filters results', () => {
		searchStore.query = 'momo';
		searchStore.myCardIds = ['other-card'];
		expect(searchStore.results.specificMatches).toHaveLength(0);
		expect(searchStore.results.generalMatches).toHaveLength(0);
	});
});
