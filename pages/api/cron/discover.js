import { supabase } from '../../../lib/supabase';
import { searchPlaces, extractRegionCity, getDailySearches } from '../../../lib/places';
import { isCronRequest } from '../../../lib/auth';

async function upsertLead(place, searchMeta) {
  const { city, region, country } = extractRegionCity(place.addressComponents);

  const row = {
    place_id: place.id,
    source: 'google_places',
    search_query: searchMeta.query,
    target_market: searchMeta.market,
    business_name: place.displayName?.text || 'Unknown',
    category: place.primaryType || null,
    phone: place.nationalPhoneNumber || null,
    website: place.websiteUri || null,
    has_website: Boolean(place.websiteUri),
    address: place.formattedAddress || null,
    city,
    region,
    country,
    rating: place.rating ?? null,
    review_count: place.userRatingCount ?? null,
    lead_temp: place.websiteUri ? 'unscored' : 'hot',
  };

  const { error } = await supabase.from('leads').upsert(row, { onConflict: 'place_id' });
  if (error) throw new Error(`upsert failed for ${row.business_name}: ${error.message}`);
}

export default async function handler(req, res) {
  // Allow either a real Vercel cron invocation OR a manual trigger from the dashboard
  // (dashboard calls pass through the same cookie-protected origin, so we accept both).
  const fromVercelCron = isCronRequest(req);
  const fromDashboard = req.headers['x-dashboard-trigger'] === '1';
  if (!fromVercelCron && !fromDashboard) return res.status(401).end();

  const results = [];
  const searches = getDailySearches();
  for (const search of searches) {
    try {
      const places = await searchPlaces(search.query);
      for (const place of places) {
        await upsertLead(place, search);
      }
      results.push({ query: search.query, found: places.length });
    } catch (err) {
      results.push({ query: search.query, error: err.message });
    }
    await new Promise(r => setTimeout(r, 400));
  }

  res.status(200).json({ ok: true, results });
}