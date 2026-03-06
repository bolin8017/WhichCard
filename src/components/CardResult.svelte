<script lang="ts">
	import type { SearchResult } from '$lib/engine/search';

	let { result }: { result: SearchResult } = $props();

	let showTiers = $state(false);
	let showNote = $state(false);

	const networkLabels: Record<string, string> = {
		visa: 'Visa',
		mastercard: 'MC',
		jcb: 'JCB',
		amex: 'AMEX'
	};

	function formatRate(rate: number): string {
		return rate % 1 === 0 ? rate.toString() : rate.toFixed(1);
	}

	const hasTiers = $derived(
		(result.matchedRule.tiers && result.matchedRule.tiers.length > 0) ||
			(result.baseRule?.tiers && result.baseRule.tiers.length > 0)
	);

	const hasNote = $derived(
		!!result.card.note || !!result.matchedRule.note || !!result.baseRule?.note
	);
</script>

<div
	class="rounded-lg border border-gray-200 bg-white p-4
		{result.isSpecificMatch ? 'border-l-3 border-l-blue-500' : ''}"
>
	<!-- Row 1: Bank + Card Name + Network -->
	<div class="flex items-center justify-between">
		<div class="text-sm text-gray-600">
			{result.card.bank}
			<span class="font-medium text-gray-900">{result.card.name}</span>
		</div>
		<div class="flex gap-1">
			{#each result.card.network as net}
				<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
					{networkLabels[net] ?? net}
				</span>
			{/each}
		</div>
	</div>

	<!-- Row 2: Max Reward Rate -->
	<div class="mt-2 flex items-baseline gap-1.5">
		<span class="text-3xl font-bold text-blue-600">{formatRate(result.maxReward)}%</span>
		<span class="text-sm text-gray-500">{result.card.rewardType}</span>
	</div>

	<!-- Row 3: Reward Breakdown -->
	<div class="mt-1 text-sm text-gray-600">
		{#if result.isSpecificMatch && result.baseRule}
			基本 {formatRate(result.baseRule.rate)}%
			{#if result.baseRule.storeLabel}({result.baseRule.storeLabel}){/if}
			+ 通路加碼 {formatRate(result.matchedRule.rate)}%
		{:else}
			基本 {formatRate(result.matchedRule.rate)}%
			{#if result.matchedRule.storeLabel}({result.matchedRule.storeLabel}){/if}
		{/if}
	</div>

	<!-- Row 4: Expandable Tiers -->
	{#if hasTiers}
		<button
			type="button"
			class="mt-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
			onclick={() => (showTiers = !showTiers)}
		>
			<span class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-xs">
				i
			</span>
			加碼條件
			<span class="text-xs">{showTiers ? '▲' : '▼'}</span>
		</button>

		{#if showTiers}
			<div class="mt-1.5 space-y-1.5 rounded bg-gray-50 p-2.5 text-sm">
				{#each result.matchedRule.tiers ?? [] as tier}
					<div>
						<span class="font-medium">{tier.label} +{formatRate(tier.bonus)}%</span>
						{#if tier.limit > 0}
							<span class="text-gray-500">
								(上限 {tier.limit.toLocaleString()}{tier.limitUnit}/月)
							</span>
						{/if}
						<div class="text-xs text-gray-500">{tier.condition}</div>
					</div>
				{/each}
				{#each result.baseRule?.tiers ?? [] as tier}
					<div>
						<span class="font-medium">{tier.label} +{formatRate(tier.bonus)}%</span>
						{#if tier.limit > 0}
							<span class="text-gray-500">
								(上限 {tier.limit.toLocaleString()}{tier.limitUnit}/月)
							</span>
						{/if}
						<div class="text-xs text-gray-500">{tier.condition}</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- Row 5: Notes -->
	{#if hasNote}
		<button
			type="button"
			class="mt-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
			onclick={() => (showNote = !showNote)}
		>
			<span class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-xs">
				i
			</span>
			注意事項
		</button>

		{#if showNote}
			<div class="mt-1 rounded bg-amber-50 p-2 text-sm text-amber-800">
				{#if result.card.note}<div>{result.card.note}</div>{/if}
				{#if result.matchedRule.note}<div>{result.matchedRule.note}</div>{/if}
				{#if result.baseRule?.note}<div>{result.baseRule.note}</div>{/if}
			</div>
		{/if}
	{/if}
</div>
