import { supabase } from '../../../lib/supabase';
import { anthropic, MODEL } from '../../../lib/anthropic';
import { isCronRequest } from '../../../lib/auth';

const SCORING_PROMPT = `You are assessing a small business website to determine how much it would benefit from a revamp.
You will be given raw HTML. Look for signals such as:
- Missing viewport meta tag / non-responsive markup (poor mobile support)
- Outdated copyright year in footer
- Table-based layouts, inline styles, or very old markup patterns
- Broken or placeholder content ("Lorem ipsum", "Coming soon", dead links)
- No SSL indicators, no modern framework fingerprints
- Generic/template look with no customization
- Presence (or absence) of contact forms, booking widgets, live chat

Respond ONLY with valid JSON in this exact shape, no preamble, no markdown fences:
{
  "digital_activity_score": <int 0-100, lower = more outdated/inactive, higher = modern and active>,
  "mobile_friendly": <true|false|null if unknown>,
  "last_updated_guess": "<string or null, e.g. a copyright year found>",
  "key_issues": ["<short issue>", "<short issue>", "..."],
  "lead_temp": "<hot|warm|cold>"
}

Guidance for lead_temp: hot = score < 40 (clearly outdated, strong pitch angle), warm = 40-70, cold = 70+ (already solid, low priority).`;

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadgenBot/1.0)' },
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 15000);
  } catch {
    return null;
  }
}

async function scoreWithClaude(html, businessName) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: `${SCORING_PROMPT}\n\nBusiness name: ${businessName}\n\nHTML:\n${html}` }],
  });
  const text = msg.content.find(b => b.type === 'text')?.text || '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

export default async function handler(req, res) {
  const fromVercelCron = isCronRequest(req);
  const fromDashboard = req.headers['x-dashboard-trigger'] === '1';
  if (!fromVercelCron && !fromDashboard) return res.status(401).end();

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, business_name, website')
    .eq('has_website', true)
    .eq('lead_temp', 'unscored');

  if (error) return res.status(500).json({ error: error.message });

  const results = [];
  for (const lead of leads) {
    const html = await fetchHtml(lead.website);
    if (!html) {
      await supabase.from('leads').update({ lead_temp: 'cold', notes: 'site unreachable' }).eq('id', lead.id);
      results.push({ lead: lead.business_name, status: 'unreachable' });
      continue;
    }
    try {
      const result = await scoreWithClaude(html, lead.business_name);
      await supabase
        .from('leads')
        .update({
          digital_activity_score: result.digital_activity_score,
          site_is_mobile_friendly: result.mobile_friendly,
          site_last_updated_guess: result.last_updated_guess,
          lead_temp: result.lead_temp,
          notes: (result.key_issues || []).join('; '),
        })
        .eq('id', lead.id);
      results.push({ lead: lead.business_name, score: result.digital_activity_score, temp: result.lead_temp });
    } catch (err) {
      results.push({ lead: lead.business_name, error: err.message });
    }
    await new Promise(r => setTimeout(r, 300));
  }

  res.status(200).json({ ok: true, scored: results.length, results });
}
