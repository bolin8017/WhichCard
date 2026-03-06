<script lang="ts">
	import type { SearchResult } from '$lib/engine/search';
	import CardResult from './CardResult.svelte';

	let {
		title,
		count,
		hint,
		results
	}: {
		title: string;
		count: number;
		hint?: string;
		results: SearchResult[];
	} = $props();
</script>

{#if results.length > 0}
	<section>
		<div class="mb-3 flex items-center gap-2">
			<h2 class="text-sm text-gray-500">{title} ({count})</h2>
			<div class="h-px flex-1 bg-gray-200"></div>
		</div>

		{#if hint}
			<p class="mb-3 text-xs text-gray-400">{hint}</p>
		{/if}

		<div class="space-y-3">
			{#each results as result (result.card.id)}
				<CardResult {result} />
			{/each}
		</div>
	</section>
{/if}
