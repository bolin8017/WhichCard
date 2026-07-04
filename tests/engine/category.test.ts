import { describe, it, expect } from 'vitest';
import { buildCategoryIndex, expandStores } from '$lib/engine/category';
import type { Categories } from '$lib/types';

const categories: Categories = {
	保費: ['國泰人壽', '富邦產險'],
	代繳: ['台電', '台灣自來水'],
	網購: ['國泰人壽']
};

describe('buildCategoryIndex', () => {
	it('inverts category → members into member → categories', () => {
		const index = buildCategoryIndex(categories);
		expect(index.get('台電')).toEqual(['代繳']);
		expect(index.get('國泰人壽')).toEqual(['保費', '網購']);
	});

	it('empty categories → empty index', () => {
		expect(buildCategoryIndex({}).size).toBe(0);
	});
});

describe('expandStores', () => {
	const index = buildCategoryIndex(categories);

	it('member expands to itself plus its categories', () => {
		expect(expandStores('台電', index)).toEqual(['台電', '代繳']);
	});

	it('unknown store expands to itself only', () => {
		expect(expandStores('全聯', index)).toEqual(['全聯']);
	});

	it('category name searched directly expands to itself only', () => {
		expect(expandStores('保費', index)).toEqual(['保費']);
	});
});
