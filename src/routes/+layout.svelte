<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="mx-auto min-h-screen max-w-[480px] font-sans">
	<nav class="flex items-center justify-end px-4 py-2">
		<a href="/my-cards" class="text-sm text-gray-500 hover:text-gray-700">
			我的卡片
		</a>
	</nav>

	<main>
		{@render children()}
	</main>
</div>
