import { supabase } from '../../../lib/supabase';
import { isAuthed } from '../../../lib/auth';

export default async function handler(req, res) {
  if (!isAuthed(req)) return res.status(401).end();

  const status = req.query.status;
  let q = supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(200);
  if (status) q = q.eq('outreach_status', status);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ leads: data });
}
