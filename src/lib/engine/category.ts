import type { Categories } from '$lib/types';

export type CategoryIndex = Map<string, string[]>;

export function buildCategoryIndex(categories: Categories): CategoryIndex {
	const index: CategoryIndex = new Map();
	for (const [category, members] of Object.entries(categories)) {
		for (const member of members) {
			const existing = index.get(member) ?? [];
			if (!existing.includes(category)) {
				existing.push(category);
			}
			index.set(member, existing);
		}
	}
	return index;
}

export function expandStores(canonical: string, index: CategoryIndex): string[] {
	return [canonical, ...(index.get(canonical) ?? [])];
}
