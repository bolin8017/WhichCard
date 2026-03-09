<script lang="ts">
	import { searchStore } from '$lib/stores/search.svelte';
	import type { Region } from '$lib/types';

	const regions: { value: Region; label: string }[] = [
		{ value: 'domestic', label: '國內' },
		{ value: 'international', label: '國外' },
		{ value: 'japan', label: '日本' }
	];
</script>

<div class="flex gap-2" role="radiogroup" aria-label="地區篩選">
	{#each regions as { value, label }}
		<button
			type="button"
			role="radio"
			aria-checked={searchStore.region === value}
			onclick={() => (searchStore.region = value)}
			class="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors
				{searchStore.region === value
				? 'bg-blue-600 text-white'
				: 'border border-gray-300 text-gray-600 hover:border-gray-400'}"
		>
			{label}
		</button>
	{/each}
</div>
