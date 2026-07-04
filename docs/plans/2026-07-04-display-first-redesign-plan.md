# Display-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved display-first redesign (`docs/plans/2026-07-04-display-first-redesign.md`): category layer for accurate exclusions, floor–ceiling reward ranges, freshness warnings, LLM-assisted data pipeline skills, and the DAWHO + CUBE validation pair.

**Architecture:** Additive schema changes (maxTotalRate / sourceUrl / pointsName / categories); a store→category inverted index feeding set-intersection matching and exclusion in the existing 4-stage search pipeline; `rateRange {min,max}` replacing the single optimistic `maxReward`; build-data gains category cross-validation and freshness warnings; two project skills automate data production with mandatory human review.

**Tech Stack:** SvelteKit + Svelte 5 runes, TypeScript strict, Zod v4, Vitest + @testing-library/svelte, Playwright, tsx scripts, YAML data.

## Global Constraints (from CLAUDE.md)

- TypeScript strict mode; never `any`.
- Conventional Commits: `type: imperative ≤50 chars`, body explains why, ≤72 chars/line. Types: feat/fix/docs/refactor/test/chore/style/perf.
- Small CLs: target ≤100 changed lines, split above ~200. One logical change per commit; tests live in the SAME commit as the code they test.
- Data commits (YAML/JSON) separate from code commits.
- Every commit must leave the tree green: `pnpm build-data && pnpm check && pnpm test` must pass.
- Never push to master; work stays on `feat/display-first-redesign` (already checked out).
- Card data only from official bank pages; every card carries `sourceUrl` + `updatedAt`.
- No `Co-Authored-By: Claude` trailer. No `--no-verify`, no force-push.
- Components render only; logic lives in `src/lib/engine/` + `src/lib/stores/`. Engine stays pure (no Svelte imports).
- Windows environment: Bash tool works; commands below use POSIX syntax.

**Baseline check before Task 1:** `pnpm build-data && pnpm check && pnpm test` — all pass (expired-rule warnings from old data are expected and OK).

---

### Task 1: Schema additions (types + Zod)

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/schema.ts`
- Test: `tests/engine/schema.test.ts` (extend existing)

**Interfaces:**
- Consumes: nothing new.
- Produces: `RewardRule.maxTotalRate?: number`, `RewardRule.sourceUrl?: string`, `CreditCard.pointsName?: string`, `'方案切換'` in `CONDITION_TAGS`, `type Categories = Record<string, string[]>`, `SearchIndex.categories?: Categories`, `categoriesSchema`. Later tasks import `Categories` from `$lib/types` and `categoriesSchema` from `$lib/schema`.

- [ ] **Step 1: Write failing tests** — append to `tests/engine/schema.test.ts` (follow the file's existing describe/it style):

```typescript
import { categoriesSchema } from '$lib/schema';

describe('schema v2 additions', () => {
	it('accepts maxTotalRate >= rate and rule sourceUrl', () => {
		const rule = {
			stores: ['*'], region: 'domestic', rate: 0.3, limit: 0, limitUnit: '元',
			maxTotalRate: 3.3, sourceUrl: 'https://example.com/campaign'
		};
		expect(rewardRuleSchema.safeParse(rule).success).toBe(true);
	});

	it('rejects maxTotalRate < rate', () => {
		const rule = {
			stores: ['*'], region: 'domestic', rate: 2, limit: 0, limitUnit: '元',
			maxTotalRate: 1
		};
		expect(rewardRuleSchema.safeParse(rule).success).toBe(false);
	});

	it('accepts pointsName on a card and 方案切換 tag on a tier', () => {
		const card = {
			id: 'cathay-cube', name: 'CUBE卡', bank: '國泰世華', network: ['visa'],
			rewardType: '點數回饋', pointsName: '小樹點',
			sourceUrl: 'https://example.com', updatedAt: '2026-07-04',
			rewards: [{
				stores: ['*'], region: 'domestic', rate: 0.3, limit: 0, limitUnit: '元',
				tiers: [{ label: '玩數位', bonus: 3, limit: 0, limitUnit: '元',
					condition: '需切換方案', tags: ['方案切換'] }]
			}]
		};
		expect(creditCardSchema.safeParse(card).success).toBe(true);
	});

	it('validates categories as record of string arrays', () => {
		expect(categoriesSchema.safeParse({ 保費: ['國泰人壽'] }).success).toBe(true);
		expect(categoriesSchema.safeParse({ 保費: 'x' }).success).toBe(false);
	});
});
```

Note: `rewardRuleSchema`/`creditCardSchema` are already imported at the top of this test file; only add the `categoriesSchema` import.

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run tests/engine/schema.test.ts`
Expected: FAIL (`categoriesSchema` not exported; maxTotalRate rejected as unknown key is NOT the failure mode — zod strips unknown keys, so the `rejects maxTotalRate < rate` test fails because parse succeeds).

- [ ] **Step 3: Implement types** — in `src/lib/types.ts`:

Add `'方案切換'` to the end of the `CONDITION_TAGS` array.

In `RewardTier`… no change. In `RewardRule`, after `limitUnit`:

```typescript
	maxTotalRate?: number;
	sourceUrl?: string;
```

In `CreditCard`, after `rewardType`:

```typescript
	pointsName?: string;
```

After the `Aliases` type:

```typescript
export type Categories = Record<string, string[]>;
```

In `SearchIndex`:

```typescript
export interface SearchIndex {
	aliases: Aliases;
	storeRestrictions: Record<string, StoreRestriction>;
	categories?: Categories;
}
```

- [ ] **Step 4: Implement schema** — in `src/lib/schema.ts`:

In `rewardRuleSchema`, add after `limitUnit`:

```typescript
	maxTotalRate: z.number().nonnegative().optional(),
	sourceUrl: z.string().url().optional(),
```

and chain a refinement onto the object (rename the plain object to keep the export name):

```typescript
export const rewardRuleSchema = z
	.object({
		/* existing + new fields */
	})
	.refine((r) => r.maxTotalRate === undefined || r.maxTotalRate >= r.rate, {
		message: 'maxTotalRate must be >= rate',
		path: ['maxTotalRate']
	});
```

In `creditCardSchema`, add after `rewardType`:

```typescript
	pointsName: z.string().min(1).optional(),
```

After `aliasesSchema`:

```typescript
export const categoriesSchema = z.record(z.string(), z.array(z.string().min(1)));
```

- [ ] **Step 5: Verify green** — `pnpm vitest run tests/engine/schema.test.ts` → PASS; then `pnpm check && pnpm test` → PASS. If `tests/engine/types.test.ts` asserts the exact CONDITION_TAGS list, update it to include `方案切換` in this commit.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/schema.ts tests/engine/schema.test.ts tests/engine/types.test.ts
git commit -m "feat: extend schema for ranges and categories" -m "Additive schema for the display-first redesign: authored reward
ceiling (maxTotalRate) replaces tier-combinatorics derivation, rule-level
sourceUrl feeds the refresh pipeline, pointsName labels points cards,
and categories back the new store-category layer."
```

---

### Task 2: Category index + expansion (`engine/category.ts`)

**Files:**
- Create: `src/lib/engine/category.ts`
- Test: `tests/engine/category.test.ts` (new)

**Interfaces:**
- Consumes: `Categories` from `$lib/types` (Task 1).
- Produces: `type CategoryIndex = Map<string, string[]>`, `buildCategoryIndex(categories: Categories): CategoryIndex`, `expandStores(canonical: string, index: CategoryIndex): string[]`. Task 3 imports all three.

- [ ] **Step 1: Write failing tests** — `tests/engine/category.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildCategoryIndex, expandStores } from '$lib/engine/category';
import type { Categories } from '$lib/types';

const categories: Categories = {
	保費: ['國泰人壽', '富邦產險'],
	代繳: ['台電', '台灣自來水'],
	網購: ['國泰人壽'] // deliberately multi-category member
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
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run tests/engine/category.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** — `src/lib/engine/category.ts`:

```typescript
import type { Categories } from '$lib/types';

export type CategoryIndex = Map<string, string[]>;

export function buildCategoryIndex(categories: Categories): CategoryIndex {
	const index: CategoryIndex = new Map();
	for (const [category, members] of Object.entries(categories)) {
		for (const member of members) {
			const existing = index.get(member) ?? [];
			if (!existing.includes(category)) {
				existing.push(category);
			}
			index.set(member, existing);
		}
	}
	return index;
}

export function expandStores(canonical: string, index: CategoryIndex): string[] {
	return [canonical, ...(index.get(canonical) ?? [])];
}
```

- [ ] **Step 4: Verify green** — `pnpm vitest run tests/engine/category.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/category.ts tests/engine/category.test.ts
git commit -m "feat: add category inverted index and store expansion" -m "Layer-1 accuracy fix from the redesign: a store name expands to
{store} ∪ its categories so exclusion and reward matching can use set
intersection instead of name-exact comparison."
```

---

### Task 3: Search matches and excludes via category expansion

**Files:**
- Modify: `src/lib/engine/filter.ts` (isExcluded signature)
- Modify: `src/lib/engine/search.ts` (expansion, matchKind, filters)
- Modify: `src/lib/stores/search.svelte.ts` (pass categories through)
- Modify: `src/routes/+page.svelte:22` (pass `searchIndex.categories`)
- Test: `tests/engine/filter.test.ts`, `tests/engine/search.test.ts`

**Interfaces:**
- Consumes: `buildCategoryIndex`, `expandStores`, `CategoryIndex` from `./category` (Task 2); `Categories` from `$lib/types`.
- Produces: `isExcluded(expandedStores: string[], rule: RewardRule): boolean`; `createSearchEngine(cards, aliases, restrictions, categories?: Categories)`; `initSearchEngine(cards, aliases, restrictions, categories?: Categories)`; `SearchResult.matchKind: 'store' | 'category' | 'wildcard'`. Task 4 keeps these.

- [ ] **Step 1: Write failing tests.**

In `tests/engine/filter.test.ts`, replace the `isExcluded` describe block's call sites (old signature `isExcluded(storeName, rule)`) with the set form and add the regression cases:

```typescript
describe('isExcluded', () => {
	const rule = makeRule({ excludes: ['保費', '代繳'] });

	it('excluded when any expanded name is in excludes', () => {
		expect(isExcluded(['台電', '代繳'], rule)).toBe(true);
	});

	it('not excluded when expansion misses excludes', () => {
		expect(isExcluded(['台電'], rule)).toBe(false);
	});

	it('direct category search still excluded', () => {
		expect(isExcluded(['保費'], rule)).toBe(true);
	});

	it('rule without excludes never excluded', () => {
		expect(isExcluded(['保費'], makeRule())).toBe(false);
	});
});
```

(Keep/adapt the file's existing `makeRule` helper; if the old block had other cases, port them to array-argument form in this commit.)

In `tests/engine/search.test.ts`, add a new describe block at the end (reuses the file's fixture style):

```typescript
describe('category expansion', () => {
	const cards: CreditCard[] = [
		{
			id: 'excluder', name: '排除卡', bank: 'A銀行', network: ['visa'],
			rewardType: '現金回饋', sourceUrl: 'https://example.com', updatedAt: '2026-07-01',
			rewards: [{
				stores: ['*'], storeLabel: '國內全通路', region: 'domestic',
				rate: 1, limit: 0, limitUnit: '元', excludes: ['保費', '代繳']
			}]
		},
		{
			id: 'premium-card', name: '保費卡', bank: 'B銀行', network: ['visa'],
			rewardType: '現金回饋', sourceUrl: 'https://example.com', updatedAt: '2026-07-01',
			rewards: [{
				stores: ['保費'], region: 'domestic', rate: 1.2, limit: 0, limitUnit: '元'
			}]
		}
	];
	const aliases: Aliases = { 保費: ['保險費'], 代繳: [], 台電: ['台灣電力'], 國泰人壽: [] };
	const categories = { 保費: ['國泰人壽'], 代繳: ['台電'] };
	const engine = createSearchEngine(cards, aliases, {}, categories);

	it('searching a category member fires the exclusion (台電 → 代繳)', () => {
		const r = engine.search({ query: '台電', region: 'domestic' });
		expect(r.generalMatches.map((m) => m.card.id)).not.toContain('excluder');
	});

	it('searching a member surfaces the category reward rule (國泰人壽 → 保費 1.2%)', () => {
		const r = engine.search({ query: '國泰人壽', region: 'domestic' });
		expect(r.specificMatches.map((m) => m.card.id)).toContain('premium-card');
		expect(r.specificMatches[0].matchKind).toBe('category');
		expect(r.generalMatches.map((m) => m.card.id)).not.toContain('excluder');
	});

	it('direct category search unchanged (保費)', () => {
		const r = engine.search({ query: '保費', region: 'domestic' });
		expect(r.specificMatches.map((m) => m.card.id)).toContain('premium-card');
		expect(r.specificMatches[0].matchKind).toBe('store');
	});

	it('engine without categories behaves as before', () => {
		const legacy = createSearchEngine(cards, aliases, {});
		const r = legacy.search({ query: '台電', region: 'domestic' });
		expect(r.generalMatches.map((m) => m.card.id)).toContain('excluder');
	});
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run tests/engine/filter.test.ts tests/engine/search.test.ts` → FAIL (signature + missing matchKind/param).

- [ ] **Step 3: Implement `filter.ts`** — replace `isExcluded`:

```typescript
export function isExcluded(expandedStores: string[], rule: RewardRule): boolean {
	if (!rule.excludes) return false;
	return rule.excludes.some((e) => expandedStores.includes(e));
}
```

- [ ] **Step 4: Implement `search.ts`.** Changes:

```typescript
import type { CreditCard, Aliases, StoreRestriction, Region, RewardRule, Categories } from '$lib/types';
import { buildCategoryIndex, expandStores, type CategoryIndex } from './category';

export type MatchKind = 'store' | 'category' | 'wildcard';

export interface SearchResult {
	card: CreditCard;
	matchedRule: RewardRule;
	baseRule?: RewardRule;
	maxReward: number;
	isSpecificMatch: boolean;
	matchKind: MatchKind;
}

export function createSearchEngine(
	cards: CreditCard[],
	aliases: Aliases,
	restrictions: Record<string, StoreRestriction>,
	categories: Categories = {}
): SearchEngine {
	const storeIndex = buildStoreIndex(cards);
	const prefixIndex = buildPrefixIndex(aliases);
	const categoryIndex = buildCategoryIndex(categories);
	// ...
```

Inside `search()`, per matched store:

```typescript
		for (const storeName of matchedStores) {
			const expanded = expandStores(storeName, categoryIndex);

			// Specific rules: union over expanded names, tagged by match kind
			for (const name of expanded) {
				const kind: MatchKind = name === storeName ? 'store' : 'category';
				for (const ref of storeIndex.get(name) ?? []) {
					const card = cards[ref.cardIndex];
					const rule = card.rewards[ref.ruleIndex];

					if (!passesFilters(card, rule, expanded, storeName, region, restrictions, myCardIds))
						continue;

					const baseRule = findWildcardRule(card, region, expanded);
					const maxReward = computeMaxReward(rule, baseRule);

					const existing = specificByCard.get(card.id);
					const better =
						!existing ||
						maxReward > existing.maxReward ||
						(maxReward === existing.maxReward &&
							kind === 'store' &&
							existing.matchKind === 'category');
					if (better) {
						specificByCard.set(card.id, {
							card, matchedRule: rule, baseRule, maxReward,
							isSpecificMatch: true, matchKind: kind
						});
					}
				}
			}

			// Wildcard rules (cards not already specific)
			const wildcardRefs = storeIndex.get('*') ?? [];
			for (const ref of wildcardRefs) {
				const card = cards[ref.cardIndex];
				const rule = card.rewards[ref.ruleIndex];
				if (specificByCard.has(card.id)) continue;
				if (!passesFilters(card, rule, expanded, storeName, region, restrictions, myCardIds))
					continue;
				const maxReward = getRuleMaxReward(rule);
				const existing = generalByCard.get(card.id);
				if (!existing || maxReward > existing.maxReward) {
					generalByCard.set(card.id, {
						card, matchedRule: rule, maxReward,
						isSpecificMatch: false, matchKind: 'wildcard'
					});
				}
			}
		}
```

Helpers change to expansion-based:

```typescript
	function passesFilters(
		card: CreditCard,
		rule: RewardRule,
		expanded: string[],
		storeName: string,
		region: Region,
		storeRestrictions: Record<string, StoreRestriction>,
		myCardIds?: string[]
	): boolean {
		if (rule.region !== region) return false;
		if (!isRuleActive(rule)) return false;
		if (isExcluded(expanded, rule)) return false;
		if (!isCardAccepted(card, storeName, storeRestrictions)) return false;
		if (myCardIds && !myCardIds.includes(card.id)) return false;
		return true;
	}

	function findWildcardRule(
		card: CreditCard,
		region: Region,
		expanded: string[]
	): RewardRule | undefined {
		return card.rewards.find(
			(r) =>
				r.stores.includes('*') &&
				r.region === region &&
				isRuleActive(r) &&
				!isExcluded(expanded, r)
		);
	}
```

- [ ] **Step 5: Wire the store and page.** `src/lib/stores/search.svelte.ts`:

```typescript
export function initSearchEngine(
	cards: CreditCard[],
	aliases: Aliases,
	restrictions: Record<string, StoreRestriction>,
	categories: Categories = {}
): void {
	engine = createSearchEngine(cards, aliases, restrictions, categories);
}
```

(add `Categories` to its type import). `src/routes/+page.svelte` line 22:

```typescript
		initSearchEngine(cards, searchIndex.aliases, searchIndex.storeRestrictions, searchIndex.categories ?? {});
```

If TypeScript flags `searchIndex.categories` because the imported JSON lacks the key, keep `?? {}` — the JSON gains the key in Task 6.

- [ ] **Step 6: Verify green** — `pnpm vitest run tests/engine` then `pnpm check && pnpm test` → PASS. Existing search tests need `matchKind` nowhere (they don't construct SearchResult), but `tests/components/*.test.ts` fixtures DO construct SearchResult — add `matchKind: 'store'` to the `makeResult` helpers in `tests/components/CardResult.test.ts` (and any other component test that builds a SearchResult) in this commit.

- [ ] **Step 7: Commit**

```bash
git add src/lib/engine/filter.ts src/lib/engine/search.ts src/lib/stores/search.svelte.ts src/routes/+page.svelte tests/engine/filter.test.ts tests/engine/search.test.ts tests/components
git commit -m "feat: match and exclude via category expansion" -m "Fixes the v1 accuracy failures: excludes compared the searched name
literally, so a rule excluding 代繳 still surfaced when searching 台電.
Matching and exclusion now intersect the expanded {store ∪ categories}
set, and category-level hits are tagged for ranking below exact-store
hits."
```

---

### Task 4: Floor–ceiling rate range replaces maxReward

**Files:**
- Modify: `src/lib/engine/scoring.ts` (rewrite)
- Modify: `src/lib/engine/search.ts` (SearchResult + sort)
- Modify: `src/components/CardResult.svelte` (headline range)
- Test: `tests/engine/scoring.test.ts` (rewrite), `tests/engine/search.test.ts`, `tests/components/CardResult.test.ts`

**Interfaces:**
- Consumes: `RewardRule.maxTotalRate` (Task 1), `MatchKind` (Task 3).
- Produces: `interface RateRange { min: number; max: number }`, `getRuleRateRange(rule: RewardRule): RateRange`, `combineRateRanges(matched: RateRange, base?: RateRange): RateRange` (all exported from `$lib/engine/scoring`); `SearchResult.rateRange: RateRange` (replaces `maxReward`). UI tasks rely on `result.rateRange`.

- [ ] **Step 1: Write failing tests** — replace `tests/engine/scoring.test.ts` content:

```typescript
import { describe, it, expect } from 'vitest';
import { getRuleRateRange, combineRateRanges } from '$lib/engine/scoring';
import type { RewardRule } from '$lib/types';

const makeRule = (overrides: Partial<RewardRule> = {}): RewardRule => ({
	stores: ['*'],
	region: 'domestic',
	rate: 1,
	limit: 0,
	limitUnit: '元',
	...overrides
});

describe('getRuleRateRange', () => {
	it('no tiers: min = max = rate', () => {
		expect(getRuleRateRange(makeRule({ rate: 1.5 }))).toEqual({ min: 1.5, max: 1.5 });
	});

	it('tiers: max = rate + best bonus', () => {
		const rule = makeRule({
			rate: 1,
			tiers: [
				{ label: 'A', bonus: 2.5, limit: 400, limitUnit: '元', condition: 'a' },
				{ label: 'B', bonus: 4, limit: 1000, limitUnit: '元', condition: 'b' }
			]
		});
		expect(getRuleRateRange(rule)).toEqual({ min: 1, max: 5 });
	});

	it('authored maxTotalRate overrides tier derivation', () => {
		const rule = makeRule({
			rate: 1,
			maxTotalRate: 3, // bank says 最高3%, tiers would derive 5
			tiers: [
				{ label: 'A', bonus: 2, limit: 0, limitUnit: '元', condition: 'a' },
				{ label: 'B', bonus: 4, limit: 0, limitUnit: '元', condition: 'b' }
			]
		});
		expect(getRuleRateRange(rule)).toEqual({ min: 1, max: 3 });
	});

	it('zero-base rule (悠遊卡 pattern): min 0', () => {
		const rule = makeRule({
			rate: 0,
			tiers: [{ label: '大戶', bonus: 3, limit: 100, limitUnit: '元', condition: 'c' }]
		});
		expect(getRuleRateRange(rule)).toEqual({ min: 0, max: 3 });
	});
});

describe('combineRateRanges', () => {
	it('no base: matched range unchanged', () => {
		expect(combineRateRanges({ min: 2, max: 2 })).toEqual({ min: 2, max: 2 });
	});

	it('base with higher ceiling raises max only', () => {
		expect(combineRateRanges({ min: 2, max: 2 }, { min: 1, max: 5 })).toEqual({ min: 2, max: 5 });
	});

	it('min always stays the matched rule floor (specific rule overrides base)', () => {
		expect(combineRateRanges({ min: 0, max: 3 }, { min: 1, max: 1 })).toEqual({ min: 0, max: 3 });
	});
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run tests/engine/scoring.test.ts` → FAIL.

- [ ] **Step 3: Implement scoring** — replace `src/lib/engine/scoring.ts`:

```typescript
import type { RewardRule } from '$lib/types';

export interface RateRange {
	min: number;
	max: number;
}

export function getRuleRateRange(rule: RewardRule): RateRange {
	const maxBonus =
		rule.tiers && rule.tiers.length > 0 ? Math.max(...rule.tiers.map((t) => t.bonus)) : 0;
	return { min: rule.rate, max: rule.maxTotalRate ?? rule.rate + maxBonus };
}

export function combineRateRanges(matched: RateRange, base?: RateRange): RateRange {
	if (!base) return matched;
	return { min: matched.min, max: Math.max(matched.max, base.max) };
}
```

- [ ] **Step 4: Update `search.ts`.** In `SearchResult`, replace `maxReward: number` with `rateRange: RateRange` (import `RateRange, getRuleRateRange, combineRateRanges` from `./scoring`; drop old imports). Specific branch:

```typescript
					const rateRange = combineRateRanges(
						getRuleRateRange(rule),
						baseRule ? getRuleRateRange(baseRule) : undefined
					);
					const existing = specificByCard.get(card.id);
					const better =
						!existing ||
						rateRange.max > existing.rateRange.max ||
						(rateRange.max === existing.rateRange.max &&
							kind === 'store' &&
							existing.matchKind === 'category');
```

Wildcard branch: `const rateRange = getRuleRateRange(rule);` and compare `rateRange.max > existing.rateRange.max`. Store `rateRange` in both result objects. Sorting:

```typescript
		const kindRank: Record<MatchKind, number> = { store: 0, category: 1, wildcard: 2 };
		const compareResults = (a: SearchResult, b: SearchResult): number =>
			b.rateRange.max - a.rateRange.max ||
			kindRank[a.matchKind] - kindRank[b.matchKind] ||
			b.rateRange.min - a.rateRange.min;

		const specificMatches = [...specificByCard.values()].sort(compareResults);
		const generalMatches = [...generalByCard.values()].sort(compareResults);
```

Update any `maxReward` references in `tests/engine/search.test.ts` assertions to `rateRange.max` (search the file; e.g. `expect(r.specificMatches[0].maxReward)` → `expect(r.specificMatches[0].rateRange.max)`).

- [ ] **Step 5: Update `CardResult.svelte` headline (Row 2)** — replace the max-reward span:

```svelte
		<span class="text-3xl font-bold text-blue-600">
			{#if result.rateRange.max > result.rateRange.min}
				{formatRate(result.rateRange.min)}% ~ {formatRate(result.rateRange.max)}%
			{:else}
				{formatRate(result.rateRange.max)}%
			{/if}
		</span>
```

Update `tests/components/CardResult.test.ts`: `makeResult` gets `rateRange: { min: 5, max: 7 }` instead of `maxReward: 7`; the `displays max reward rate` test becomes:

```typescript
	it('displays reward range when floor differs from ceiling', () => {
		render(CardResult, { props: { result: makeResult() } });
		expect(screen.getByText('5% ~ 7%')).toBeInTheDocument();
	});

	it('displays single rate when floor equals ceiling', () => {
		render(CardResult, {
			props: { result: makeResult({ rateRange: { min: 7, max: 7 } }) }
		});
		expect(screen.getByText('7%')).toBeInTheDocument();
	});
```

Fix other component-test fixtures that carried `maxReward` (grep `maxReward` under `tests/`).

- [ ] **Step 6: Verify green** — `pnpm check && pnpm test` → PASS (grep the repo for `maxReward` — zero hits outside git history).

- [ ] **Step 7: Commit**

```bash
git add src/lib/engine/scoring.ts src/lib/engine/search.ts src/components/CardResult.svelte tests/engine/scoring.test.ts tests/engine/search.test.ts tests/components
git commit -m "feat: show reward as floor-ceiling range" -m "A single rate+max(bonus) number silently promised the best case and
mis-ranked rules with mutually exclusive tiers. Results now carry
{min,max}: min is the unconditional floor of the matched rule, max the
authored maxTotalRate (bank's own 最高X% claim) or derived fallback.
Sort: ceiling desc, exact-store before category, floor desc."
```

---

### Task 5: Points badge + condition tag chips

**Files:**
- Modify: `src/components/CardResult.svelte`
- Test: `tests/components/CardResult.test.ts`

**Interfaces:**
- Consumes: `CreditCard.pointsName` (Task 1), `RewardTier.tags` (existing).
- Produces: UI only.

- [ ] **Step 1: Write failing tests** — append to `tests/components/CardResult.test.ts`:

```typescript
	it('shows points name badge for points cards', () => {
		const result = makeResult();
		result.card = { ...result.card, rewardType: '點數回饋', pointsName: '小樹點' };
		render(CardResult, { props: { result } });
		expect(screen.getByText('點數回饋（小樹點）')).toBeInTheDocument();
	});

	it('shows condition tag chips inside expanded tiers', async () => {
		const user = userEvent.setup();
		render(CardResult, { props: { result: makeResult() } });
		await user.click(screen.getByText('加碼條件'));
		expect(screen.getByText('指定通路')).toBeInTheDocument();
	});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run tests/components/CardResult.test.ts` → FAIL.

- [ ] **Step 3: Implement.** Row 2 reward-type span becomes:

```svelte
		<span class="text-sm text-gray-500">
			{result.card.rewardType}{#if result.card.pointsName}（{result.card.pointsName}）{/if}
		</span>
```

In BOTH tier `{#each}` blocks (matchedRule and baseRule), after the condition div add:

```svelte
						{#if tier.tags?.length}
							<div class="mt-0.5 flex flex-wrap gap-1">
								{#each tier.tags as tag}
									<span class="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">{tag}</span>
								{/each}
							</div>
						{/if}
```

- [ ] **Step 4: Verify green** — `pnpm vitest run tests/components/CardResult.test.ts && pnpm check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CardResult.svelte tests/components/CardResult.test.ts
git commit -m "feat: show points name badge and tier tag chips" -m "Points cards display their nominal rate honestly labeled with the
points currency; tier tags become visible chips so layer-2 (user-state)
conditions are scannable without expanding the full condition text."
```

---

### Task 6: build-data loads, validates, and emits categories

**Files:**
- Modify: `scripts/build-data.ts`

**Interfaces:**
- Consumes: `categoriesSchema` (Task 1), `Categories` type.
- Produces: `search-index.json` gains `categories`; crossValidate accepts category names for `stores`/`excludes`; category members must be alias keys.

No unit-test harness exists for scripts (verification is by running the pipeline; regression is covered by the fatal/warn exit codes).

- [ ] **Step 1: Implement loader** — after `loadAliases()`:

```typescript
function loadCategories(): Categories {
	const categoriesPath = path.join(DATA_DIR, 'categories.yaml');
	if (!fs.existsSync(categoriesPath)) return {};

	const raw = yaml.load(fs.readFileSync(categoriesPath, 'utf-8'));
	const result = categoriesSchema.safeParse(raw);

	if (!result.success) {
		fatal(`categories.yaml: schema validation failed\n  ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ')}`);
		return {};
	}

	return result.data as Categories;
}
```

Add `categoriesSchema` to the schema import and `Categories` to the types import.

- [ ] **Step 2: Extend crossValidate** — signature `crossValidate(cards, stores, aliases, categories: Categories)`. Replace the alias-only resolution:

```typescript
	const aliasKeys = new Set(Object.keys(aliases));
	const categoryNames = new Set(Object.keys(categories));
	const resolvable = new Set([...aliasKeys, ...categoryNames]);

	// Category members must be searchable canonical stores
	for (const [category, members] of Object.entries(categories)) {
		for (const member of members) {
			if (!aliasKeys.has(member)) {
				fatal(`categories.yaml: "${category}" member "${member}" not found in aliases.yaml`);
			}
		}
	}
```

Change the two existing checks to use `resolvable` instead of `aliasKeys`:
- store check: `if (store !== '*' && !resolvable.has(store))` → fatal `store "X" not found in aliases.yaml or categories.yaml`
- excludes check: `if (!resolvable.has(exc))` → fatal `excludes "X" not found in aliases.yaml or categories.yaml`

Orphaned-alias warning: after building `referencedStores`, also mark members of referenced categories as referenced:

```typescript
		for (const [category, members] of Object.entries(categories)) {
			if (referencedStores.has(category)) {
				for (const member of members) referencedStores.add(member);
			}
		}
```

- [ ] **Step 3: Emit** — `buildOutput(cards, stores, aliases, categories)`:

```typescript
	const searchIndex: SearchIndex = { aliases, storeRestrictions, categories };
```

Update the main block: `const categories = loadCategories();`, pass into `crossValidate(...)` and `buildOutput(...)`, and extend the summary log with `, ${Object.keys(categories).length} categories`.

- [ ] **Step 4: Verify** — `pnpm build-data` → succeeds with `0 categories` (file absent), `search-index.json` now contains `"categories": {}`. `pnpm validate-data && pnpm check && pnpm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-data.ts src/lib/data/search-index.json
git commit -m "feat: cross-validate categories in build-data" -m "stores/excludes may now reference category names; category members
must resolve to alias canonicals so every member stays searchable. The
compiled search index carries categories for engine expansion."
```

---

### Task 7: Initial category data (保費 / 代繳)

**Files:**
- Create: `data/categories.yaml`
- Modify: `data/aliases.yaml`

Data-only commit (repo rule: data separate from code).

- [ ] **Step 1: Create `data/categories.yaml`:**

```yaml
# 類別 → 成員通路。alias 是「同一實體的別名」，這裡是「從屬關係」。
# 成員必須是 aliases.yaml 的 key（可搜尋的 canonical 名稱）。
保費:
  - 國泰人壽
  - 富邦人壽
  - 新光人壽
  - 南山人壽
  - 富邦產險
代繳:
  - 台電
  - 台灣自來水
  - 欣欣天然氣
```

- [ ] **Step 2: Add member canonicals to `data/aliases.yaml`:**

```yaml
國泰人壽:
  - Cathay Life
富邦人壽: []
新光人壽: []
南山人壽: []
富邦產險: []
台電:
  - 台灣電力
  - 電費
台灣自來水:
  - 自來水費
  - 水費
欣欣天然氣:
  - 欣欣瓦斯
```

- [ ] **Step 3: Verify** — `pnpm build-data` → `2 categories`, no fatals (orphan warnings must NOT fire for the new members since 保費/代繳 are referenced by cards). `pnpm test` → PASS. Manual spot check: `pnpm dev`, search 台電 → 幣倍卡/DAWHO 國內全通路 rules must NOT appear (all currently expired anyway — verify via unit test instead if dev data is empty).

- [ ] **Step 4: Commit**

```bash
git add data/categories.yaml data/aliases.yaml src/lib/data/search-index.json
git commit -m "feat: add insurance and utility categories" -m "Seed the category layer with the two categories existing cards
reference in excludes/stores (保費, 代繳), with searchable members."
```

---

### Task 8: Freshness warnings in build-data

**Files:**
- Modify: `scripts/build-data.ts` (crossValidate)

- [ ] **Step 1: Implement.** At the top of `crossValidate`, define once:

```typescript
	const DAY_MS = 86_400_000;
	const todayStr = new Date().toISOString().slice(0, 10);
	const soonStr = new Date(Date.now() + 30 * DAY_MS).toISOString().slice(0, 10);
	const staleStr = new Date(Date.now() - 180 * DAY_MS).toISOString().slice(0, 10);
```

Replace the existing expired-rule warn with the pair (and reuse `todayStr` instead of recomputing):

```typescript
				if (rule.validUntil && rule.validUntil < todayStr) {
					warn(`${card.id}: rule for [${rule.stores.join(',')}] expired on ${rule.validUntil} — delete it (policy) or run /refresh-cards`);
				} else if (rule.validUntil && rule.validUntil <= soonStr) {
					warn(`${card.id}: rule for [${rule.stores.join(',')}] expires soon (${rule.validUntil})`);
				}
```

Per card (inside the outer card loop, once per card):

```typescript
			if (card.updatedAt < staleStr) {
				warn(`${card.id}: updatedAt ${card.updatedAt} older than 180 days — verify against ${card.sourceUrl}`);
			}
```

- [ ] **Step 2: Verify** — `pnpm build-data`: current data must produce expired warnings for DAWHO/幣倍卡 rules (validUntil 2026-06-30) and NO stale warnings (updatedAt 2026-03-x is within 180 days). Exit code stays 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/build-data.ts
git commit -m "feat: warn on expiring rules and stale cards" -m "Turns silent data rot into a visible task list: the March stall began
exactly this way — every campaign rule expired 2026-06-30 with nothing
surfacing it. Warn (not fail) so a lapsed campaign never blocks builds."
```

---

### Task 9: Data pipeline skills (/add-card, /refresh-cards)

**Files:**
- Create: `.claude/skills/add-card/SKILL.md`
- Create: `.claude/skills/refresh-cards/SKILL.md`

- [ ] **Step 1: Write `.claude/skills/add-card/SKILL.md`:**

```markdown
---
name: add-card
description: Draft a new card YAML (or re-extract an existing one) from official bank pages, following WhichCard's schema and inclusion policy. Use when the user asks to add/refresh a credit card. Args: <official card page URL> [campaign page URLs...] — or a card id like sinopac-dawho to refresh from its recorded sourceUrls.
---

# /add-card — 官方頁面 → YAML 草稿（人工審查制）

你是資料抽取管線。產出草稿，**絕不自行 commit**。

## 硬規則
1. 只能使用銀行官方頁面（args 給的 URL 及其站內連結）。禁止部落格、論壇、新聞。
2. 逐條套用收錄政策（見下）。被排除的權益仍要在回報中列出「已排除＋原因」。
3. 每個非顯然的數字（rate、bonus、limit、maxTotalRate、日期）在 YAML 加上
   來源引文註解：`# 官網:「最高3.3%回饋」`。
4. 資訊不確定或頁面矛盾 → 該行加 `# TODO-REVIEW: <疑點>`，不要猜。
5. 若頁面是 JS 動態渲染抓不到內容，請使用者貼上頁面文字，不要改用非官方來源。

## 收錄政策（與 CLAUDE.md 一致）
- 收：常態權益、銀行官方主檔活動（通常半年一期，須有 validFrom/validUntil）。
- 不收：新戶/首刷禮、單月或單一通路短期加碼、名額抽獎型活動。
- 點數卡：rate 填銀行標示的名目 %，`pointsName` 填點數名稱，不做折現。
- 方案切換型（如 CUBE）：每個方案的指定通路寫成獨立 reward，
  base rate 為卡片無腦回饋，方案加碼寫成 tier（tags: [方案切換]）。
- 等級差異大（如世界卡 vs 鈦金）→ 拆成兩個卡片檔；小差異寫 note。

## 產出步驟
1. WebFetch 所有給定 URL；需要時跟進站內的權益/活動子頁。
2. 寫 `data/cards/{bank}-{name}.yaml`（id 規則：全小寫 kebab-case）。
   - 每條 rule：stores（用 aliases/categories 的 canonical 名稱）、region、
     rate、limit、limitUnit、excludes、validFrom/validUntil（主檔活動必填）、
     maxTotalRate（直接抄官網「最高X%」，禁止自行加總 tier 推導）、
     sourceUrl（該 rule 依據的活動頁，與卡片頁不同時必填）。
   - 精選/指定通路必須逐一列出通路名稱，不可寫「指定通路」帶過。
3. 新通路 → 草擬 `data/aliases.yaml` 增量（中英別名、常見簡稱）；
   屬於某類別（保費/代繳/…）→ 草擬 `data/categories.yaml` 增量。
4. 跑 `pnpm validate-data`，修到只剩預期中的 warning。
5. 回報：規則摘要表（通路/區域/區間/效期）、已排除清單＋原因、
   所有 TODO-REVIEW、請使用者核對的官網數字清單。

## 驗收
使用者審查 diff 並自行 commit（資料與程式碼分開 commit）。
```

- [ ] **Step 2: Write `.claude/skills/refresh-cards/SKILL.md`:**

```markdown
---
name: refresh-cards
description: Scan card data for expired/expiring/stale entries and draft updates from each card's recorded official sourceUrls. Use when build-data warns about freshness or the user asks to refresh card data. Args: [card id...] — default scans all cards.
---

# /refresh-cards — 資料保鮮巡檢（人工審查制）

你是資料更新管線。產出草稿 diff，**絕不自行 commit**。

## 步驟
1. 跑 `pnpm validate-data`，收集三類 warning：已過期、30 天內到期、
   updatedAt 超過 180 天。args 有給卡片 id 時只處理那些卡。
2. 對每張需處理的卡：
   - WebFetch 卡片 `sourceUrl` 與所有 rule 層級 `sourceUrl`。
   - 已過期規則：官網有續辦 → 更新 validFrom/validUntil 與數字；
     沒續辦 → 刪除該規則（政策：過期資料不保留）。
   - 數字/通路清單有變 → 依 /add-card 的引文與 TODO-REVIEW 規範標註。
   - 一律更新 `updatedAt` 為今天。
3. 跑 `pnpm validate-data` 確認 warning 消除。
4. 回報：每張卡的變更摘要（新增/修改/刪除了哪些規則、依據哪個官網段落）、
   無法確認需人工判斷的項目。

## 驗收
使用者審查 diff 並自行 commit（一張卡一個 data commit）。
```

- [ ] **Step 3: Verify** — restart-free check: `/add-card` and `/refresh-cards` appear in the skill list of a fresh session (or `ls .claude/skills/*/SKILL.md`).

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/add-card/SKILL.md .claude/skills/refresh-cards/SKILL.md
git commit -m "chore: add data pipeline skills" -m "LLM-assisted extraction at build time with mandatory human review:
/add-card drafts card YAML from official pages under the inclusion
policy; /refresh-cards turns freshness warnings into reviewed diffs.
Neither skill ever commits."
```

---

### Task 10: Documentation sync (CLAUDE.md + README)

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: CLAUDE.md edits** (keep surrounding style):
  - 專案架構 tree: add `categories.yaml         # 通路類別（從屬關係，非別名）` under `data/`, and the two skills under a new `.claude/skills/` line.
  - 「通路別名」section: add one line — 別名是同一實體的不同名稱；從屬關係（台電屬於代繳）寫在 `categories.yaml`，兩者不可混用。
  - New section 「通路類別（data/categories.yaml）」 after 通路別名: key 為類別名、value 為成員通路陣列；成員必須是 aliases 的 key；rule 的 `stores`/`excludes` 可寫通路或類別名。
  - 「收錄範圍」rewrite: 收常態權益＋銀行官方主檔活動（半年期，須填起迄日）；不收新戶優惠、單月/短期單一通路加碼、名額型活動。點數卡以名目回饋率收錄並填 `pointsName`。
  - 「回饋規則」section additions: `maxTotalRate` 直接抄官網「最高X%」，禁止用 tier 加總推導；rule 層級 `sourceUrl` 於依據活動頁時必填；等級差異大拆檔。
  - 「架構決策」additions: 搜尋比對用 {通路 ∪ 類別} 集合交集（排除與匹配同一機制）；結果顯示保底~最高區間（排序用上緣，同分 exact-store 優先）；三層準確性模型（通路可判定/使用者狀態/交易當下）一句話；資料由 /add-card、/refresh-cards 草擬、人工審查。
  - 常用指令表: add `/add-card`、`/refresh-cards` 兩列。
- [ ] **Step 2: README edits:** Data Pipeline tree adds `categories.yaml`; Search Engine stage 1 becomes "Alias resolution + category expansion"; stage 3 becomes "floor–ceiling rate range (authored maxTotalRate or derived)"; Adding Card Data section now says: run `/add-card <official URL>` in Claude Code, review the draft, `pnpm validate-data`, commit.
- [ ] **Step 3: Verify** — `pnpm build-data && pnpm check && pnpm test` still green (docs only).
- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: sync data policy and architecture for v2" -m "Documents the category layer (alias vs membership), range display,
maxTotalRate authoring rule, inclusion policy, and the /add-card +
/refresh-cards review-gated pipeline."
```

---

### Task 11: Validation card 1 — refresh 永豐 DAWHO (live data)

**Files:**
- Modify: `data/cards/sinopac-dawho.yaml`, possibly `data/aliases.yaml` / `data/categories.yaml`
- Modify (if expectations shift): `tests/e2e/search.test.ts`

Live-data task: exact YAML comes from the official page at execution time — the process, gates, and checklists below are the deliverable.

- [ ] **Step 1:** Invoke the `/add-card` skill with `sinopac-dawho` (refresh mode; recorded sourceUrl: `https://bank.sinopac.com/sinopacBT/personal/credit-card/introduction/bankcard/DAWHO.html` plus the current DAWHO 現金回饋 campaign page linked from it).
- [ ] **Step 2:** Review the draft against the page: 2026-H2 validFrom/validUntil on every campaign rule; 大戶/大戶Plus tiers with `會員等級` tags; `maxTotalRate` copied from the page's 最高X% claim; expired H1 rules deleted; `updatedAt` = today.
- [ ] **Step 3:** `pnpm build-data` → DAWHO expired warnings gone. `pnpm test` → PASS. If `tests/e2e/search.test.ts` assertions depend on DAWHO rates, update them in this commit (repo rule: tests ride with the change).
- [ ] **Step 4: Commit** (data-only + any e2e adjustment):

```bash
git add data/cards/sinopac-dawho.yaml data/aliases.yaml data/categories.yaml src/lib/data tests/e2e
git commit -m "feat: refresh sinopac-dawho for 2026-H2" -m "First half of the pipeline acceptance test: regenerated via /add-card
from the official page; H1 campaign rules (expired 2026-06-30) removed
per policy."
```

---

### Task 12: Validation card 2 — add 國泰 CUBE (live data)

**Files:**
- Create: `data/cards/cathay-cube.yaml`
- Modify: `data/aliases.yaml`, `data/categories.yaml` (new stores from CUBE's plan lists)
- Modify (if needed): `tests/e2e/search.test.ts`

- [ ] **Step 1:** Invoke `/add-card` with the official CUBE page (`https://www.cathaybk.com.tw/cathaybk/personal/credit-card/cards/intro/cube/`) and the 權益方案 detail page linked from it.
- [ ] **Step 2:** Review the draft:
  - `rewardType: 點數回饋`, `pointsName: 小樹點`, nominal rates.
  - Base rule: `stores: ["*"]` at the card's unconditional rate.
  - One reward per 方案-designated merchant list with the plan bonus as a tier: `condition: 需於APP將權益方案切換至「…」`, `tags: [方案切換]`, `maxTotalRate` from the page.
  - Every designated merchant enumerated by name (policy: no 籠統帶過); new merchants get aliases entries.
- [ ] **Step 3:** `pnpm build-data && pnpm test` → PASS. Spot-check in `pnpm dev`: search a plan merchant → CUBE shows `0.3% ~ 3.3%`-style range with 方案切換 chip (actual numbers per page).
- [ ] **Step 4: Commit:**

```bash
git add data/cards/cathay-cube.yaml data/aliases.yaml data/categories.yaml src/lib/data tests/e2e
git commit -m "feat: add cathay-cube card" -m "Second half of the pipeline acceptance test: points card with
switchable plans expressed as tiers (方案切換 tag) over enumerated
designated-merchant lists — no schema extension needed."
```

---

### Task 13: E2E coverage for range display and category exclusion

**Files:**
- Modify: `tests/e2e/search.test.ts`

- [ ] **Step 1: Add specs** (adjust card names/values to the data committed in Tasks 11–12; structure below):

```typescript
test('reward shows as floor-ceiling range on tiered card', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('combobox').fill('蝦皮'); // any CUBE plan merchant
	await expect(page.getByText(/\d+(\.\d+)?% ~ \d+(\.\d+)?%/).first()).toBeVisible();
});

test('excluded category member hides the excluding card', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('combobox').fill('台電');
	// DAWHO 國內全通路 excludes 代繳 → must not render
	await expect(page.getByText('DAWHO現金回饋信用卡')).toHaveCount(0);
});

test('premium category search surfaces special-rule card', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('combobox').fill('保費');
	// only cards with a 保費-specific rule may appear as specific matches
	await expect(page.getByText('具體匹配').first()).toBeVisible();
});
```

Match the selector conventions already used in this e2e file (check its existing `getByRole`/`getByText` usage and section headings first; adapt literals accordingly).

- [ ] **Step 2: Run** — `pnpm test:e2e` → PASS.
- [ ] **Step 3: Commit:**

```bash
git add tests/e2e/search.test.ts
git commit -m "test: cover range and category exclusion e2e" -m "Pins the v1 regression end-to-end: excluded-category members must not
surface excluding cards, and tiered rewards render as a range."
```

---

### Task 14: Final gate

- [ ] **Step 1:** Full local gate (push 規範): `pnpm build-data && pnpm check && pnpm test && pnpm build` — all PASS, review remaining warnings (only intentional freshness warnings allowed).
- [ ] **Step 2:** `git log --oneline master..HEAD` — verify each commit subject ≤50 chars, conventional type, data/code separation held.
- [ ] **Step 3:** Use superpowers:finishing-a-development-branch — push `feat/display-first-redesign`, open PR to master (title = conventional commit for squash), PR body: summary, motivation (stall diagnosis), test plan (unit + e2e + pipeline acceptance pair). Do NOT merge without user approval.
