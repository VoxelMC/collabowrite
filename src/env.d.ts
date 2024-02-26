/// <reference types="astro/client" />

interface ImportMetaEnv {
    readonly PUBLIC_SUPABASE_URL: string;
    readonly PUBLIC_SUPABASE_ANON: string;
    // readonly SUPABASE_PASSWORD: string;
    readonly PARTYKIT_URL: string;
    readonly VER: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface Window {
    supabase: import('@supabase/supabase-js').SupabaseClient;
}
