import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

export function serverClient(astroCookies: AstroCookies) {
	return createServerClient(
		import.meta.env.PUBLIC_SUPABASE_URL,
		import.meta.env.PUBLIC_SUPABASE_ANON,
		{
			cookies: {
				get(key: string) {
					return astroCookies.get(key)?.value;
				},
				set(key: string, value: string, options: CookieOptions) {
					astroCookies.set(key, value, options);
				},
				remove(key: string, options) {
					astroCookies.delete(key, options);
				},
			},
		}
	);
}
