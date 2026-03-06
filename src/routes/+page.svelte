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

	// Sync myCards filter with search store
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
			const names = r.networks.map((n) => n === 'mastercard' ? 'Mastercard' : n === 'visa' ? 'Visa' : n === 'jcb' ? 'JCB' : n === 'amex' ? 'AMEX' : n);
			return `此通路僅接受 ${names.join(' / ')}`;
		}
		return undefined;
	});
</script>

{#if !initialized}
	<div class="flex h-64 items-center justify-center">
		<p class="text-gray-400">載入中...</p>
	</div>
{:else if !hasQuery}
	<!-- Initial state: centered -->
	<div class="flex min-h-[60vh] flex-col items-center justify-center px-4">
		<h1 class="mb-1 text-3xl font-bold text-gray-900">刷哪張</h1>
		<p class="mb-6 text-sm text-gray-500">找出最適合的信用卡</p>

		<div class="w-full max-w-md">
			<SearchBar />
			<div class="mt-4 flex justify-center">
				<RegionFilter />
			</div>
		</div>

		<div class="mt-8 flex flex-wrap justify-center gap-2">
			{#each popularSearches as term}
				<button
					type="button"
					onclick={() => searchFor(term)}
					class="rounded-full border border-gray-200 px-3.5 py-1.5 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
				>
					{term}
				</button>
			{/each}
		</div>
	</div>
{:else}
	<!-- Search state: results -->
	<div class="px-4">
		<div class="sticky top-0 z-20 bg-white pb-3 pt-4">
			<SearchBar />
			<div class="mt-3">
				<RegionFilter />
			</div>
			<div class="mt-2">
				<MyCardsToggle />
			</div>
		</div>

		<div class="space-y-6 pb-8">
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
	</div>
{/if}
