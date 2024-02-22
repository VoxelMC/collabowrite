import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabase = createClient(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_ANON);
export default supabase;
