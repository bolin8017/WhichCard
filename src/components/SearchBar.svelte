<script lang="ts">
	import { searchStore } from '$lib/stores/search.svelte';

	let inputEl: HTMLInputElement | undefined = $state();
	let showSuggestions = $state(false);

	function handleInput(e: Event): void {
		searchStore.query = (e.target as HTMLInputElement).value;
		showSuggestions = true;
	}

	function selectSuggestion(name: string): void {
		searchStore.query = name;
		showSuggestions = false;
		inputEl?.focus();
	}

	function clear(): void {
		searchStore.query = '';
		showSuggestions = false;
		inputEl?.focus();
	}

	function handleBlur(): void {
		// Delay to allow suggestion click to register
		setTimeout(() => {
			showSuggestions = false;
		}, 150);
	}
</script>

<div class="relative w-full">
	<input
		bind:this={inputEl}
		type="text"
		value={searchStore.query}
		oninput={handleInput}
		onfocus={() => (showSuggestions = true)}
		onblur={handleBlur}
		placeholder="輸入商家或通路名稱..."
		class="h-12 w-full rounded-lg border border-gray-300 px-4 pr-10 text-base outline-none transition-colors focus:border-blue-500"
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

	{#if showSuggestions && searchStore.suggestions.length > 0 && searchStore.query}
		<ul
			class="absolute top-full z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-md"
			role="listbox"
		>
			{#each searchStore.suggestions as suggestion}
				<li role="option" aria-selected="false">
					<button
						type="button"
						class="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50"
						onmousedown={() => selectSuggestion(suggestion)}
					>
						{suggestion}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
