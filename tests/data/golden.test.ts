import { describe, it, expect, beforeAll } from 'vitest';
import { createSearchEngine, type SearchEngine } from '$lib/engine/search';
import type { CreditCard, SearchIndex } from '$lib/types';
import cardsJson from '$lib/data/cards.json';
import searchIndexJson from '$lib/data/search-index.json';

// Golden scenario tests: run the real engine against the real built data
// (same JSON the app ships), asserting the answers a user should see.
//
// Maintenance contract:
// - Run `pnpm build-data` before `pnpm test` (CI already does).
// - Rules carry validFrom/validUntil and the engine uses today's date, so
//   when a rule expires these tests go red. That is intentional: policy says
//   expired rules must be deleted from YAML, and goldens must be updated in
//   the same change. Keep assertions on queries users actually care about.

const cards = cardsJson as unknown as CreditCard[];
const searchIndex = searchIndexJson as unknown as SearchIndex;

let engine: SearchEngine;

beforeAll(() => {
	engine = createSearchEngine(
		cards,
		searchIndex.aliases,
		searchIndex.storeRestrictions,
		searchIndex.categories ?? {}
	);
});

const ids = (results: { card: CreditCard }[]) => results.map((r) => r.card.id);

describe('golden: 好市多（通路限制）', () => {
	it('只出現富邦Costco聯名卡，區間2~2，一般回饋區為空', () => {
		const r = engine.search({ query: '好市多', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual(['fubon-costco']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 2, max: 2 });
		expect(r.specificMatches[0].baseRule).toBeDefined();
		expect(r.generalMatches).toEqual([]);
		expect(r.restriction?.cards).toContain('fubon-costco');
	});

	it('英文別名 Costco 與中文查詢結果完全一致', () => {
		const zh = engine.search({ query: '好市多', region: 'domestic' });
		const en = engine.search({ query: 'Costco', region: 'domestic' });
		expect(en).toEqual(zh);
	});

	it('海外地區無具體匹配（好市多是國內通路）', () => {
		const r = engine.search({ query: '好市多', region: 'international' });
		expect(r.specificMatches).toEqual([]);
	});
});

describe('golden: 好市多線上購物', () => {
	it('富邦Costco聯名卡3%排第一', () => {
		const r = engine.search({ query: '好市多線上購物', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual(['fubon-costco']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 3, max: 3 });
	});
});

describe('golden: 高鐵（多卡競爭）', () => {
	it('具體匹配依區間上緣排序：CUBE 0.3~3.3 先於富邦 1~3', () => {
		const r = engine.search({ query: '高鐵', region: 'domestic' });
		expect(r.matchedStores).toEqual(['台灣高鐵']);
		expect(ids(r.specificMatches)).toEqual(['cathay-cube', 'fubon-costco']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 0.3, max: 3.3 });
		expect(r.specificMatches[1].rateRange).toEqual({ min: 1, max: 3 });
	});

	it('一般回饋含 DAWHO 1~5（萬用規則未排除高鐵）', () => {
		const r = engine.search({ query: '高鐵', region: 'domestic' });
		expect(ids(r.generalMatches)).toEqual(['sinopac-dawho', 'sinopac-dual-currency']);
		expect(r.generalMatches[0].rateRange).toEqual({ min: 1, max: 5 });
	});
});

describe('golden: 排除機制', () => {
	it('台電（代繳類別成員）觸發全部卡片的 excludes → 零結果', () => {
		const r = engine.search({ query: '台電', region: 'domestic' });
		expect(r.matchedStores).toEqual(['台電']);
		expect(r.specificMatches).toEqual([]);
		expect(r.generalMatches).toEqual([]);
	});

	it('全聯只剩 CUBE 全支付/集精選 carve-out 0~2，其他卡全被 excludes 濾掉', () => {
		const r = engine.search({ query: '全聯', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual(['cathay-cube']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 0, max: 2 });
		expect(r.generalMatches).toEqual([]);
	});

	it('小七（7-ELEVEN 別名，便利商店成員）只剩 CUBE 方案 carve-out 0~2', () => {
		const r = engine.search({ query: '小七', region: 'domestic' });
		expect(r.matchedStores).toEqual(['7-ELEVEN']);
		expect(ids(r.specificMatches)).toEqual(['cathay-cube']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 0, max: 2 });
		expect(r.generalMatches).toEqual([]);
	});

	it('悠遊卡自動加值只剩 DAWHO rate:0 carve-out 0~5', () => {
		const r = engine.search({ query: '悠遊卡', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual(['sinopac-dawho']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 0, max: 5 });
		expect(r.specificMatches[0].baseRule).toBeUndefined();
		expect(r.generalMatches).toEqual([]);
	});
});

describe('golden: 保費（類別回饋規則）', () => {
	it('依上緣/下緣排序：幣倍1.2 → DAWHO 1~1 → CUBE 0.3~1；萬用規則全排除', () => {
		const r = engine.search({ query: '保費', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual([
			'sinopac-dual-currency',
			'sinopac-dawho',
			'cathay-cube'
		]);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 1.2, max: 1.2 });
		// 永豐兩張的萬用規則 excludes 保費 → 無 baseRule；CUBE 一般0.3%不排除保費
		expect(r.specificMatches[0].baseRule).toBeUndefined();
		expect(r.specificMatches[1].baseRule).toBeUndefined();
		expect(r.specificMatches[2].baseRule).toBeDefined();
		expect(r.generalMatches).toEqual([]);
	});

	it('搜類別成員（國泰人壽）得到相同卡片，matchKind 為 category', () => {
		const r = engine.search({ query: '國泰人壽', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual([
			'sinopac-dual-currency',
			'sinopac-dawho',
			'cathay-cube'
		]);
		expect(r.specificMatches.every((m) => m.matchKind === 'category')).toBe(true);
		expect(r.generalMatches).toEqual([]);
	});
});

describe('golden: momo（一般網購通路）', () => {
	it('CUBE 玩數位是唯一具體匹配 0.3~3.3', () => {
		const r = engine.search({ query: 'momo', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual(['cathay-cube']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 0.3, max: 3.3 });
		expect(r.specificMatches[0].baseRule).toBeDefined();
	});

	it('一般回饋 DAWHO 1~5 排第一，四張卡都有結果', () => {
		const r = engine.search({ query: 'momo', region: 'domestic' });
		expect(r.generalMatches[0].card.id).toBe('sinopac-dawho');
		expect(r.generalMatches[0].rateRange).toEqual({ min: 1, max: 5 });
		const all = [...ids(r.specificMatches), ...ids(r.generalMatches)].sort();
		expect(all).toEqual([
			'cathay-cube',
			'fubon-costco',
			'sinopac-dawho',
			'sinopac-dual-currency'
		]);
	});
});

describe('golden: 海外消費', () => {
	it('淘寶海外：永豐雙卡2~6領先，富邦1~5，CUBE取較高的趣旅行萬用規則0.3~3.3', () => {
		const r = engine.search({ query: '淘寶', region: 'international' });
		expect(r.specificMatches).toEqual([]);
		expect(ids(r.generalMatches).slice(0, 2).sort()).toEqual([
			'sinopac-dawho',
			'sinopac-dual-currency'
		]);
		expect(r.generalMatches[0].rateRange).toEqual({ min: 2, max: 6 });
		expect(r.generalMatches[1].rateRange).toEqual({ min: 2, max: 6 });
		expect(r.generalMatches[2].card.id).toBe('fubon-costco');
		expect(r.generalMatches[2].rateRange).toEqual({ min: 1, max: 5 });
		expect(r.generalMatches[3].card.id).toBe('cathay-cube');
		expect(r.generalMatches[3].rateRange).toEqual({ min: 0.3, max: 3.3 });
	});
});

describe('golden: 我的卡片過濾', () => {
	it('高鐵 + 只持有CUBE → 僅CUBE出現', () => {
		const r = engine.search({ query: '高鐵', region: 'domestic', myCardIds: ['cathay-cube'] });
		expect(ids(r.specificMatches)).toEqual(['cathay-cube']);
		expect(r.generalMatches).toEqual([]);
	});
});
