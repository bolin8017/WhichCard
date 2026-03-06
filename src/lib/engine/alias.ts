import type { Aliases } from '$lib/types';
import type { PrefixIndex } from './index';

export type AliasConfidence = 'exact' | 'prefix' | 'substring';

export interface AliasMatch {
	canonical: string;
	confidence: AliasConfidence;
	matchedVia: string;
}

export function resolveAlias(
	query: string,
	aliases: Aliases,
	prefixIndex: PrefixIndex
): AliasMatch[] {
	const lower = query.toLowerCase();

	// Tier 1: Exact match (canonical name or alias)
	const exactMatches = findExact(lower, aliases);
	if (exactMatches.length > 0) return exactMatches;

	// Tier 2: Prefix match
	const prefixMatches = prefixIndex.get(lower);
	if (prefixMatches && prefixMatches.length > 0) {
		return prefixMatches.map((canonical) => ({
			canonical,
			confidence: 'prefix' as const,
			matchedVia: query
		}));
	}

	// Tier 3: Substring match
	return findSubstring(lower, aliases);
}

function findExact(lower: string, aliases: Aliases): AliasMatch[] {
	for (const [canonical, aliasList] of Object.entries(aliases)) {
		if (canonical.toLowerCase() === lower) {
			return [{ canonical, confidence: 'exact', matchedVia: canonical }];
		}
		for (const alias of aliasList) {
			if (alias.toLowerCase() === lower) {
				return [{ canonical, confidence: 'exact', matchedVia: alias.toLowerCase() }];
			}
		}
	}
	return [];
}

function findSubstring(lower: string, aliases: Aliases): AliasMatch[] {
	const results: AliasMatch[] = [];
	const seen = new Set<string>();

	for (const [canonical, aliasList] of Object.entries(aliases)) {
		if (seen.has(canonical)) continue;

		const allNames = [canonical, ...aliasList];
		for (const name of allNames) {
			if (name.toLowerCase().includes(lower)) {
				results.push({ canonical, confidence: 'substring', matchedVia: name });
				seen.add(canonical);
				break;
			}
		}
	}

	return results;
}
