// Fitty — weather via Open-Meteo (free, no API key). Forecast is cached for offline use.
import { db } from './db.js';

export const DEFAULT_LOCATION = { name: 'Hillah, Babil, Iraq', lat: 32.4637, lon: 44.4199 };

// "Feels like" °C → fit weight. A day maps to the first rule whose `min` it reaches.
export const DEFAULT_MAPPING = [
  { min: 33, weight: 0 },
  { min: 27, weight: 1 },
  { min: 21, weight: 2 },
  { min: 15, weight: 3 },
  { min: 8, weight: 4 },
  { min: -999, weight: 5 },
];

export function weightForTemp(feels, mapping = DEFAULT_MAPPING) {
  const rules = [...mapping].sort((a, b) => b.min - a.min);
  for (const r of rules) if (feels >= r.min) return r.weight;
  return 5;
}

export async function searchCity(q, lang = 'en') {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${lang === 'ar' ? 'ar' : 'en'}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('City search failed');
  const j = await res.json();
  return (j.results || []).map(r => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude, lon: r.longitude,
  }));
}

const CODE_TEXT = {
  0: ['Clear', '☀️'], 1: ['Mostly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Fog', '🌫️'], 51: ['Drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Drizzle', '🌦️'],
  61: ['Rain', '🌧️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'], 66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
  71: ['Snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Snow', '🌨️'], 77: ['Snow', '🌨️'],
  80: ['Showers', '🌦️'], 81: ['Showers', '🌦️'], 82: ['Showers', '🌧️'], 85: ['Snow showers', '🌨️'], 86: ['Snow showers', '🌨️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm', '⛈️'], 99: ['Thunderstorm', '⛈️'],
};
export const describeCode = (c) => CODE_TEXT[c] || ['—', '🌡️'];

// Returns { days: { 'YYYY-MM-DD': {feels, max, min, feelsMax, feelsMin, code, rain} }, fetchedAt, offline }
export async function getForecast(loc) {
  const key = `forecast7:${loc.lat.toFixed(3)},${loc.lon.toFixed(3)}`;
  const cached = await db.getMeta(key, null);
  const fresh = cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000;
  if (fresh) return cached;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max` +
      `&timezone=auto&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather request failed');
    const j = await res.json();
    const d = j.daily;
    const days = {};
    d.time.forEach((t, i) => {
      const feelsMax = d.apparent_temperature_max[i], feelsMin = d.apparent_temperature_min[i];
      days[t] = {
        feels: Math.round(((feelsMax + feelsMin) / 2) * 10) / 10,
        feelsMax, feelsMin,
        max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
        code: d.weather_code[i],
        rain: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
      };
    });
    const out = { days, fetchedAt: Date.now() };
    await db.setMeta(key, out);
    return out;
  } catch (e) {
    if (cached) return { ...cached, offline: true };
    throw e;
  }
}
