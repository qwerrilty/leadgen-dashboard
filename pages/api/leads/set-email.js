import { supabase } from '../../../lib/supabase';
import { isAuthed } from '../../../lib/auth';

export default async function handler(req, res) {
  if (!isAuthed(req)) return res.status(401).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { id, email } = req.body || {};
  if (!id || !email) return res.status(400).json({ error: 'id and email required' });

  const { error } = await supabase.from('leads').update({ email }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ ok: true });
}
