import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
// import svelte from '@astrojs/svelte';
// import preact from '@astrojs/preact';

import qwikdev from '@qwikdev/astro';

import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), /* svelte(), preact(), */qwikdev()],
  output: "server",
  adapter: node({
    mode: "standalone"
  })
});