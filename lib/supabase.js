import { createClient } from '@supabase/supabase-js';

// Server-only client using the service role key.
// NEVER import this from client-side components — it bypasses RLS.
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
