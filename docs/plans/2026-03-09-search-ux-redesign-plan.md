# Search UX Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix focus-loss on first keystroke, make IME reliable on all browsers, add keyboard navigation for suggestions, and move SearchBar to a permanent header so the DOM instance never gets destroyed.

**Architecture:** `<SearchBar>` moves into a permanent `<header>` in `+page.svelte` — the only instance that ever exists. The content below the header switches between empty-state chips and search results. `highlightedIndex` tracks keyboard navigation inside the suggestion list without touching the input value.

**Tech Stack:** SvelteKit 5, Svelte runes (`$state`, `$effect`, `$derived`), Tailwind CSS v4, Vitest + @testing-library/svelte, pnpm

---

### Task 1: Add failing tests for new SearchBar behaviors

**Files:**
- Modify: `tests/components/SearchBar.test.ts`

**Context:** The existing three tests cover render, clear button visibility, and clear action. We need three new tests that will FAIL until Task 2 is done:
1. External query change (clicking a popular-search chip) syncs into the input's displayed value.
2. ArrowDown key highlights the first suggestion; Enter selects it.
3. Escape key closes the suggestion list without clearing the query.

Note: `userEvent` from `@testing-library/user-event` v14 handles keyboard events. `fireEvent` from `@testing-library/svelte` is needed for custom keyboard events on the input.

**Step 1: Add the three failing tests**

Open `tests/components/SearchBar.test.ts` and add at the bottom of the `describe` block:

```typescript
it('syncs input value when store query is set externally', async () => {
  render(SearchBar);
  const input = screen.getByPlaceholderText('輸入商家或通路名稱...');
  // Simulate a popular-search chip click setting the store directly
  searchStore.query = 'momo';
  // Svelte needs a tick to re-render
  await new Promise((r) => setTimeout(r, 0));
  expect((input as HTMLInputElement).value).toBe('momo');
});

it('ArrowDown highlights first suggestion; Enter selects it', async () => {
  const user = userEvent.setup();
  render(SearchBar);
  const input = screen.getByPlaceholderText('輸入商家或通路名稱...');
  await user.type(input, 'mo');
  // A suggestion for 'momo' should appear (testAliases has momo)
  const suggestions = screen.queryAllByRole('option');
  expect(suggestions.length).toBeGreaterThan(0);
  await user.keyboard('{ArrowDown}');
  // First suggestion should now be highlighted (aria-selected true)
  expect(suggestions[0]).toHaveAttribute('aria-selected', 'true');
  await user.keyboard('{Enter}');
  expect(searchStore.query).toBe('momo');
});

it('Escape closes suggestions without clearing query', async () => {
  const user = userEvent.setup();
  render(SearchBar);
  const input = screen.getByPlaceholderText('輸入商家或通路名稱...');
  await user.type(input, 'mo');
  expect(screen.queryAllByRole('option').length).toBeGreaterThan(0);
  await user.keyboard('{Escape}');
  expect(screen.queryAllByRole('option')).toHaveLength(0);
  expect(searchStore.query).toBe('mo');
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm test tests/components/SearchBar.test.ts
```

Expected: 3 new tests FAIL. The first 3 existing tests PASS.

**Step 3: Commit the failing tests**

```bash
git add tests/components/SearchBar.test.ts
git commit -m "test(SearchBar): add failing tests for external sync, keyboard nav, and Escape"
```

---

### Task 2: Rewrite SearchBar.svelte

**Files:**
- Modify: `src/components/SearchBar.svelte`

**Context:** Three independent changes to make:

1. **IME fix** — `compositionend` handler wraps the store update in `queueMicrotask` to safely read the final input value on Safari iOS.
2. **Keyboard navigation** — `highlightedIndex` state + `handleKeydown` on the input. Only the suggestion list shows the highlight; the input's displayed text never changes.
3. **Visual** — `rounded-xl`, lighter border, `ring` on focus, `shadow-sm`, suggestion highlight in blue.

**Step 1: Replace SearchBar.svelte with the full rewrite**

```svelte
<script lang="ts">
	import { searchStore } from '$lib/stores/search.svelte';

	let inputEl: HTMLInputElement | undefined = $state();
	let showSuggestions = $state(false);
	let highlightedIndex = $state(-1);

	const suggestions = $derived(searchStore.suggestions);

	function handleInput(e: Event): void {
		if ((e as InputEvent).isComposing) return;
		searchStore.query = (e.target as HTMLInputElement).value;
		highlightedIndex = -1;
		showSuggestions = true;
	}

	function handleCompositionEnd(e: CompositionEvent): void {
		queueMicrotask(() => {
			searchStore.query = (e.target as HTMLInputElement).value;
			highlightedIndex = -1;
			showSuggestions = true;
		});
	}

	function handleKeydown(e: KeyboardEvent): void {
		if (!showSuggestions || suggestions.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightedIndex = highlightedIndex < suggestions.length - 1
				? highlightedIndex + 1
				: 0;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightedIndex = highlightedIndex > 0
				? highlightedIndex - 1
				: suggestions.length - 1;
		} else if (e.key === 'Enter' && highlightedIndex >= 0) {
			e.preventDefault();
			selectSuggestion(suggestions[highlightedIndex]);
		} else if (e.key === 'Escape') {
			showSuggestions = false;
			highlightedIndex = -1;
		}
	}

	function selectSuggestion(name: string): void {
		searchStore.query = name;
		showSuggestions = false;
		highlightedIndex = -1;
		inputEl?.focus();
	}

	function clear(): void {
		searchStore.query = '';
		showSuggestions = false;
		highlightedIndex = -1;
		inputEl?.focus();
	}

	function handleBlur(): void {
		setTimeout(() => {
			showSuggestions = false;
			highlightedIndex = -1;
		}, 150);
	}
</script>

<div class="relative w-full">
	<input
		bind:this={inputEl}
		type="text"
		role="combobox"
		aria-expanded={showSuggestions && suggestions.length > 0}
		aria-autocomplete="list"
		value={searchStore.query}
		oninput={handleInput}
		oncompositionend={handleCompositionEnd}
		onkeydown={handleKeydown}
		onfocus={() => (showSuggestions = true)}
		onblur={handleBlur}
		placeholder="輸入商家或通路名稱..."
		class="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 pr-10 text-base shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
	/>

	{#if searchStore.query}
		<button
			type="button"
			onclick={clear}
			class="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
			aria-label="清除搜尋"
		>
			&times;
		</button>
	{/if}

	{#if showSuggestions && suggestions.length > 0 && searchStore.query}
		<ul
			class="absolute top-full z-10 mt-2 w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg"
			role="listbox"
		>
			{#each suggestions as suggestion, i}
				<li role="option" aria-selected={i === highlightedIndex}>
					<button
						type="button"
						class="w-full px-4 py-3 text-left text-sm font-medium transition-colors {i === highlightedIndex
							? 'bg-blue-50 text-blue-700'
							: 'text-gray-700 hover:bg-gray-50'}"
						onmousedown={() => selectSuggestion(suggestion)}
					>
						{suggestion}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
```

**Step 2: Run SearchBar tests**

```bash
pnpm test tests/components/SearchBar.test.ts
```

Expected: All 6 tests PASS.

Note: The "external sync" test (`syncs input value when store query is set externally`) verifies that `value={searchStore.query}` causes Svelte to update the DOM input when the store changes — this works because `searchStore.query` is reactive `$state`, and Svelte 5 re-renders the input's `value` prop when it changes.

**Step 3: Run full test suite**

```bash
pnpm test
```

Expected: All tests PASS.

**Step 4: Commit**

```bash
git add src/components/SearchBar.svelte
git commit -m "feat(SearchBar): add keyboard nav, fix IME compositionend, update visual style"
```

---

### Task 3: Restructure +page.svelte — permanent header

**Files:**
- Modify: `src/routes/+page.svelte`

**Context:** The current file has two conditional branches, each containing a `<SearchBar>`. Replace with a single permanent `<header>` containing `<SearchBar>` + `<RegionFilter>`, and a `<main>` that switches between the empty-state chips and the results view.

The brand name "刷哪張" moves to the header left side. On small screens, it stacks above the search bar; on `sm+` screens they are inline.

There are no unit tests for page-level layout — correctness is validated by the E2E tests in Task 4.

**Step 1: Replace +page.svelte**

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { searchStore, initSearchEngine } from '$lib/stores/search.svelte';
	import { myCardsStore } from '$lib/stores/myCards.svelte';
	import SearchBar from '$components/SearchBar.svelte';
	import RegionFilter from '$components/RegionFilter.svelte';
	import MyCardsToggle from '$components/MyCardsToggle.svelte';
	import ResultSection from '$components/ResultSection.svelte';
	import type { CreditCard, SearchIndex } from '$lib/types';

	const popularSearches = ['好市多', 'momo', '蝦皮', '全家', '全聯', '星巴克'];

	let initialized = $state(false);

	onMount(async () => {
		const [cardsModule, indexModule] = await Promise.all([
			import('$lib/data/cards.json'),
			import('$lib/data/search-index.json')
		]);
		const cards = cardsModule.default as unknown as CreditCard[];
		const searchIndex = indexModule.default as unknown as SearchIndex;
		initSearchEngine(cards, searchIndex.aliases, searchIndex.storeRestrictions);
		initialized = true;
	});

	const hasQuery = $derived(searchStore.query.trim().length > 0);

	$effect(() => {
		searchStore.myCardIds = myCardsStore.isFilterActive
			? myCardsStore.selectedCardIds
			: undefined;
	});

	function searchFor(term: string): void {
		searchStore.query = term;
	}

	const results = $derived(searchStore.results);

	const restrictionHint = $derived.by(() => {
		const r = results.restriction;
		if (!r) return undefined;
		if (r.networks?.length) {
			const names = r.networks.map((n) =>
				n === 'mastercard' ? 'Mastercard'
				: n === 'visa' ? 'Visa'
				: n === 'jcb' ? 'JCB'
				: n === 'amex' ? 'AMEX'
				: n
			);
			return `此通路僅接受 ${names.join(' / ')}`;
		}
		return undefined;
	});
</script>

<!-- Permanent header: SearchBar never unmounts -->
<header class="sticky top-0 z-20 border-b border-gray-100 bg-white">
	<div class="mx-auto max-w-2xl px-4 py-3">
		<div class="flex items-center gap-3">
			<span class="shrink-0 text-lg font-bold tracking-tight text-gray-950">刷哪張</span>
			<div class="min-w-0 flex-1">
				<SearchBar />
			</div>
		</div>
		<div class="mt-2">
			<RegionFilter />
		</div>
	</div>
</header>

<!-- Content area: switches state without touching SearchBar -->
<main class="mx-auto max-w-2xl px-4">
	{#if !initialized}
		<div class="flex h-48 items-center justify-center">
			<p class="text-gray-400">載入中...</p>
		</div>
	{:else if !hasQuery}
		<div class="pt-8">
			<p class="mb-3 text-sm text-gray-400">熱門搜尋</p>
			<div class="flex flex-wrap gap-2">
				{#each popularSearches as term}
					<button
						type="button"
						onclick={() => searchFor(term)}
						class="rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
					>
						{term}
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<div class="space-y-6 pb-8 pt-4">
			<MyCardsToggle />

			{#if results.specificMatches.length > 0}
				<ResultSection
					title="{results.matchedStores[0]} 指定回饋"
					count={results.specificMatches.length}
					hint={restrictionHint}
					results={results.specificMatches}
				/>
			{/if}

			{#if results.generalMatches.length > 0}
				<ResultSection
					title="其他卡片・一般回饋"
					count={results.generalMatches.length}
					results={results.generalMatches}
				/>
			{/if}

			{#if results.specificMatches.length === 0 && results.generalMatches.length === 0}
				<div class="py-12 text-center">
					<p class="text-gray-500">找不到「{searchStore.query}」的相關結果</p>
					{#if myCardsStore.isFilterActive}
						<button
							type="button"
							onclick={() => (myCardsStore.isFilterActive = false)}
							class="mt-2 text-sm text-blue-600 hover:underline"
						>
							顯示所有卡片的結果
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</main>
```

**Step 2: Type-check**

```bash
pnpm check
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(page): move SearchBar to permanent header, eliminate dual-mount layout"
```

---

### Task 4: Full verification

**Files:** none (read-only verification)

**Step 1: Build data + full test suite**

```bash
pnpm build-data && pnpm check && pnpm test
```

Expected: All unit and component tests PASS.

**Step 2: Build production bundle**

```bash
pnpm build
```

Expected: Build succeeds with no errors or warnings.

**Step 3: Run E2E tests**

```bash
pnpm test:e2e
```

Expected: All Playwright tests PASS. Confirm manually that:
- Typing the first character does NOT cause focus loss
- Typing with Zhuyin input method completes normally before search fires
- Clicking a popular search chip fills the input
- ArrowDown/ArrowUp navigate the suggestion list
- Escape closes suggestions
- Clear button removes query and shows empty state chips

**Step 4: Commit verification result (if any fixes were needed)**

If any fixes were required during verification, commit them individually with `fix:` prefix before this step.

```bash
# Only if everything was already clean:
git log --oneline -5
```
