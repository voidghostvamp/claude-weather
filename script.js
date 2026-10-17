/* SkyNote — data from Open-Meteo (no API key). */
const API = {
  geo: q => `https://geocoding-api.open-meteo.com/v1/search?count=5&name=${encodeURIComponent(q)}`,
  wx: (la, lo) => `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&timezone=auto&forecast_days=7`
    + `&current=temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m,weather_code,is_day`
    + `&hourly=temperature_2m,weather_code,precipitation_probability,visibility,uv_index,is_day`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max`,
  aq: (la, lo) => `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${la}&longitude=${lo}&current=us_aqi`
};
const cache = new Map();
async function getJSON(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < 6e5) return hit.d;
  let r;
  try { r = await fetch(url); } catch { throw new Error('Network error. Check your connection and try again.'); }
  if (r.status === 429) throw new Error('Rate limit reached. Wait a minute and try again.');
  if (!r.ok) throw new Error(`Weather service error (${r.status}).`);
  const d = await r.json();
  cache.set(url, { t: Date.now(), d });
  return d;
}

const $ = s => document.querySelector(s);
const store = JSON.parse(localStorage.getItem('skynote') || '{}');
const S = { unit: store.unit || 'c', motion: store.motion !== false, favs: store.favs || [], loc: store.last || null, extended: false, data: null, aqi: null };
const save = () => localStorage.setItem('skynote', JSON.stringify({ unit: S.unit, motion: S.motion, favs: S.favs, last: S.loc }));

/* ---- weather codes ---- */
const kindOf = c => c === 0 ? 'clear' : c <= 2 ? 'partly' : c === 3 ? 'cloud' : c <= 48 ? 'fog' : c <= 67 || (c >= 80 && c <= 82) ? 'rain' : c <= 77 || c === 85 || c === 86 ? 'snow' : 'storm';
const LABEL = { 0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail' };
const CLOUD = '<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.600-1A4.500 4.500 0 0 1 17 18z" fill="#cfe0f5"/>';
function icon(code, day = 1) {
  const k = kindOf(code);
  const sun = day ? '<circle cx="9" cy="9" r="4.500" fill="#ffd27a"/>' : '<path d="M12 4a6 6 0 1 0 6 8 5 5 0 0 1-6-8z" fill="#e8eefc"/>';
  const g = { clear: sun, partly: sun + CLOUD, cloud: CLOUD, fog: '<path d="M4 9h16M6 13h14M4 17h12" stroke="#cfe0f5" stroke-width="2" stroke-linecap="round"/>',
    rain: CLOUD + '<path d="M9 20l1-2M13 20l1-2M17 20l1-2" stroke="#7fb2ff" stroke-width="1.600" stroke-linecap="round"/>',
    snow: CLOUD + '<g fill="#fff"><circle cx="9" cy="20" r="1.100"/><circle cx="13" cy="21" r="1.100"/><circle cx="17" cy="20" r="1.100"/></g>',
    storm: CLOUD + '<path d="M13 15l-3 5h3l-1 3 4-6h-3z" fill="#ffd27a"/>' }[k];
  return `<svg viewBox="0 0 24 24" role="img" aria-label="${k}">${g}</svg>`;
}

/* ---- units ---- */
const F = S2 => S2 * 9 / 5 + 32;
const T = c => c == null ? '--' : Math.round(S.unit === 'f' ? F(c) : c) + '°';
const wind = k => S.unit === 'f' ? `${Math.round(k * .6214)} mph` : `${Math.round(k)} km/h`;
const dist = m => m == null ? 'n/a' : S.unit === 'f' ? `${(m / 1609.34).toFixed(1)} mi` : `${(m / 1000).toFixed(1)} km`;
const compass = d => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];
const uvText = u => u == null ? 'n/a' : `${u.toFixed(1)} (${u < 3 ? 'Low' : u < 6 ? 'Moderate' : u < 8 ? 'High' : 'Very high'})`;
const aqiText = a => a == null ? null : `${a} (${a <= 50 ? 'Good' : a <= 100 ? 'Moderate' : a <= 150 ? 'Unhealthy for some' : 'Unhealthy'})`;
function moon() {
  const d = ((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % 29.530588;
  const p = d < 0 ? d + 29.53 : d;
  return ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'][Math.round(p / 29.530588 * 8) % 8];
}

/* ---- scene + cat ---- */
const mins = s => +s.slice(11, 13) * 60 + +s.slice(14, 16);
function sceneFor(d) {
  const c = d.current, k = kindOf(c.weather_code), now = mins(c.time);
  const sr = mins(d.daily.sunrise[0]), ss = mins(d.daily.sunset[0]);
  if (Math.abs(now - sr) < 40) return 'dawn';
  if (Math.abs(now - ss) < 40) return 'dusk';
  if (k === 'storm' || k === 'rain' || k === 'snow' || k === 'fog') return k;
  if (!c.is_day) return 'night';
  return k === 'clear' || k === 'partly' ? 'clear' : 'cloud';
}
const SAY = { clear: 'Found a warm sunny spot.', cloud: 'Watching the clouds go by.', rain: 'Cozy by the window today.', storm: 'Staying in until it passes.', snow: 'Curled up and warm.', fog: 'Quiet, misty morning.', night: 'Zzz… goodnight.', dawn: 'Sunrise stretch.', dusk: 'Golden hour nap.' };
function cat(sc, windy) {
  const sleep = ['night', 'snow', 'dusk'].includes(sc), rain = sc === 'rain' || sc === 'storm';
  const eyes = sleep ? '<path d="M38 41q4 3 8 0M54 41q4 3 8 0" stroke="#1b2438" stroke-width="2" fill="none" stroke-linecap="round"/>' : '<circle cx="42" cy="41" r="3" fill="#1b2438"/><circle cx="58" cy="41" r="3" fill="#1b2438"/>';
  return `<svg viewBox="0 0 120 90" role="img" aria-label="A small cat">
  ${sc === 'clear' ? '<ellipse cx="60" cy="82" rx="55" ry="7" fill="#ffd27a" opacity=".35"/>' : ''}
  <path d="M92 74q22-4 14-30" stroke="#6c7a99" stroke-width="8" fill="none" stroke-linecap="round" style="transform-origin:92px 74px;${windy ? 'animation:wag 2s ease-in-out infinite alternate' : ''}"/>
  <ellipse cx="60" cy="68" rx="34" ry="18" fill="#7f8ead"/>
  <path d="M34 30l4-16 12 8zM86 30l-4-16-12 8z" fill="#7f8ead"/>
  <circle cx="60" cy="42" r="24" fill="#8b9abb"/>${eyes}
  <path d="M57 49h6l-3 3z" fill="#e9a3b0"/>
  ${rain ? '<path d="M30 38q30-34 60 0z" fill="#f2c14e"/>' : ''}</svg>
  <style>@keyframes wag{to{transform:rotate(14deg)}}</style>`;
}
function fx(sc) {
  const el = $('.fx'); el.innerHTML = '';
  if (!S.motion) return;
  const n = sc === 'rain' || sc === 'storm' ? 70 : sc === 'snow' ? 50 : sc === 'night' ? 60 : 0;
  const cls = sc === 'night' ? 'star' : sc === 'snow' ? 'snow' : 'rain';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span'); s.className = cls;
    s.style.left = Math.random() * 100 + 'vw';
    if (cls === 'star') s.style.setProperty('--y', Math.random() * 60 + 'vh');
    else s.style.animationDuration = (cls === 'rain' ? .6 + Math.random() * .6 : 6 + Math.random() * 6) + 's';
    s.style.animationDelay = -Math.random() * 6 + 's';
    el.append(s);
  }
}

/* ---- render ---- */
function render() {
  const d = S.data; if (!d) return;
  const c = d.current, dl = d.daily, H = d.hourly;
  const sc = sceneFor(d);
  $('#scene').className = sc; fx(sc);
  $('#place').textContent = S.loc.name;
  $('#time').textContent = new Date(c.time + 'Z').toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric', timeZone: 'UTC' });
  $('#temp').textContent = T(c.temperature_2m);
  $('#ico').innerHTML = icon(c.weather_code, c.is_day);
  $('#cond').textContent = LABEL[c.weather_code] || '';
  $('#range').textContent = `High ${T(dl.temperature_2m_max[0])} · Low ${T(dl.temperature_2m_min[0])} · Feels like ${T(c.apparent_temperature)} · Sunrise ${dl.sunrise[0].slice(11)} · Sunset ${dl.sunset[0].slice(11)}`;
  $('#bubble').textContent = SAY[sc];
  $('#cat').innerHTML = cat(sc, c.wind_speed_10m > 25);
  const i = Math.max(0, H.time.findIndex(t => t >= c.time.slice(0, 13)));
  const vis = H.visibility[i], uv = H.uv_index[i];
  const cards = [['Humidity', c.relative_humidity_2m + '%'], ['Wind', `${wind(c.wind_speed_10m)} ${compass(c.wind_direction_10m)}`], ['Visibility', dist(vis)], ['Pressure', Math.round(c.pressure_msl) + ' hPa'], ['UV index', uvText(uv)], ['Feels like', T(c.apparent_temperature)], ['Rain chance', (H.precipitation_probability[i] ?? 'n/a') + (H.precipitation_probability[i] != null ? '%' : '')], ['Moon', moon()]];
  if (S.aqi != null) cards.push(['Air quality (US AQI)', aqiText(S.aqi)]);
  $('#details').innerHTML = cards.map(([l, v]) => `<div class="card"><span class="muted">${l}</span><b>${v}</b></div>`).join('');
  const hrs = S.extended ? 48 : 24;
  $('#hourly').innerHTML = H.time.slice(i, i + hrs).map((t, j) => `<div class="hr"><span>${j ? t.slice(11) : 'Now'}</span>${icon(H.weather_code[i + j], H.is_day[i + j])}<b>${T(H.temperature_2m[i + j])}</b><span class="muted">${H.precipitation_probability[i + j] ?? '–'}%</span></div>`).join('');
  $('#more').textContent = S.extended ? 'Show fewer hours' : 'Show 24 more hours';
  $('#daily').innerHTML = dl.time.map((t, j) => `<div class="day card${j ? '' : ' today'}"><span>${j ? new Date(t + 'T00:00Z').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'Today'}</span>${icon(dl.weather_code[j])}<span class="muted">${LABEL[dl.weather_code[j]] || ''} · ${dl.precipitation_probability_max[j] ?? '–'}% rain</span><b>${T(dl.temperature_2m_max[j])} / ${T(dl.temperature_2m_min[j])}</b></div>`).join('');
  $('#unit').textContent = S.unit === 'c' ? '°C' : '°F';
  const isFav = S.favs.some(f => f.lat === S.loc.lat && f.lon === S.loc.lon);
  $('#fav').textContent = isFav ? 'Remove from saved' : 'Save location';
  $('#saved').innerHTML = S.favs.map((f, k) => `<span><button data-go="${k}">${f.name}</button><button data-rm="${k}" aria-label="Remove ${f.name}">×</button></span>`).join('');
}
function showError(m) { const e = $('#error'); e.textContent = m || ''; e.hidden = !m; }

async function loadWeather(loc) {
  S.loc = loc; save(); showError(); document.body.classList.add('loading');
  try {
    const [d, a] = await Promise.all([getJSON(API.wx(loc.lat, loc.lon)), getJSON(API.aq(loc.lat, loc.lon)).catch(() => null)]);
    S.data = d; S.aqi = a?.current?.us_aqi ?? null; render();
  } catch (e) { showError(e.message + (S.data ? ' Showing the last loaded data.' : '')); }
  document.body.classList.remove('loading');
}

/* ---- events ---- */
$('#search').addEventListener('submit', async e => {
  e.preventDefault(); const q = $('#q').value.trim(); if (!q) return;
  const ul = $('#results'); showError();
  try {
    const r = (await getJSON(API.geo(q))).results;
    if (!r?.length) { ul.hidden = true; return showError(`No place found for “${q}”. Check the spelling or try a nearby city.`); }
    ul.innerHTML = r.map((p, i) => `<li><button type="button" data-i="${i}">${p.name}${p.admin1 ? ', ' + p.admin1 : ''}, ${p.country || ''}</button></li>`).join('');
    ul.hidden = false;
    ul.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; const p = r[b.dataset.i]; ul.hidden = true; $('#q').value = ''; loadWeather({ name: `${p.name}, ${p.country_code || p.country}`, lat: p.latitude, lon: p.longitude }); };
  } catch (err) { showError(err.message); }
});
document.addEventListener('click', e => { if (!e.target.closest('#search')) $('#results').hidden = true; });
$('#geo').onclick = () => {
  if (!navigator.geolocation) return showError('Your browser does not support geolocation.');
  navigator.geolocation.getCurrentPosition(p => loadWeather({ name: 'My location', lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) }), () => showError('Location permission was denied. Search for a city instead.'));
};
const setUnit = u => { S.unit = u; save(); $('#temp').style.opacity = 0; render(); requestAnimationFrame(() => $('#temp').style.opacity = 1); $('#sUnit').value = u; };
$('#unit').onclick = () => setUnit(S.unit === 'c' ? 'f' : 'c');
$('#sUnit').onchange = e => setUnit(e.target.value);
const applyMotion = () => { document.body.classList.toggle('still', !S.motion); $('#sMotion').checked = S.motion; };
$('#sMotion').onchange = e => { S.motion = e.target.checked; save(); applyMotion(); if (S.data) fx(sceneFor(S.data)); };
$('#openSettings').onclick = () => $('#settings').showModal();
$('#more').onclick = () => { S.extended = !S.extended; render(); };
$('#fav').onclick = () => {
  const k = S.favs.findIndex(f => f.lat === S.loc.lat && f.lon === S.loc.lon);
  k >= 0 ? S.favs.splice(k, 1) : S.favs.push(S.loc); save(); render();
};
$('#saved').onclick = e => {
  const g = e.target.dataset.go, r = e.target.dataset.rm;
  if (g != null) loadWeather(S.favs[g]);
  if (r != null) { S.favs.splice(r, 1); save(); render(); }
};

$('#sUnit').value = S.unit; applyMotion();
loadWeather(S.loc || { name: 'London, GB', lat: 51.507, lon: -0.128 });
