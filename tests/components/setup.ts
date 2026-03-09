import { initSearchEngine } from '$lib/stores/search.svelte';
import type { CreditCard, Aliases, StoreRestriction } from '$lib/types';

export const testCards: CreditCard[] = [
	{
		id: 'test-card',
		name: 'Test Card',
		bank: 'Test Bank',
		network: ['visa', 'mastercard'],
		rewardType: '現金回饋',
		sourceUrl: 'https://example.com',
		updatedAt: '2026-01-01',
		rewards: [
			{
				stores: ['momo'],
				region: 'domestic',
				rate: 5,
				limit: 300,
				limitUnit: '元',
				tiers: [
					{
						label: '加碼',
						bonus: 2,
						limit: 200,
						limitUnit: '元',
						condition: '指定通路消費',
						tags: ['指定通路']
					}
				]
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

export const testAliases: Aliases = {
	momo: ['momo購物網']
};

export const testRestrictions: Record<string, StoreRestriction> = {};

export function setupTestEngine(): void {
	initSearchEngine(testCards, testAliases, testRestrictions);
}
