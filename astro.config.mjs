import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

import qwikdev from '@qwikdev/astro';
import node from '@astrojs/node';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import vercel from '@astrojs/vercel/serverless';

// https://astro.build/config
export default defineConfig({
	integrations: [tailwind(), qwikdev()],
	output: 'server',
	adapter: vercel(),
	// adapter: node({ mode: 'standalone' }),
	vite: {
		plugins: [nodeResolve()],
	},
});
