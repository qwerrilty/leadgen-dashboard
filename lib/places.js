// --- What to search -----------------------------------------------------
// Instead of a fixed list, we rotate through a broad spread of SMB
// categories x AU locations (mix of metro + regional). A fixed daily
// slice keeps each discover run well within Google's free monthly quota
// while still covering everything over a rolling cycle.
//
// To re-add US targeting later, just add locations to LOCATIONS with
// market: 'US' and country-appropriate city names.

export const CATEGORIES = [
  'plumbers', 'electricians', 'landscapers', 'builders',
  'dental clinics', 'physiotherapists', 'veterinary clinics',
  'cafes', 'restaurants', 'hair salons', 'gyms',
  'accountants', 'real estate agents',
  'auto repair shops', 'hardware stores',
];

export const LOCATIONS = [
  // Metro
  { city: 'Sydney', market: 'AU' },
  { city: 'Melbourne', market: 'AU' },
  { city: 'Brisbane', market: 'AU' },
  { city: 'Perth', market: 'AU' },
  { city: 'Adelaide', market: 'AU' },
  // Regional
  { city: 'Toowoomba', market: 'AU' },
  { city: 'Bendigo', market: 'AU' },
  { city: 'Ballarat', market: 'AU' },
  { city: 'Rockhampton', market: 'AU' },
  { city: 'Cairns', market: 'AU' },
  { city: 'Wagga Wagga', market: 'AU' },
  { city: 'Bunbury', market: 'AU' },
];

// How many (category, city) combos to search per discover run.
// 15 categories x 12 locations = 180 combos total. At 15/day that's a
// 12-day rotation, ~450 Pro-tier lookups/month — comfortably under the
// 5,000/month free allotment even with manual re-runs.
const DAILY_BATCH_SIZE = 15;

// Deterministic rotation based on day-of-year, so repeated runs on the
// same day return the same batch (idempotent-ish), and each new day
// advances to the next slice.
export function getDailySearches() {
  const allCombos = [];
  for (const category of CATEGORIES) {
    for (const loc of LOCATIONS) {
      allCombos.push({
        query: `${category} in ${loc.city}, Australia`,
        market: loc.market,
      });
    }
  }

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  const totalBatches = Math.ceil(allCombos.length / DAILY_BATCH_SIZE);
  const batchIndex = dayOfYear % totalBatches;
  const start = batchIndex * DAILY_BATCH_SIZE;

  return allCombos.slice(start, start + DAILY_BATCH_SIZE);
}

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

// Field mask kept minimal, but note: requesting phone/website pulls this
// into the "Pro" SKU tier (5,000 free events/month as of 2026), not the
// cheaper "Essentials" tier (10,000/month). Drop nationalPhoneNumber and
// websiteUri from the mask if you want to stay in the Essentials tier and
// do contact enrichment separately.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryType',
].join(',');

export async function searchPlaces(query) {
  const res = await fetch(PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query, pageSize: 20 }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Places API error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.places || [];
}

export function extractRegionCity(addressComponents = []) {
  const get = (type) => addressComponents.find(c => c.types?.includes(type))?.longText || null;
  return {
    city: get('locality') || get('postal_town') || null,
    region: get('administrative_area_level_1') || null,
    country: get('country') || null,
  };
}