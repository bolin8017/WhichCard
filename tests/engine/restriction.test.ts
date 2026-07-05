import { describe, it, expect } from 'vitest';
import { describeRestriction } from '$lib/engine/restriction';
import type { StoreRestriction } from '$lib/types';

describe('describeRestriction', () => {
	it('returns undefined when there is no restriction', () => {
		expect(describeRestriction(undefined)).toBeUndefined();
	});

	it('returns undefined for an empty restriction object', () => {
		expect(describeRestriction({})).toBeUndefined();
	});

	it('prefers the authored note over derived text', () => {
		const r: StoreRestriction = {
			cards: ['fubon-costco'],
			note: '僅接受富邦Costco聯名卡'
		};
		expect(describeRestriction(r)).toBe('僅接受富邦Costco聯名卡');
	});

	it('describes network restrictions with display names', () => {
		const r: StoreRestriction = { networks: ['mastercard', 'jcb'] };
		expect(describeRestriction(r)).toBe('此通路僅接受 Mastercard / JCB');
	});

	it('falls back to a generic hint for card-list restrictions without note', () => {
		const r: StoreRestriction = { cards: ['fubon-costco'] };
		expect(describeRestriction(r)).toBe('此通路僅接受特定卡片');
	});

	it('falls back to a generic hint for bank restrictions without note', () => {
		const r: StoreRestriction = { banks: ['富邦'] };
		expect(describeRestriction(r)).toBe('此通路僅接受特定卡片');
	});
});
