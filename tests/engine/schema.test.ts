import { describe, it, expect } from 'vitest';
import {
	creditCardSchema,
	storeEntrySchema,
	aliasesSchema,
	rewardRuleSchema,
	categoriesSchema
} from '$lib/schema';

describe('creditCardSchema', () => {
	const validCard = {
		id: 'sinopac-dawho',
		name: 'DAWHO',
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
				limitUnit: '元'
			}
		]
	};

	it('accepts a valid card', () => {
		expect(() => creditCardSchema.parse(validCard)).not.toThrow();
	});

	it('rejects invalid id format', () => {
		expect(() => creditCardSchema.parse({ ...validCard, id: 'Bad Id' })).toThrow();
	});

	it('rejects invalid network', () => {
		expect(() => creditCardSchema.parse({ ...validCard, network: ['diners'] })).toThrow();
	});

	it('rejects empty rewards', () => {
		expect(() => creditCardSchema.parse({ ...validCard, rewards: [] })).toThrow();
	});

	it('accepts card with tiers', () => {
		const cardWithTiers = {
			...validCard,
			rewards: [
				{
					...validCard.rewards[0],
					tiers: [
						{
							label: '加碼回饋',
							bonus: 2.5,
							limit: 400,
							limitUnit: '元',
							condition: '當月消費滿 5,000',
							tags: ['最低消費']
						}
					]
				}
			]
		};
		expect(() => creditCardSchema.parse(cardWithTiers)).not.toThrow();
	});

	it('rejects invalid date format', () => {
		expect(() =>
			creditCardSchema.parse({ ...validCard, updatedAt: '2026/03/05' })
		).toThrow();
	});
});

describe('storeEntrySchema', () => {
	it('accepts valid store with network restriction', () => {
		const store = {
			name: '好市多',
			restrictions: { networks: ['mastercard'] },
			note: '僅接受 Mastercard'
		};
		expect(() => storeEntrySchema.parse(store)).not.toThrow();
	});

	it('accepts store with empty restrictions', () => {
		const store = {
			name: '全家',
			restrictions: {}
		};
		expect(() => storeEntrySchema.parse(store)).not.toThrow();
	});
});

describe('aliasesSchema', () => {
	it('accepts valid aliases map', () => {
		const aliases = { '好市多': ['Costco', 'costco'], '全家': ['FamilyMart'] };
		expect(() => aliasesSchema.parse(aliases)).not.toThrow();
	});
});

describe('schema v2 additions', () => {
	it('accepts maxTotalRate >= rate and rule sourceUrl', () => {
		const rule = {
			stores: ['*'],
			region: 'domestic',
			rate: 0.3,
			limit: 0,
			limitUnit: '元',
			maxTotalRate: 3.3,
			sourceUrl: 'https://example.com/campaign'
		};
		expect(rewardRuleSchema.safeParse(rule).success).toBe(true);
	});

	it('rejects maxTotalRate < rate', () => {
		const rule = {
			stores: ['*'],
			region: 'domestic',
			rate: 2,
			limit: 0,
			limitUnit: '元',
			maxTotalRate: 1
		};
		expect(rewardRuleSchema.safeParse(rule).success).toBe(false);
	});

	it('accepts pointsName on a card and 方案切換 tag on a tier', () => {
		const card = {
			id: 'cathay-cube',
			name: 'CUBE卡',
			bank: '國泰世華',
			network: ['visa'],
			rewardType: '點數回饋',
			pointsName: '小樹點',
			sourceUrl: 'https://example.com',
			updatedAt: '2026-07-04',
			rewards: [
				{
					stores: ['*'],
					region: 'domestic',
					rate: 0.3,
					limit: 0,
					limitUnit: '元',
					tiers: [
						{
							label: '玩數位',
							bonus: 3,
							limit: 0,
							limitUnit: '元',
							condition: '需切換方案',
							tags: ['方案切換']
						}
					]
				}
			]
		};
		expect(creditCardSchema.safeParse(card).success).toBe(true);
	});

	it('validates categories as record of string arrays', () => {
		expect(categoriesSchema.safeParse({ 保費: ['國泰人壽'] }).success).toBe(true);
		expect(categoriesSchema.safeParse({ 保費: 'x' }).success).toBe(false);
	});
});
