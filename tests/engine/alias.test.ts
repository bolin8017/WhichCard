import { describe, it, expect } from 'vitest';
import { resolveAlias, type AliasMatch } from '$lib/engine/alias';
import { buildPrefixIndex } from '$lib/engine/index';
import type { Aliases } from '$lib/types';

const aliases: Aliases = {
	'好市多': ['Costco', 'costco'],
	'全家': ['FamilyMart', '全家便利商店'],
	'全聯': ['全聯福利中心', 'PX Mart'],
	'momo': ['momo購物網', 'momo購物'],
	'蝦皮': ['Shopee', '蝦皮購物']
};

const prefixIndex = buildPrefixIndex(aliases);

describe('resolveAlias', () => {
	it('exact match on canonical name', () => {
		const results = resolveAlias('好市多', aliases, prefixIndex);
		expect(results).toHaveLength(1);
		expect(results[0].canonical).toBe('好市多');
		expect(results[0].confidence).toBe('exact');
	});

	it('exact match on alias (case-insensitive)', () => {
		const results = resolveAlias('Costco', aliases, prefixIndex);
		expect(results).toHaveLength(1);
		expect(results[0].canonical).toBe('好市多');
		expect(results[0].confidence).toBe('exact');
		expect(results[0].matchedVia).toBe('costco');
	});

	it('exact match is case-insensitive', () => {
		const results = resolveAlias('costco', aliases, prefixIndex);
		expect(results).toHaveLength(1);
		expect(results[0].canonical).toBe('好市多');
		expect(results[0].confidence).toBe('exact');
	});

	it('prefix match returns multiple results', () => {
		const results = resolveAlias('全', aliases, prefixIndex);
		expect(results.length).toBeGreaterThanOrEqual(2);
		const names = results.map((r) => r.canonical);
		expect(names).toContain('全家');
		expect(names).toContain('全聯');
		expect(results.every((r) => r.confidence === 'prefix')).toBe(true);
	});

	it('prefix match with Latin characters', () => {
		const results = resolveAlias('fam', aliases, prefixIndex);
		expect(results).toHaveLength(1);
		expect(results[0].canonical).toBe('全家');
		expect(results[0].confidence).toBe('prefix');
	});

	it('substring match as fallback', () => {
		const results = resolveAlias('購物網', aliases, prefixIndex);
		expect(results.length).toBeGreaterThanOrEqual(1);
		const names = results.map((r) => r.canonical);
		expect(names).toContain('momo');
		expect(results.every((r) => r.confidence === 'substring')).toBe(true);
	});

	it('no match returns empty array', () => {
		const results = resolveAlias('不存在的店', aliases, prefixIndex);
		expect(results).toHaveLength(0);
	});

	it('exact match takes priority over prefix', () => {
		const results = resolveAlias('momo', aliases, prefixIndex);
		expect(results).toHaveLength(1);
		expect(results[0].confidence).toBe('exact');
	});
});
