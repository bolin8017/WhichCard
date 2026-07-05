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
	it('通路限制生效：僅富邦Costco聯名卡3%，一般回饋為空', () => {
		const r = engine.search({ query: '好市多線上購物', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual(['fubon-costco']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 3, max: 3 });
		expect(r.generalMatches).toEqual([]);
		expect(r.restriction?.cards).toContain('fubon-costco');
	});
});

describe('golden: 高鐵（多卡競爭）', () => {
	it('具體匹配依區間上緣排序：蝦皮卡 0.5~7 → CUBE 0.3~3.3 → 富邦 1~3', () => {
		const r = engine.search({ query: '高鐵', region: 'domestic' });
		expect(r.matchedStores).toEqual(['台灣高鐵']);
		expect(ids(r.specificMatches)).toEqual(['cathay-shopee', 'cathay-cube', 'fubon-costco']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 0.5, max: 7 });
		expect(r.specificMatches[1].rateRange).toEqual({ min: 0.3, max: 3.3 });
		expect(r.specificMatches[2].rateRange).toEqual({ min: 1, max: 3 });
	});

	it('一般回饋 DAWHO 1~5 排第一，其餘七卡萬用規則到齊', () => {
		const r = engine.search({ query: '高鐵', region: 'domestic' });
		expect(r.generalMatches[0].card.id).toBe('sinopac-dawho');
		expect(r.generalMatches[0].rateRange).toEqual({ min: 1, max: 5 });
		expect(ids(r.generalMatches).sort()).toEqual([
			'esun-kumamon',
			'fubon-momo',
			'sinopac-cashback-jcb',
			'sinopac-daway',
			'sinopac-dawho',
			'sinopac-dual-currency',
			'sinopac-sport'
		]);
	});
});

describe('golden: 排除機制', () => {
	// 熊本熊卡的國內萬用規則沒有 excludes（玉山官網未列排除清單，見 YAML TODO-REVIEW），
	// 因此 0~0.5% 會出現在下列排除情境的一般回饋區——這是忠實反映官網的現狀
	it('台電（代繳類別成員）觸發 excludes → 僅剩熊本熊卡 0~0.5', () => {
		const r = engine.search({ query: '台電', region: 'domestic' });
		expect(r.matchedStores).toEqual(['台電']);
		expect(r.specificMatches).toEqual([]);
		expect(ids(r.generalMatches)).toEqual(['esun-kumamon']);
	});

	it('全聯只剩 CUBE carve-out 0~2 具體匹配，一般回饋僅熊本熊卡', () => {
		const r = engine.search({ query: '全聯', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual(['cathay-cube']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 0, max: 2 });
		expect(ids(r.generalMatches)).toEqual(['esun-kumamon']);
	});

	it('小七（7-ELEVEN 別名，便利商店成員）只剩 CUBE 方案 carve-out 0~2', () => {
		const r = engine.search({ query: '小七', region: 'domestic' });
		expect(r.matchedStores).toEqual(['7-ELEVEN']);
		expect(ids(r.specificMatches)).toEqual(['cathay-cube']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 0, max: 2 });
		expect(ids(r.generalMatches)).toEqual(['esun-kumamon']);
	});

	it('悠遊卡自動加值只剩 DAWHO rate:0 carve-out 0~5', () => {
		const r = engine.search({ query: '悠遊卡', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual(['sinopac-dawho']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 0, max: 5 });
		expect(r.specificMatches[0].baseRule).toBeUndefined();
		// 蝦皮卡站外排除清單僅列icash加值（未列悠遊卡/一卡通，依官網逐字）
		expect(ids(r.generalMatches)).toEqual(['cathay-shopee', 'esun-kumamon']);
	});
});

describe('golden: 保費（類別回饋規則）', () => {
	it('依上緣/下緣排序：幣倍1.2領先，五張卡有保費專屬規則', () => {
		const r = engine.search({ query: '保費', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual([
			'sinopac-dual-currency',
			'sinopac-cashback-jcb',
			'sinopac-dawho',
			'cathay-cube',
			'fubon-momo'
		]);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 1.2, max: 1.2 });
		// 幣倍/JCB/DAWHO/momo 的萬用規則 excludes 保費 → 無 baseRule；CUBE 一般0.3%不排除保費
		expect(r.specificMatches[0].baseRule).toBeUndefined();
		expect(r.specificMatches[1].baseRule).toBeUndefined();
		expect(r.specificMatches[3].baseRule).toBeDefined();
		expect(r.specificMatches[4].baseRule).toBeUndefined();
		// 蝦皮卡/DAWAY/熊本熊的萬用規則未排除保費（依各官網），落在一般回饋
		expect(ids(r.generalMatches)).toEqual(['sinopac-daway', 'cathay-shopee', 'esun-kumamon']);
	});

	it('搜類別成員（國泰人壽）得到相同卡片，matchKind 為 category', () => {
		const r = engine.search({ query: '國泰人壽', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual([
			'sinopac-dual-currency',
			'sinopac-cashback-jcb',
			'sinopac-dawho',
			'cathay-cube',
			'fubon-momo'
		]);
		expect(r.specificMatches.every((m) => m.matchKind === 'category')).toBe(true);
		expect(ids(r.generalMatches)).toEqual(['sinopac-daway', 'cathay-shopee', 'esun-kumamon']);
	});
});

describe('golden: momo（多卡競爭網購通路）', () => {
	it('具體匹配：永豐JCB 1~4 → CUBE 0.3~3.3 → momo卡 3~3', () => {
		const r = engine.search({ query: 'momo', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual([
			'sinopac-cashback-jcb',
			'cathay-cube',
			'fubon-momo'
		]);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 1, max: 4 });
		expect(r.specificMatches[1].rateRange).toEqual({ min: 0.3, max: 3.3 });
		expect(r.specificMatches[2].rateRange).toEqual({ min: 3, max: 3 });
		// momo卡的店外萬用規則排除momo（店內外互斥）→ 無 baseRule
		expect(r.specificMatches[2].baseRule).toBeUndefined();
	});

	it('一般回饋 DAWHO 1~5 排第一，十張卡全部有結果', () => {
		const r = engine.search({ query: 'momo', region: 'domestic' });
		expect(r.generalMatches[0].card.id).toBe('sinopac-dawho');
		expect(r.generalMatches[0].rateRange).toEqual({ min: 1, max: 5 });
		const all = [...ids(r.specificMatches), ...ids(r.generalMatches)];
		expect(all).toHaveLength(10);
	});
});

describe('golden: 海外消費', () => {
	it('淘寶海外：永豐JCB特選 2~5 具體匹配，永豐雙卡 2~6 領先一般回饋', () => {
		const r = engine.search({ query: '淘寶', region: 'international' });
		// JCB 特選淘寶認定為國外消費（帳單顯示Taobao且國別非台灣）
		expect(ids(r.specificMatches)).toEqual(['sinopac-cashback-jcb']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 2, max: 5 });
		expect(ids(r.generalMatches).slice(0, 2).sort()).toEqual([
			'sinopac-dawho',
			'sinopac-dual-currency'
		]);
		expect(r.generalMatches[0].rateRange).toEqual({ min: 2, max: 6 });
		expect(r.generalMatches[1].rateRange).toEqual({ min: 2, max: 6 });
		expect(r.generalMatches[2].card.id).toBe('fubon-costco');
		expect(r.generalMatches[2].rateRange).toEqual({ min: 1, max: 5 });
		// 熊本熊卡無海外(非日本)回饋規則，不應出現
		expect(ids(r.generalMatches)).not.toContain('esun-kumamon');
	});

	it('一蘭拉麵（日本區）：熊本熊卡 2.5~8.5 指定回饋，永豐JCB 2~5 一般回饋', () => {
		const r = engine.search({ query: '一蘭', region: 'japan' });
		expect(ids(r.specificMatches)).toEqual(['esun-kumamon']);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 2.5, max: 8.5 });
		expect(ids(r.generalMatches)).toEqual(['sinopac-cashback-jcb']);
		expect(r.generalMatches[0].rateRange).toEqual({ min: 2, max: 5 });
	});
});

describe('golden: 蝦皮（聯名卡主場）', () => {
	it('蝦皮聯名卡 1.5~10 排第一，永豐JCB特選、CUBE玩數位跟進', () => {
		const r = engine.search({ query: '蝦皮', region: 'domestic' });
		expect(ids(r.specificMatches)).toEqual([
			'cathay-shopee',
			'sinopac-cashback-jcb',
			'cathay-cube'
		]);
		expect(r.specificMatches[0].rateRange).toEqual({ min: 1.5, max: 10 });
		expect(r.specificMatches[1].rateRange).toEqual({ min: 1, max: 4 });
		expect(r.specificMatches[2].rateRange).toEqual({ min: 0.3, max: 3.3 });
	});
});

describe('golden: 我的卡片過濾', () => {
	it('高鐵 + 只持有CUBE → 僅CUBE出現', () => {
		const r = engine.search({ query: '高鐵', region: 'domestic', myCardIds: ['cathay-cube'] });
		expect(ids(r.specificMatches)).toEqual(['cathay-cube']);
		expect(r.generalMatches).toEqual([]);
	});
});
