<script lang="ts">
	import { myCardsStore } from '$lib/stores/myCards.svelte';

	function handleChange(e: Event): void {
		myCardsStore.isFilterActive = (e.target as HTMLInputElement).checked;
	}
</script>

<label class="flex items-center gap-2 text-sm text-gray-600">
	<input
		type="checkbox"
		checked={myCardsStore.isFilterActive}
		onchange={handleChange}
		class="h-4 w-4 rounded border-gray-300 accent-blue-600"
	/>
	只顯示我的卡片
	{#if myCardsStore.count > 0}
		<span class="text-xs text-gray-400">({myCardsStore.count} 張)</span>
	{/if}
</label>
