import { describe, it, expect, beforeAll } from 'vitest';
import { createSearchEngine, type SearchEngine } from '$lib/engine/search';
import type { CreditCard, Aliases, StoreRestriction } from '$lib/types';

const sampleCards: CreditCard[] = [
	{
		id: 'sinopac-dawho',
		name: 'DAWHO現金回饋信用卡',
		bank: '永豐銀行',
		network: ['visa', 'mastercard'],
		rewardType: '現金回饋',
		sourceUrl: 'https://bank.sinopac.com/example',
		updatedAt: '2026-03-05',
		rewards: [
			{
				stores: ['*'],
				storeLabel: '國內全通路',
				region: 'domestic',
				rate: 1,
				limit: 0,
				limitUnit: '元',
				excludes: ['保費', '代繳'],
				tiers: [
					{
						label: '大戶',
						bonus: 2.5,
						limit: 400,
						limitUnit: '元',
						condition: '需大戶等級',
						tags: ['會員等級']
					}
				]
			},
			{
				stores: ['*'],
				storeLabel: '海外全通路',
				region: 'international',
				rate: 2,
				limit: 0,
				limitUnit: '元'
			}
		]
	},
	{
		id: 'cathay-costco',
		name: 'Costco聯名卡',
		bank: '國泰世華',
		network: ['mastercard'],
		rewardType: '現金回饋',
		sourceUrl: 'https://www.cathaybk.com.tw/example',
		updatedAt: '2026-03-05',
		rewards: [
			{
				stores: ['好市多'],
				region: 'domestic',
				rate: 1,
				limit: 0,
				limitUnit: '元',
				tiers: [
					{
						label: '好市多加碼',
						bonus: 2,
						limit: 3000,
						limitUnit: '元',
						condition: '好市多消費',
						tags: ['指定通路']
					}
				]
			},
			{
				stores: ['*'],
				storeLabel: '國內全通路',
				region: 'domestic',
				rate: 0.5,
				limit: 0,
				limitUnit: '元',
				excludes: ['保費', '代繳']
			},
			{
				stores: ['*'],
				storeLabel: '海外全通路',
				region: 'international',
				rate: 1,
				limit: 0,
				limitUnit: '元'
			}
		]
	},
	{
		id: 'ctbc-line-pay',
		name: 'LINE Pay信用卡',
		bank: '中國信託',
		network: ['visa'],
		rewardType: '點數回饋',
		sourceUrl: 'https://www.ctbcbank.com/example',
		updatedAt: '2026-03-05',
		rewards: [
			{
				stores: ['momo', '蝦皮'],
				region: 'domestic',
				rate: 3,
				limit: 300,
				limitUnit: '點',
				tiers: [
					{
						label: '行動支付加碼',
						bonus: 2,
						limit: 200,
						limitUnit: '點',
						condition: 'LINE Pay 綁定付款',
						tags: ['行動支付']
					}
				]
			},
			{
				stores: ['*'],
				storeLabel: '國內全通路',
				region: 'domestic',
				rate: 1,
				limit: 0,
				limitUnit: '點'
			},
			{
				stores: ['*'],
				storeLabel: '海外全通路',
				region: 'international',
				rate: 2.8,
				limit: 0,
				limitUnit: '點'
			}
		]
	}
];

const sampleAliases: Aliases = {
	'好市多': ['Costco', 'costco'],
	'全家': ['FamilyMart', '全家便利商店'],
	'全聯': ['全聯福利中心', 'PX Mart'],
	'蝦皮': ['Shopee', '蝦皮購物'],
	momo: ['momo購物網', 'momo購物'],
	'保費': ['保險費'],
	'代繳': ['代扣繳']
};

const sampleRestrictions: Record<string, StoreRestriction> = {
	'好市多': { networks: ['mastercard'] }
};

let engine: SearchEngine;

beforeAll(() => {
	engine = createSearchEngine(sampleCards, sampleAliases, sampleRestrictions);
});

describe('searchCards', () => {
	it('search 好市多 domestic: only Mastercard cards in specific', () => {
		const results = engine.search({ query: '好市多', region: 'domestic' });
		// cathay-costco has specific match + mastercard
		expect(results.specificMatches.length).toBeGreaterThanOrEqual(1);
		expect(results.specificMatches.every((r) => r.card.network.includes('mastercard'))).toBe(
			true
		);
		// ctbc-line-pay is Visa only, should not appear at all for 好市多
		expect(
			results.specificMatches.some((r) => r.card.id === 'ctbc-line-pay')
		).toBe(false);
		expect(
			results.generalMatches.some((r) => r.card.id === 'ctbc-line-pay')
		).toBe(false);
	});

	it('search 好市多: cathay-costco is specific match', () => {
		const results = engine.search({ query: '好市多', region: 'domestic' });
		const cathay = results.specificMatches.find((r) => r.card.id === 'cathay-costco');
		expect(cathay).toBeDefined();
		expect(cathay!.isSpecificMatch).toBe(true);
		expect(cathay!.matchedRule.stores).toContain('好市多');
	});

	it('search 好市多: cathay-costco has baseRule', () => {
		const results = engine.search({ query: '好市多', region: 'domestic' });
		const cathay = results.specificMatches.find((r) => r.card.id === 'cathay-costco');
		expect(cathay!.baseRule).toBeDefined();
		expect(cathay!.baseRule!.stores).toContain('*');
	});

	it('search momo: ctbc-line-pay in specific matches', () => {
		const results = engine.search({ query: 'momo', region: 'domestic' });
		const ctbc = results.specificMatches.find((r) => r.card.id === 'ctbc-line-pay');
		expect(ctbc).toBeDefined();
		expect(ctbc!.maxReward).toBe(5); // rate 3 + tier bonus 2
	});

	it('search momo: other cards in general matches via wildcard', () => {
		const results = engine.search({ query: 'momo', region: 'domestic' });
		const general = results.generalMatches;
		expect(general.length).toBeGreaterThanOrEqual(1);
		// sinopac-dawho should be in general (has domestic wildcard, momo not excluded)
		expect(general.some((r) => r.card.id === 'sinopac-dawho')).toBe(true);
	});

	it('search unknown store: only wildcard results in general', () => {
		const results = engine.search({ query: '不存在的店', region: 'domestic' });
		expect(results.specificMatches).toHaveLength(0);
		expect(results.generalMatches).toHaveLength(0);
	});

	it('search with myCardIds filter', () => {
		const results = engine.search({
			query: 'momo',
			region: 'domestic',
			myCardIds: ['ctbc-line-pay']
		});
		const allCards = [...results.specificMatches, ...results.generalMatches];
		expect(allCards.every((r) => r.card.id === 'ctbc-line-pay')).toBe(true);
	});

	it('results sorted by maxReward descending', () => {
		const results = engine.search({ query: 'momo', region: 'domestic' });
		for (const section of [results.specificMatches, results.generalMatches]) {
			for (let i = 1; i < section.length; i++) {
				expect(section[i - 1].maxReward).toBeGreaterThanOrEqual(section[i].maxReward);
			}
		}
	});

	it('region filter works', () => {
		const results = engine.search({ query: '好市多', region: 'international' });
		// 好市多 is domestic store, no specific matches for international
		expect(results.specificMatches).toHaveLength(0);
	});

	it('excludes filter: searching 保費 excludes sinopac-dawho wildcard', () => {
		const results = engine.search({ query: '保費', region: 'domestic' });
		// sinopac-dawho has excludes: [保費] on its domestic wildcard
		const dawho = [...results.specificMatches, ...results.generalMatches].find(
			(r) => r.card.id === 'sinopac-dawho'
		);
		expect(dawho).toBeUndefined();
	});

	it('matchedStores returns resolved store names', () => {
		const results = engine.search({ query: 'Costco', region: 'domestic' });
		expect(results.matchedStores).toContain('好市多');
	});

	it('restriction info returned for restricted store', () => {
		const results = engine.search({ query: '好市多', region: 'domestic' });
		expect(results.restriction).toBeDefined();
		expect(results.restriction!.networks).toContain('mastercard');
	});
});
