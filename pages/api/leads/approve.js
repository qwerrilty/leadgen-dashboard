import { supabase } from '../../../lib/supabase';
import { isAuthed } from '../../../lib/auth';

export default async function handler(req, res) {
  if (!isAuthed(req)) return res.status(401).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { id, action, pitch_subject, pitch_draft } = req.body || {};
  if (!id || !action) return res.status(400).json({ error: 'id and action required' });

  const update = {};
  if (action === 'approve') update.outreach_status = 'approved';
  else if (action === 'reject') update.outreach_status = 'rejected';
  else if (action === 'edit_approve') {
    update.outreach_status = 'approved';
    if (pitch_subject) update.pitch_subject = pitch_subject;
    if (pitch_draft) update.pitch_draft = pitch_draft;
  } else {
    return res.status(400).json({ error: 'unknown action' });
  }

  const { error } = await supabase.from('leads').update(update).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ ok: true });
}
