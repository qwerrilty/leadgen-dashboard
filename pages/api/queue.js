import { supabase } from '../../lib/supabase';
import { isAuthed } from '../../lib/auth';

function buildFooter(lead) {
  return `

--
${process.env.FROM_NAME}
${process.env.PHYSICAL_ADDRESS}

Not interested? Unsubscribe: ${process.env.UNSUBSCRIBE_BASE_URL}?lead=${lead.id}`;
}

async function isSuppressed(email) {
  if (!email) return true;
  const { data } = await supabase.from('unsubscribes').select('id').eq('email', email).maybeSingle();
  return Boolean(data);
}

async function pushToSmartlead(lead, body) {
  const res = await fetch(
    `https://server.smartlead.ai/api/v1/campaigns/${process.env.SMARTLEAD_CAMPAIGN_ID}/leads?api_key=${process.env.SMARTLEAD_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_list: [
          {
            email: lead.email,
            first_name: lead.business_name,
            custom_fields: {
              pitch_subject: lead.pitch_subject,
              pitch_body: body,
              target_market: lead.target_market,
            },
          },
        ],
      }),
    }
  );
  if (!res.ok) throw new Error(`Smartlead error ${res.status}: ${await res.text()}`);
  return res.json();
}

export default async function handler(req, res) {
  if (!isAuthed(req)) return res.status(401).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('outreach_status', 'approved')
    .eq('unsubscribed', false);

  if (error) return res.status(500).json({ error: error.message });

  const results = [];
  for (const lead of leads) {
    if (!lead.email) {
      results.push({ lead: lead.business_name, status: 'skipped_no_email' });
      continue;
    }
    if (await isSuppressed(lead.email)) {
      await supabase.from('leads').update({ unsubscribed: true, outreach_status: 'unsubscribed' }).eq('id', lead.id);
      results.push({ lead: lead.business_name, status: 'skipped_suppressed' });
      continue;
    }

    const fullBody = lead.pitch_draft + buildFooter(lead);
    try {
      await pushToSmartlead(lead, fullBody);
      await supabase
        .from('leads')
        .update({ outreach_status: 'queued', outreach_sent_at: new Date().toISOString() })
        .eq('id', lead.id);
      await supabase.from('outreach_log').insert({
        lead_id: lead.id,
        subject: lead.pitch_subject || `Quick note about ${lead.business_name}'s website`,
        body: fullBody,
        status: 'sent',
      });
      results.push({ lead: lead.business_name, status: 'queued' });
    } catch (err) {
      results.push({ lead: lead.business_name, status: 'failed', error: err.message });
    }
    await new Promise(r => setTimeout(r, 300));
  }

  res.status(200).json({ ok: true, results });
}
