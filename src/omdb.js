const fetch = require('node-fetch');
const config = require('./config');

// In-memory cache: key → { data, expiresAt }
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + config.CACHE_TTL_HOURS * 3600 * 1000,
  });
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (res.status === 429) {
    console.warn('[OMDB] Rate limited');
    return null;
  }
  if (!res.ok) return null;
  return res.json();
}

// Fetch all episodes for a series season
async function getSeasonEpisodes(seriesImdbId, season) {
  const cacheKey = `${seriesImdbId}:s${season}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  if (!config.OMDB_API_KEY) return null;

  const url = `https://www.omdbapi.com/?i=${seriesImdbId}&Season=${season}&apikey=${config.OMDB_API_KEY}`;
  const data = await fetchJson(url);

  if (!data || data.Response === 'False' || !data.Episodes) return null;

  // Build map: episode number → rating
  const ratings = {};
  for (const ep of data.Episodes) {
    if (ep.imdbRating && ep.imdbRating !== 'N/A') {
      ratings[parseInt(ep.Episode, 10)] = ep.imdbRating;
    }
  }

  setCache(cacheKey, ratings);
  return ratings;
}

// Fetch rating for a single episode by its IMDb ID
async function getEpisodeRating(episodeImdbId) {
  const cacheKey = `ep:${episodeImdbId}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  if (!config.OMDB_API_KEY) return null;

  const url = `https://www.omdbapi.com/?i=${episodeImdbId}&apikey=${config.OMDB_API_KEY}`;
  const data = await fetchJson(url);

  if (!data || data.Response === 'False') return null;

  const rating = data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : null;
  setCache(cacheKey, rating);
  return rating;
}

module.exports = { getSeasonEpisodes, getEpisodeRating };
