/// <reference types="astro/client" />

// declare module 'markdown-it-incremental-dom';

interface ImportMetaEnv {
	readonly SUPABASE_URL: string;
	readonly SUPABASE_ANON: string;
	// readonly SUPABASE_PASSWORD: string;
	readonly PARTYKIT_URL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
