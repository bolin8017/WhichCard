/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		include: ['tests/**/*.test.ts'],
		exclude: ['tests/e2e/**'],
		environment: 'jsdom',
		setupFiles: ['tests/setup.ts'],
		server: {
			deps: {
				inline: [/svelte/]
			}
		}
	},
	resolve: {
		conditions: ['browser']
	}
});
