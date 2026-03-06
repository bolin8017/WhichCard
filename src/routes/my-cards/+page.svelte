<script lang="ts">
	import { onMount } from 'svelte';
	import { myCardsStore } from '$lib/stores/myCards.svelte';
	import type { CreditCard } from '$lib/types';

	let cards: CreditCard[] = $state([]);
	let filterText = $state('');
	let initialized = $state(false);

	onMount(async () => {
		const cardsModule = await import('$lib/data/cards.json');
		cards = cardsModule.default as unknown as CreditCard[];
		initialized = true;
	});

	const cardsByBank = $derived.by(() => {
		const lower = filterText.toLowerCase();
		const filtered = lower
			? cards.filter(
					(c) =>
						c.name.toLowerCase().includes(lower) ||
						c.bank.toLowerCase().includes(lower) ||
						c.id.toLowerCase().includes(lower)
				)
			: cards;

		const grouped = new Map<string, CreditCard[]>();
		for (const card of filtered) {
			const list = grouped.get(card.bank) ?? [];
			list.push(card);
			grouped.set(card.bank, list);
		}
		return grouped;
	});
</script>

<div class="px-4 pb-20 pt-4">
	<div class="mb-4 flex items-center gap-3">
		<a href="/" class="text-sm text-blue-600 hover:underline">&larr; 返回搜尋</a>
		<h1 class="text-lg font-bold text-gray-900">我的卡片</h1>
	</div>

	{#if !initialized}
		<p class="py-12 text-center text-gray-400">載入中...</p>
	{:else if cards.length === 0}
		<p class="py-12 text-center text-gray-500">尚無卡片資料</p>
	{:else}
		<input
			type="text"
			bind:value={filterText}
			placeholder="搜尋卡片名稱或銀行..."
			class="mb-4 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-blue-500"
		/>

		{#if myCardsStore.count === 0 && !filterText}
			<div class="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
				選擇你持有的信用卡，搜尋時可快速篩選只看自己的卡片回饋。
			</div>
		{/if}

		<div class="space-y-5">
			{#each [...cardsByBank.entries()] as [bank, bankCards]}
				<div>
					<h2 class="mb-2 text-sm font-medium text-gray-500">{bank}</h2>
					<div class="space-y-1">
						{#each bankCards as card}
							<label
								class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50"
							>
								<input
									type="checkbox"
									checked={myCardsStore.isSelected(card.id)}
									onchange={() => myCardsStore.toggle(card.id)}
									class="h-4 w-4 rounded border-gray-300 accent-blue-600"
								/>
								<div>
									<div class="text-sm font-medium text-gray-900">{card.name}</div>
									<div class="text-xs text-gray-400">
										{card.network.map((n) => n.toUpperCase()).join(' / ')}
										・{card.rewardType}
									</div>
								</div>
							</label>
						{/each}
					</div>
				</div>
			{/each}

			{#if cardsByBank.size === 0 && filterText}
				<p class="py-8 text-center text-sm text-gray-500">
					找不到符合「{filterText}」的卡片
				</p>
			{/if}
		</div>
	{/if}
</div>

<!-- Sticky footer -->
<div class="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white px-4 py-3">
	<div class="mx-auto max-w-[480px] text-center text-sm font-medium text-gray-700">
		已選 {myCardsStore.count} 張卡片
	</div>
</div>
