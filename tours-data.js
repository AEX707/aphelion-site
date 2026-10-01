// Shared tour data loader — fetches tours from the Supabase database.
// Used by index.html, tours.html, tour.html, booking.html.

const SUPABASE_URL = "https://agjmcokrlftutvnddohv.supabase.co";
const SUPABASE_KEY = "sb_publishable_vsbAvQlf9in0HDYZeP8asQ_znoG1onN";

let _toursCache = null;

// Public-facing: only tours that have been approved by an admin.
// This is what the storefront (index/tours/tour/booking pages) uses.
async function getTours() {
  if (_toursCache) return _toursCache;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tours?select=*&status=eq.approved&order=id.asc`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!res.ok) throw new Error('Supabase request failed: ' + res.status);
    const data = await res.json();
    // map group_size (database column name) back to "group" so existing
    // page code (t.group) keeps working unchanged
    _toursCache = data.map(t => ({ ...t, group: t.group_size }));
    return _toursCache;
  } catch (err) {
    console.error('Failed to load tours from database:', err);
    return [];
  }
}

// Admin-facing: every tour regardless of status (pending/approved/rejected),
// so the admin panel can review and moderate everything. Never cached.
// Pass the signed-in admin's access token; without it the database only
// returns approved tours (same as the public site).
async function getAllToursAdmin(accessToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tours?select=*&order=id.asc`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken || SUPABASE_KEY}`
      }
    });
    if (!res.ok) throw new Error('Supabase request failed: ' + res.status);
    const data = await res.json();
    return data.map(t => ({ ...t, group: t.group_size }));
  } catch (err) {
    console.error('Failed to load tours from database:', err);
    return [];
  }
}
