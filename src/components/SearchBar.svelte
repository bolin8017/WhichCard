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
