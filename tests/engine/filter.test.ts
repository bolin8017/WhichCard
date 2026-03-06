import { describe, it, expect } from 'vitest';
import { isCardAccepted, isRuleActive, isExcluded } from '$lib/engine/filter';
import type { CreditCard, StoreRestriction, RewardRule } from '$lib/types';

const makeCard = (overrides: Partial<CreditCard> = {}): CreditCard => ({
	id: 'test-card',
	name: 'Test',
	bank: 'Test Bank',
	network: ['visa'],
	rewardType: '現金回饋',
	sourceUrl: 'https://example.com',
	updatedAt: '2026-01-01',
	rewards: [],
	...overrides
});

const makeRule = (overrides: Partial<RewardRule> = {}): RewardRule => ({
	stores: ['*'],
	region: 'domestic',
	rate: 1,
	limit: 0,
	limitUnit: '元',
	...overrides
});

describe('isCardAccepted', () => {
	const restrictions: Record<string, StoreRestriction> = {
		'好市多': { networks: ['mastercard'] },
		'特約店': { banks: ['國泰世華'] },
		'聯名卡店': { cards: ['cathay-costco'] },
		'嚴格店': { networks: ['visa'], banks: ['中國信託'] }
	};

	it('no restriction -> card accepted', () => {
		const card = makeCard();
		expect(isCardAccepted(card, '全家', restrictions)).toBe(true);
	});

	it('network restriction: matching network accepted', () => {
		const card = makeCard({ network: ['mastercard'] });
		expect(isCardAccepted(card, '好市多', restrictions)).toBe(true);
	});

	it('network restriction: non-matching network rejected', () => {
		const card = makeCard({ network: ['visa'] });
		expect(isCardAccepted(card, '好市多', restrictions)).toBe(false);
	});

	it('dual-network card accepted if any network matches', () => {
		const card = makeCard({ network: ['visa', 'mastercard'] });
		expect(isCardAccepted(card, '好市多', restrictions)).toBe(true);
	});

	it('bank restriction: matching bank accepted', () => {
		const card = makeCard({ bank: '國泰世華' });
		expect(isCardAccepted(card, '特約店', restrictions)).toBe(true);
	});

	it('bank restriction: non-matching bank rejected', () => {
		const card = makeCard({ bank: '永豐銀行' });
		expect(isCardAccepted(card, '特約店', restrictions)).toBe(false);
	});

	it('card restriction: matching card ID accepted', () => {
		const card = makeCard({ id: 'cathay-costco' });
		expect(isCardAccepted(card, '聯名卡店', restrictions)).toBe(true);
	});

	it('card restriction: non-matching card ID rejected', () => {
		const card = makeCard({ id: 'other-card' });
		expect(isCardAccepted(card, '聯名卡店', restrictions)).toBe(false);
	});

	it('combined restrictions use AND logic', () => {
		// Must be Visa AND 中國信託
		const cardOk = makeCard({ network: ['visa'], bank: '中國信託' });
		expect(isCardAccepted(cardOk, '嚴格店', restrictions)).toBe(true);

		const cardBadNetwork = makeCard({ network: ['mastercard'], bank: '中國信託' });
		expect(isCardAccepted(cardBadNetwork, '嚴格店', restrictions)).toBe(false);

		const cardBadBank = makeCard({ network: ['visa'], bank: '永豐銀行' });
		expect(isCardAccepted(cardBadBank, '嚴格店', restrictions)).toBe(false);
	});
});

describe('isRuleActive', () => {
	it('rule with no dates is active', () => {
		expect(isRuleActive(makeRule())).toBe(true);
	});

	it('rule with future validUntil is active', () => {
		expect(isRuleActive(makeRule({ validUntil: '2099-12-31' }))).toBe(true);
	});

	it('rule with past validUntil is expired', () => {
		expect(isRuleActive(makeRule({ validUntil: '2020-01-01' }))).toBe(false);
	});

	it('rule with future validFrom is not yet active', () => {
		expect(isRuleActive(makeRule({ validFrom: '2099-01-01' }))).toBe(false);
	});
});

describe('isExcluded', () => {
	it('store in excludes is excluded', () => {
		const rule = makeRule({ excludes: ['保費', '代繳'] });
		expect(isExcluded('保費', rule)).toBe(true);
	});

	it('store not in excludes is not excluded', () => {
		const rule = makeRule({ excludes: ['保費', '代繳'] });
		expect(isExcluded('全家', rule)).toBe(false);
	});

	it('no excludes means not excluded', () => {
		expect(isExcluded('保費', makeRule())).toBe(false);
	});
});
