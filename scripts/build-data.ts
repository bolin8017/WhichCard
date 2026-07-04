import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { creditCardSchema, storeEntrySchema, aliasesSchema, categoriesSchema } from '../src/lib/schema';
import type { CreditCard, StoreEntry, Aliases, Categories, StoreRestriction, SearchIndex } from '../src/lib/types';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUTPUT_DIR = path.join(ROOT, 'src', 'lib', 'data');

const validateOnly = process.argv.includes('--validate-only');

let fatalErrors = 0;
let warnings = 0;

function fatal(msg: string): void {
	console.error(`FATAL: ${msg}`);
	fatalErrors++;
}

function warn(msg: string): void {
	console.warn(`WARN: ${msg}`);
	warnings++;
}

// --- Step 1: Parse and validate cards ---

function loadCards(): CreditCard[] {
	const cardsDir = path.join(DATA_DIR, 'cards');
	if (!fs.existsSync(cardsDir)) {
		fatal('data/cards/ directory not found');
		return [];
	}

	const files = fs.readdirSync(cardsDir).filter((f) => f.endsWith('.yaml'));
	const cards: CreditCard[] = [];

	for (const file of files) {
		const filePath = path.join(cardsDir, file);
		const raw = yaml.load(fs.readFileSync(filePath, 'utf-8'));
		const result = creditCardSchema.safeParse(raw);

		if (!result.success) {
			fatal(`${file}: schema validation failed\n  ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ')}`);
			continue;
		}

		cards.push(result.data as CreditCard);
	}

	return cards;
}

// --- Step 2: Parse and validate stores ---

function loadStores(): StoreEntry[] {
	const storesDir = path.join(DATA_DIR, 'stores');
	if (!fs.existsSync(storesDir)) return [];

	const files = fs.readdirSync(storesDir).filter((f) => f.endsWith('.yaml'));
	const stores: StoreEntry[] = [];

	for (const file of files) {
		const filePath = path.join(storesDir, file);
		const raw = yaml.load(fs.readFileSync(filePath, 'utf-8'));
		const result = storeEntrySchema.safeParse(raw);

		if (!result.success) {
			fatal(`stores/${file}: schema validation failed\n  ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ')}`);
			continue;
		}

		stores.push(result.data as StoreEntry);
	}

	return stores;
}

// --- Step 3: Parse and validate aliases ---

function loadAliases(): Aliases {
	const aliasPath = path.join(DATA_DIR, 'aliases.yaml');
	if (!fs.existsSync(aliasPath)) {
		fatal('data/aliases.yaml not found');
		return {};
	}

	const raw = yaml.load(fs.readFileSync(aliasPath, 'utf-8'));
	const result = aliasesSchema.safeParse(raw);

	if (!result.success) {
		fatal(`aliases.yaml: schema validation failed\n  ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ')}`);
		return {};
	}

	return result.data as Aliases;
}

// --- Step 3.5: Parse and validate categories ---

function loadCategories(): Categories {
	const categoriesPath = path.join(DATA_DIR, 'categories.yaml');
	if (!fs.existsSync(categoriesPath)) return {};

	const raw = yaml.load(fs.readFileSync(categoriesPath, 'utf-8'));
	const result = categoriesSchema.safeParse(raw);

	if (!result.success) {
		fatal(`categories.yaml: schema validation failed\n  ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ')}`);
		return {};
	}

	return result.data as Categories;
}

// --- Step 4: Cross-reference validation ---

function crossValidate(
	cards: CreditCard[],
	stores: StoreEntry[],
	aliases: Aliases,
	categories: Categories
): void {
	// Check unique IDs
	const ids = new Set<string>();
	for (const card of cards) {
		if (ids.has(card.id)) {
			fatal(`duplicate card id: ${card.id}`);
		}
		ids.add(card.id);
	}

	// Build restrictions map
	const restrictionMap = new Map<string, StoreRestriction>();
	for (const store of stores) {
		restrictionMap.set(store.name, store.restrictions);
	}

	const DAY_MS = 86_400_000;
	const todayStr = new Date().toISOString().slice(0, 10);
	const soonStr = new Date(Date.now() + 30 * DAY_MS).toISOString().slice(0, 10);
	const staleStr = new Date(Date.now() - 180 * DAY_MS).toISOString().slice(0, 10);

	const aliasKeys = new Set(Object.keys(aliases));
	const resolvable = new Set([...aliasKeys, ...Object.keys(categories)]);

	// Category members must be searchable canonical stores
	for (const [category, members] of Object.entries(categories)) {
		for (const member of members) {
			if (!aliasKeys.has(member)) {
				fatal(`categories.yaml: "${category}" member "${member}" not found in aliases.yaml`);
			}
		}
	}

	for (const card of cards) {
		for (const rule of card.rewards) {
			// Check store names exist in aliases or categories (skip wildcard)
			for (const store of rule.stores) {
				if (store !== '*' && !resolvable.has(store)) {
					fatal(`${card.id}: store "${store}" not found in aliases.yaml or categories.yaml`);
				}
			}

			// Check excludes exist in aliases or categories
			if (rule.excludes) {
				for (const exc of rule.excludes) {
					if (!resolvable.has(exc)) {
						fatal(`${card.id}: excludes "${exc}" not found in aliases.yaml or categories.yaml`);
					}
				}
			}

			// Network compatibility with store restrictions
			for (const store of rule.stores) {
				if (store === '*') continue;
				const restriction = restrictionMap.get(store);
				if (!restriction?.networks?.length) continue;

				const compatible = card.network.some((n) => restriction.networks!.includes(n));
				if (!compatible) {
					fatal(
						`${card.id}: claims reward at "${store}" but card networks [${card.network.join(',')}] incompatible with store restriction [${restriction.networks.join(',')}]`
					);
				}
			}

			// Freshness: expired rules must be deleted (policy); expiring soon needs a refresh
			if (rule.validUntil && rule.validUntil < todayStr) {
				warn(`${card.id}: rule for [${rule.stores.join(',')}] expired on ${rule.validUntil} — delete it (policy) or run /refresh-cards`);
			} else if (rule.validUntil && rule.validUntil <= soonStr) {
				warn(`${card.id}: rule for [${rule.stores.join(',')}] expires soon (${rule.validUntil})`);
			}
		}

		if (card.updatedAt < staleStr) {
			warn(`${card.id}: updatedAt ${card.updatedAt} older than 180 days — verify against ${card.sourceUrl}`);
		}
	}

	// Warn on orphaned aliases
	const referencedStores = new Set<string>();
	for (const card of cards) {
		for (const rule of card.rewards) {
			for (const store of rule.stores) {
				if (store !== '*') referencedStores.add(store);
			}
			if (rule.excludes) {
				for (const exc of rule.excludes) {
					referencedStores.add(exc);
				}
			}
		}
	}
	// Members of categories referenced by any card count as referenced
	for (const [category, members] of Object.entries(categories)) {
		if (referencedStores.has(category)) {
			for (const member of members) referencedStores.add(member);
		}
	}
	for (const aliasKey of aliasKeys) {
		if (!referencedStores.has(aliasKey)) {
			warn(`orphaned alias: "${aliasKey}" not referenced by any card`);
		}
	}
}

// --- Step 5: Build and output ---

function buildOutput(
	cards: CreditCard[],
	stores: StoreEntry[],
	aliases: Aliases,
	categories: Categories
): void {
	const storeRestrictions: Record<string, StoreRestriction> = {};
	for (const store of stores) {
		// Entry-level note is the user-facing reason for the restriction;
		// carry it into the index so the UI can display it
		storeRestrictions[store.name] = store.note
			? { ...store.restrictions, note: store.note }
			: store.restrictions;
	}

	const searchIndex: SearchIndex = { aliases, storeRestrictions, categories };

	if (!fs.existsSync(OUTPUT_DIR)) {
		fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	}

	fs.writeFileSync(path.join(OUTPUT_DIR, 'cards.json'), JSON.stringify(cards, null, 2));
	fs.writeFileSync(path.join(OUTPUT_DIR, 'search-index.json'), JSON.stringify(searchIndex, null, 2));

	console.log(`Built: ${cards.length} cards, ${stores.length} store restrictions, ${Object.keys(aliases).length} aliases, ${Object.keys(categories).length} categories`);
}

// --- Main ---

const cards = loadCards();
const stores = loadStores();
const aliases = loadAliases();
const categories = loadCategories();

crossValidate(cards, stores, aliases, categories);

if (fatalErrors > 0) {
	console.error(`\nBuild failed: ${fatalErrors} fatal error(s), ${warnings} warning(s)`);
	process.exit(1);
}

if (warnings > 0) {
	console.warn(`\n${warnings} warning(s)`);
}

if (validateOnly) {
	console.log('Validation passed.');
} else {
	buildOutput(cards, stores, aliases, categories);
}
