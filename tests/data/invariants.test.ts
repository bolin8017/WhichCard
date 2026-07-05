import { describe, it, expect } from 'vitest';
import type { CreditCard, SearchIndex } from '$lib/types';
import cardsJson from '$lib/data/cards.json';
import searchIndexJson from '$lib/data/search-index.json';

// Product-level invariants on the built data that schema.ts (per-field shape)
// and build-data cross-validation (referential integrity) do not cover.
// A failure here means a data-entry mistake, not an engine bug.

const cards = cardsJson as unknown as CreditCard[];
const searchIndex = searchIndexJson as unknown as SearchIndex;

const eachRule = cards.flatMap((card) =>
	card.rewards.map((rule, i) => ({ card, rule, label: `${card.id}#${i} [${rule.stores.join(',')}]` }))
);

describe('data invariants: reward rules', () => {
	it('萬用規則（stores: ["*"]) 必須有 storeLabel', () => {
		for (const { rule, label } of eachRule) {
			if (rule.stores.includes('*')) {
				expect(rule.storeLabel, label).toBeTruthy();
			}
		}
	});

	it('"*" 必須是 stores 的唯一元素', () => {
		for (const { rule, label } of eachRule) {
			if (rule.stores.includes('*')) {
				expect(rule.stores, label).toEqual(['*']);
			}
		}
	});

	it('單一規則內通路不得重複', () => {
		for (const { rule, label } of eachRule) {
			expect(new Set(rule.stores).size, label).toBe(rule.stores.length);
		}
	});

	it('validFrom 不得晚於 validUntil', () => {
		for (const { rule, label } of eachRule) {
			if (rule.validFrom && rule.validUntil) {
				expect(rule.validFrom <= rule.validUntil, label).toBe(true);
			}
		}
	});

	it('rate: 0 的 carve-out 規則必須有 tiers（否則是死規則）', () => {
		for (const { rule, label } of eachRule) {
			if (rule.rate === 0) {
				expect(rule.tiers?.length ?? 0, label).toBeGreaterThan(0);
			}
		}
	});

	it('maxTotalRate 落在檔位可解釋區間內（官網宣稱 vs 檔位結構）', () => {
		// 擇優型卡片：maxTotalRate = rate + 最高 tier bonus；
		// 疊加型卡片（多任務可同時達成）：maxTotalRate 最多為 rate + 全部 bonus 加總。
		// 低於前者代表顯示低估、高於後者代表宣稱值無檔位支撐——都是資料輸入錯誤。
		for (const { rule, label } of eachRule) {
			if (rule.maxTotalRate === undefined) continue;
			const bonuses = rule.tiers?.map((t) => t.bonus) ?? [];
			const maxBonus = bonuses.length ? Math.max(...bonuses) : 0;
			const sumBonus = bonuses.reduce((a, b) => a + b, 0);
			expect(rule.maxTotalRate, label).toBeGreaterThanOrEqual(rule.rate + maxBonus - 1e-9);
			expect(rule.maxTotalRate, label).toBeLessThanOrEqual(rule.rate + sumBonus + 1e-9);
		}
	});
});

describe('data invariants: search index', () => {
	it('別名解析無歧義：同一名稱（不分大小寫）只能對應一個 canonical', () => {
		const owners = new Map<string, Set<string>>();
		for (const [canonical, aliasList] of Object.entries(searchIndex.aliases)) {
			for (const name of [canonical, ...aliasList]) {
				const key = name.toLowerCase();
				const set = owners.get(key) ?? new Set<string>();
				set.add(canonical);
				owners.set(key, set);
			}
		}
		for (const [name, canonicals] of owners) {
			expect([...canonicals], `"${name}" 對應多個 canonical`).toHaveLength(1);
		}
	});

	it('類別成員不得是另一個類別（expandStores 不支援巢狀展開）', () => {
		const categories = searchIndex.categories ?? {};
		const categoryKeys = new Set(Object.keys(categories));
		for (const [category, members] of Object.entries(categories)) {
			for (const member of members) {
				expect(categoryKeys.has(member), `${category} → ${member}`).toBe(false);
			}
		}
	});
});
