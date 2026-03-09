/**
 * One-time migration script: converts old WhichCard JSON data to new YAML format.
 *
 * Reads:
 *   - ../WhichCard/src/data/cards.json
 *   - ../WhichCard/src/data/aliases.json
 *
 * Writes:
 *   - data/cards/{id}.yaml (one per card)
 *   - data/aliases.yaml (merged with existing)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';

const OLD_PROJECT = path.resolve(import.meta.dirname, '../../WhichCard');
const NEW_DATA = path.resolve(import.meta.dirname, '../data');

// Known network mappings for old cards (old data lacks the `network` field)
const NETWORK_MAP: Record<string, string[]> = {
	'sinopac-dawho': ['visa', 'mastercard'],
	'sinopac-dual-currency': ['visa', 'mastercard']
};

interface OldRewardTier {
	label: string;
	bonus: number;
	limit: number;
	limitUnit: string;
	condition: string;
	tags?: string[];
}

interface OldRewardRule {
	stores: string[];
	storeLabel?: string;
	region: string;
	rate: number;
	limit: number;
	limitUnit: string;
	excludes?: string[];
	validFrom?: string;
	validUntil?: string;
	note?: string;
	tiers?: OldRewardTier[];
}

interface OldCard {
	id: string;
	name: string;
	bank: string;
	rewardType: string;
	sourceUrl: string;
	updatedAt: string;
	note?: string;
	rewards: OldRewardRule[];
}

function migrateCards(): void {
	const cardsPath = path.join(OLD_PROJECT, 'src/data/cards.json');
	const raw = fs.readFileSync(cardsPath, 'utf-8');
	const cards: OldCard[] = JSON.parse(raw);

	const outDir = path.join(NEW_DATA, 'cards');
	fs.mkdirSync(outDir, { recursive: true });

	for (const card of cards) {
		const network = NETWORK_MAP[card.id];
		if (!network) {
			console.warn(`WARN: no network mapping for ${card.id}, using empty array`);
		}

		const yamlObj: Record<string, unknown> = {
			id: card.id,
			name: card.name,
			bank: card.bank,
			network: network ?? [],
			rewardType: card.rewardType,
			sourceUrl: card.sourceUrl,
			updatedAt: card.updatedAt
		};

		if (card.note) {
			yamlObj.note = card.note;
		}

		yamlObj.rewards = card.rewards.map((r) => {
			const rule: Record<string, unknown> = {
				stores: r.stores,
				...(r.storeLabel && { storeLabel: r.storeLabel }),
				region: r.region,
				rate: r.rate,
				limit: r.limit,
				limitUnit: r.limitUnit
			};

			if (r.excludes?.length) rule.excludes = r.excludes;
			if (r.validFrom) rule.validFrom = r.validFrom;
			if (r.validUntil) rule.validUntil = r.validUntil;
			if (r.note) rule.note = r.note;

			if (r.tiers?.length) {
				rule.tiers = r.tiers.map((t) => {
					const tier: Record<string, unknown> = {
						label: t.label,
						bonus: t.bonus,
						limit: t.limit,
						limitUnit: t.limitUnit,
						condition: t.condition
					};
					if (t.tags?.length) tier.tags = t.tags;
					return tier;
				});
			}

			return rule;
		});

		const yamlStr = yaml.dump(yamlObj, {
			lineWidth: -1,
			quotingType: '"',
			forceQuotes: false,
			noRefs: true,
			sortKeys: false
		});

		const outPath = path.join(outDir, `${card.id}.yaml`);
		fs.writeFileSync(outPath, yamlStr, 'utf-8');
		console.log(`  wrote ${outPath}`);
	}

	console.log(`Migrated ${cards.length} cards`);
}

function migrateAliases(): void {
	const aliasesPath = path.join(OLD_PROJECT, 'src/data/aliases.json');
	const raw = fs.readFileSync(aliasesPath, 'utf-8');
	const oldAliases: Record<string, string[]> = JSON.parse(raw);

	// Read existing aliases from new project to merge
	const existingPath = path.join(NEW_DATA, 'aliases.yaml');
	let existing: Record<string, string[]> = {};
	if (fs.existsSync(existingPath)) {
		existing = yaml.load(fs.readFileSync(existingPath, 'utf-8')) as Record<string, string[]>;
	}

	// Merge: old aliases override existing entries for same key
	const merged: Record<string, string[]> = { ...existing };
	for (const [key, aliases] of Object.entries(oldAliases)) {
		// Only add entries that have aliases (skip empty arrays)
		if (aliases.length > 0 || !(key in merged)) {
			merged[key] = aliases;
		}
	}

	const yamlStr = yaml.dump(merged, {
		lineWidth: -1,
		quotingType: '"',
		forceQuotes: false,
		noRefs: true,
		sortKeys: false
	});

	fs.writeFileSync(existingPath, yamlStr, 'utf-8');
	console.log(`  wrote ${existingPath}`);
	console.log(`Migrated ${Object.keys(merged).length} alias entries`);
}

console.log('=== Migrating cards ===');
migrateCards();
console.log('\n=== Migrating aliases ===');
migrateAliases();
console.log('\nDone! Run `pnpm build-data` to validate.');
