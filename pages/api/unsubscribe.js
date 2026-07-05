import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { leadId } = req.body || {};
  if (!leadId) return res.status(400).json({ error: 'leadId required' });

  const { data: lead, error: fetchErr } = await supabase
    .from('leads')
    .select('id, email')
    .eq('id', leadId)
    .maybeSingle();

  if (fetchErr) return res.status(500).json({ error: fetchErr.message });
  if (!lead) return res.status(404).json({ error: 'not found' });

  await supabase
    .from('leads')
    .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString(), outreach_status: 'unsubscribed' })
    .eq('id', leadId);

  if (lead.email) {
    await supabase
      .from('unsubscribes')
      .upsert({ email: lead.email, reason: 'recipient opt-out' }, { onConflict: 'email' });
  }

  res.status(200).json({ ok: true });
}
