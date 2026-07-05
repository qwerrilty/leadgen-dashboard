import { supabase } from '../../../lib/supabase';
import { anthropic, MODEL } from '../../../lib/anthropic';
import { isCronRequest } from '../../../lib/auth';

const PITCH_SYSTEM = `You write short, non-salesy cold outreach emails from a freelance web developer
to small business owners. Tone: friendly, specific, low-pressure, no hype/buzzwords, no exclamation
point overload. Reference the ACTUAL issue found on their site (or the fact they have no site).
Keep the body under 120 words. End with a soft call to action (a quick call or a "want me to send
a mockup?"), not a hard sell. Sign off as "Erril".

Respond ONLY with valid JSON, no markdown fences, no preamble, in this exact shape:
{"subject": "<short, specific, non-spammy subject line>", "body": "<email body text>"}`;

function buildContext(lead) {
  if (!lead.has_website) {
    return `Business: ${lead.business_name}, category: ${lead.category || 'local business'}, location: ${lead.city || ''} ${lead.region || ''}.
This business has NO website listed on Google. Pitch a simple, affordable website build.`;
  }
  return `Business: ${lead.business_name}, category: ${lead.category || 'local business'}, location: ${lead.city || ''} ${lead.region || ''}.
Their current site: ${lead.website}
Issues found: ${lead.notes || 'outdated design, unclear'}
Digital activity score: ${lead.digital_activity_score ?? 'unknown'}/100 (lower = more outdated).
Pitch a focused website/system revamp addressing these specific issues.`;
}

async function generatePitch(lead) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: PITCH_SYSTEM,
    messages: [{ role: 'user', content: buildContext(lead) }],
  });
  const text = msg.content.find(b => b.type === 'text')?.text?.trim() || '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

export default async function handler(req, res) {
  const fromVercelCron = isCronRequest(req);
  const fromDashboard = req.headers['x-dashboard-trigger'] === '1';
  if (!fromVercelCron && !fromDashboard) return res.status(401).end();

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .in('lead_temp', ['hot', 'warm'])
    .is('pitch_draft', null)
    .eq('unsubscribed', false);

  if (error) return res.status(500).json({ error: error.message });

  const results = [];
  for (const lead of leads) {
    try {
      const { subject, body } = await generatePitch(lead);
      await supabase
        .from('leads')
        .update({ pitch_subject: subject, pitch_draft: body, outreach_status: 'pending_approval' })
        .eq('id', lead.id);
      results.push({ lead: lead.business_name, status: 'drafted' });
    } catch (err) {
      results.push({ lead: lead.business_name, error: err.message });
    }
    await new Promise(r => setTimeout(r, 300));
  }

  res.status(200).json({ ok: true, drafted: results.length, results });
}
