// Trip Builder — shared by tours.html, index.html, tour.html and trip.html.
//
// Agencies add tours to "My trip" (kept in their own browser), arrange them
// by day on trip.html, see the route on the map of Japan, download a PDF
// itinerary under their own brand and send ONE request for the whole trip.
//
// Needs: regions-map.js (map outlines, regionOfTour, tourCode).
// Tour positions on the route map come from the place list below
// (PLACES): add a place there to place tours there more precisely.

const AEX_TRIP_KEY = 'aex_trip_v1';
const AEX_SLOTS = ['morning', 'afternoon', 'evening'];
const AEX_SLOT_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

// ---- Saved trip (this browser only) ----
function loadTrip() {
  let t = null;
  try { t = JSON.parse(localStorage.getItem(AEX_TRIP_KEY) || 'null'); } catch (e) { t = null; }
  if (!t || !Array.isArray(t.items)) t = { items: [] };
  return t;
}
function saveTrip(t) {
  try { localStorage.setItem(AEX_TRIP_KEY, JSON.stringify(t)); } catch (e) {}
  updateTripBadge();
}
function tripHas(id) { return loadTrip().items.some(x => x.id === Number(id)); }

// Default part of the day from the tour's format.
function defaultSlot(tour) {
  if (tour && tour.tour_format === 'evening') return 'evening';
  const text = String((tour && (tour.title + ' ' + (tour.category || '') + ' ' + (tour.tag || ''))) || '').toLowerCase();
  if (/night|evening|bar|after dark/.test(text)) return 'evening';
  return 'morning';
}

// Adds a tour (or removes it if already in the trip). New tours go to the
// last day, or to a new day when that part of the day is already taken.
function toggleTrip(id, tour) {
  id = Number(id);
  const t = loadTrip();
  const i = t.items.findIndex(x => x.id === id);
  if (i >= 0) {
    t.items.splice(i, 1);
  } else {
    // Same part of the day already taken, or a different region than the
    // last day -> start a new day (Tokyo tours stay together, Kyoto gets its own day).
    const slot = defaultSlot(tour);
    const lastDay = t.items.reduce((m, x) => Math.max(m, x.day), 0) || 1;
    const lastItems = t.items.filter(x => x.day === lastDay);
    const taken = lastItems.some(x => x.slot === slot);
    const known = window._tripTours || {};
    const reg = tour ? regionOfTour(tour) : '';
    const otherRegion = reg && lastItems.some(x => known[x.id] && regionOfTour(known[x.id]) && regionOfTour(known[x.id]) !== reg);
    t.items.push({ id, day: (taken || otherRegion) ? lastDay + 1 : lastDay, slot });
  }
  saveTrip(t);
  refreshTripButtons();
  return i < 0;
}

// "+ Add to trip" button HTML for a tour card or tour page.
function tripButtonHtml(tour, extraClass) {
  const on = tripHas(tour.id);
  return `<button type="button" class="trip-add${on ? ' is-on' : ''}${extraClass ? ' ' + extraClass : ''}" data-trip-id="${tour.id}"
    onclick="event.stopPropagation(); event.preventDefault(); tripButtonClick(this)">${on ? '✓ In your trip' : '+ Add to trip'}</button>`;
}
window._tripTours = window._tripTours || {};
function rememberTours(list) { (list || []).forEach(t => { window._tripTours[t.id] = t; }); }
function tripButtonClick(btn) {
  const id = Number(btn.dataset.tripId);
  toggleTrip(id, window._tripTours[id]);
}
function refreshTripButtons() {
  document.querySelectorAll('.trip-add[data-trip-id]').forEach(b => {
    const on = tripHas(b.dataset.tripId);
    b.classList.toggle('is-on', on);
    b.textContent = on ? '✓ In your trip' : '+ Add to trip';
  });
}

// Floating "My trip" button, shown on every page that loads this file
// (except the Trip Builder itself) once the trip has at least one tour.
function updateTripBadge() {
  if (document.body && document.body.dataset.page === 'trip') return;
  let a = document.getElementById('tripBadge');
  const n = loadTrip().items.length;
  if (!a) {
    if (!document.body) return;
    a = document.createElement('a');
    a.id = 'tripBadge';
    a.href = 'trip.html';
    a.className = 'trip-badge';
    document.body.appendChild(a);
  }
  a.innerHTML = `<span>My trip</span><b>${n}</b>`;
  a.style.display = n ? 'flex' : 'none';
}
document.addEventListener('DOMContentLoaded', updateTripBadge);
window.addEventListener('storage', e => { if (e.key === AEX_TRIP_KEY) { updateTripBadge(); refreshTripButtons(); } });

// ---- Places for the route map (latitude, longitude) ----
const AEX_PLACES = {
  // Tokyo
  'shinjuku': [35.690, 139.700], 'shibuya': [35.658, 139.702], 'asakusa': [35.714, 139.797], 'ginza': [35.672, 139.765],
  'akihabara': [35.698, 139.773], 'ueno': [35.711, 139.776], 'roppongi': [35.663, 139.731], 'harajuku': [35.670, 139.703],
  'ikebukuro': [35.729, 139.711], 'tsukiji': [35.665, 139.771], 'toyosu': [35.646, 139.785], 'odaiba': [35.627, 139.776],
  'yanaka': [35.726, 139.767], 'kappabashi': [35.714, 139.788], 'tokyo': [35.681, 139.767],
  '新宿': [35.690, 139.700], '渋谷': [35.658, 139.702], '浅草': [35.714, 139.797], '銀座': [35.672, 139.765], '上野': [35.711, 139.776], '東京': [35.681, 139.767],
  // Kanto
  'yokohama': [35.444, 139.638], 'kamakura': [35.319, 139.547], 'enoshima': [35.300, 139.480], 'fujisawa': [35.339, 139.490],
  'hakone': [35.232, 139.107], 'kawagoe': [35.925, 139.486], 'chichibu': [35.992, 139.085], 'nikko': [36.750, 139.598],
  'kusatsu': [36.620, 138.596], 'chiba': [35.607, 140.106], 'narita': [35.776, 140.318],
  '横浜': [35.444, 139.638], '鎌倉': [35.319, 139.547], '箱根': [35.232, 139.107], '日光': [36.750, 139.598],
  // Chubu
  'kawaguchiko': [35.517, 138.752], 'mt fuji': [35.361, 138.727], 'mount fuji': [35.361, 138.727], 'fujiyoshida': [35.487, 138.808],
  'matsumoto': [36.238, 137.972], 'nagano': [36.648, 138.194], 'hakuba': [36.698, 137.862], 'jigokudani': [36.733, 138.462],
  'takayama': [36.146, 137.252], 'shirakawa': [36.257, 136.906], 'kanazawa': [36.561, 136.656], 'toyama': [36.696, 137.214],
  'nagoya': [35.181, 136.906], 'seki': [35.496, 136.918], 'shimoda': [34.680, 138.945], 'izu': [34.97, 138.95],
  'niigata': [37.916, 139.036], 'sado': [38.02, 138.37], 'gujo': [35.75, 136.96], 'noto': [37.30, 136.90],
  '富士山': [35.361, 138.727], '河口湖': [35.517, 138.752], '高山': [36.146, 137.252], '金沢': [36.561, 136.656], '名古屋': [35.181, 136.906],
  // Kansai
  'kyoto': [35.012, 135.768], 'arashiyama': [35.009, 135.667], 'gion': [35.004, 135.775], 'uji': [34.884, 135.800],
  'osaka': [34.694, 135.502], 'nara': [34.685, 135.805], 'kobe': [34.690, 135.196], 'himeji': [34.839, 134.694],
  'arima': [34.797, 135.248], 'koyasan': [34.213, 135.586], 'koya': [34.213, 135.586], 'kumano': [33.84, 135.77],
  'ise': [34.455, 136.725], 'sakai': [34.573, 135.483], 'biwa': [35.25, 136.08],
  '京都': [35.012, 135.768], '大阪': [34.694, 135.502], '奈良': [34.685, 135.805], '神戸': [34.690, 135.196], '高野山': [34.213, 135.586],
  // Chugoku
  'hiroshima': [34.385, 132.455], 'miyajima': [34.296, 132.320], 'onomichi': [34.409, 133.205], 'okayama': [34.655, 133.919],
  'kurashiki': [34.585, 133.772], 'izumo': [35.367, 132.755], 'matsue': [35.468, 133.048], 'tottori': [35.501, 134.235], 'hagi': [34.408, 131.399],
  '広島': [34.385, 132.455], '宮島': [34.296, 132.320],
  // Shikoku
  'takamatsu': [34.343, 134.047], 'naoshima': [34.459, 133.995], 'matsuyama': [33.839, 132.765], 'dogo': [33.852, 132.786],
  'iya': [33.87, 133.83], 'kochi': [33.559, 133.531], 'tokushima': [34.070, 134.554],
  // Kyushu
  'fukuoka': [33.590, 130.402], 'hakata': [33.590, 130.420], 'nagasaki': [32.750, 129.878], 'kumamoto': [32.803, 130.708],
  'aso': [32.884, 131.104], 'beppu': [33.284, 131.491], 'yufuin': [33.266, 131.369], 'takachiho': [32.712, 131.308],
  'kagoshima': [31.597, 130.557], 'sakurajima': [31.585, 130.657], 'yakushima': [30.35, 130.53], 'arita': [33.19, 129.88],
  '福岡': [33.590, 130.402], '長崎': [32.750, 129.878], '別府': [33.284, 131.491],
  // Okinawa
  'naha': [26.212, 127.679], 'okinawa': [26.33, 127.80], 'ishigaki': [24.34, 124.16], 'miyakojima': [24.80, 125.28], 'iriomote': [24.33, 123.81],
  '那覇': [26.212, 127.679], '沖縄': [26.33, 127.80],
  // Hokkaido
  'sapporo': [43.062, 141.354], 'otaru': [43.19, 140.99], 'niseko': [42.80, 140.69], 'furano': [43.34, 142.38],
  'biei': [43.59, 142.47], 'hakodate': [41.769, 140.729], 'shiretoko': [44.07, 145.0], '札幌': [43.062, 141.354],
  // Tohoku
  'sendai': [38.268, 140.869], 'aomori': [40.82, 140.74], 'hirosaki': [40.60, 140.46], 'ginzan': [38.57, 140.53],
  'aizu': [37.49, 139.93], 'kakunodate': [39.59, 140.56], 'matsushima': [38.37, 141.06], '仙台': [38.268, 140.869]
};

// Same projection as the map outlines (see regions-map.js).
function projectLatLon(lat, lon, isOkinawa) {
  if (isOkinawa) {
    lon = 125.7 + (lon - 125.7) * 1.4 + 6.96;
    lat = 25.6 + (lat - 25.6) * 1.4 + 14.81;
  }
  return [(lon - 128.3) * Math.cos(36 * Math.PI / 180) * 34, (45.7 - lat) * 34];
}

// Map position of a tour: the most specific known place in its meeting
// point / location / title; otherwise the middle of its region.
function tourPoint(t) {
  const norm = v => String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const region = regionOfTour(t);
  for (const field of [t.meeting_point, t.location, t.title, t.destination]) {
    const text = norm(field);
    if (!text) continue;
    let best = null;
    for (const name of Object.keys(AEX_PLACES)) {
      if (placeMatches(text, name) && (!best || name.length > best.length)) best = name;
    }
    if (best) {
      const [lat, lon] = AEX_PLACES[best];
      return { xy: projectLatLon(lat, lon, region === 'okinawa'), place: best, region };
    }
  }
  const p = AEX_REGION_LABELS[region];
  return p ? { xy: [p[0], p[1]], place: '', region } : null;
}

// Draws the route: regions of the trip highlighted, numbered stops in day
// order joined by a line. The view zooms to the stops (a Tokyo-only trip
// shows Kanto close up; a Tokyo–Kyoto–Hiroshima trip shows half of Japan).
function renderRouteMap(stops) {
  const regions = new Set(stops.map(s => s.region).filter(Boolean));
  const shapes = AEX_REGIONS.map(r =>
    `<path class="rt-region${regions.has(r.key) ? ' is-on' : ''}" d="${(AEX_REGION_PATHS[r.key] || []).join('')}"></path>`).join('');


  let pts = stops.map(s => s.xy);
  let vb = [0, 0, 490, 535];
  if (pts.length) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    let w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    let cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    w = Math.max(w * 1.5, 70); h = Math.max(h * 1.5, 70);
    const ratio = 490 / 535;
    if (w / h > ratio) h = w / ratio; else w = h * ratio;
    if (w > 490) { w = 490; h = 535; cx = 245; cy = 267.5; }
    vb = [cx - w / 2, cy - h / 2, w, h];
  }
  const k = vb[2] / 490;               // marker size follows the zoom
  // Stops that would overlap (e.g. Shinjuku and Asakusa on a full map) are
  // nudged apart so every number stays readable.
  const R = 11 * k, placed = [];
  pts = pts.map(p => {
    let q = p.slice(), turn = 0;
    while (placed.some(o => Math.hypot(o[0] - q[0], o[1] - q[1]) < R * 1.9) && turn < 24) {
      turn++;
      const a = turn * 0.9, d = R * 1.9 * (1 + Math.floor(turn / 7) * 0.6);
      q = [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d];
    }
    placed.push(q);
    return q;
  });
  const line = pts.length > 1 ? `<polyline class="rt-line" points="${pts.map(p => p.join(',')).join(' ')}" style="stroke-width:${2.2 * k}px; stroke-dasharray:${6 * k} ${4 * k}"></polyline>` : '';
  const marks = pts.map((p, i) => `<g class="rt-stop" transform="translate(${p[0]} ${p[1]})"><circle r="${R}" style="stroke-width:${2 * k}px"></circle><text y="${4.2 * k}" style="font-size:${12 * k}px">${i + 1}</text></g>`).join('');
  return `<svg class="rt-svg" viewBox="${vb.map(v => v.toFixed(1)).join(' ')}" role="img" aria-label="Route map">
      <g style="stroke-width:${k}px">${shapes}</g>${line}${marks}</svg>`;
}
