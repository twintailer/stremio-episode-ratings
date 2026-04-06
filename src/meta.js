const fetch = require('node-fetch');
const omdb = require('./omdb');

const TMDB_ADDON_BASE = 'https://tmdb.elfhosted.com/N4IgTgDgJgRgsgUygSwIYBUCeEEGcQBcoEA9rgC4JiHlgCuCANCADYkDmJhAZqi7kxAxUAYwDWUMCQg8+AgL7NyAW1gBBCMgDSCTIRAAOAOwiAjABZzAJgAM57gE4ENo6gPmAbFAcxH5hDAIqPaiIMzIAHYiLHRQCGpQdCzk+rQMYSAQUgBuyHEAkqow+VCp9AgZYAjkdGARhbAlZenMLKgR7HSo7BUEIHEAtAAiAKIZFFWoypHshADaALrMIqjkfBz4BHOgealFAHTk0hnk2L0gyiS5FcwRU+cACtJJqNTMuAAWJADu+REAEiRlL00ghFDtSn0VLB9m1KBQTmd9Jdrhk7sD9AAZVZ4cgAAgASggWEEBPh3l9fgCgSDyuCQLsoQcjjIlEi+gIwMg8Gj7vonhAXm8QJ8fn9ARiCKD6YyQNCYLCcQi2Th9JzueSQOjztj4fiiSTUGTxpTxTSaHTGBC9jDaAgIigOojVX0UdzeZKQOgqg6ZiaxdTJdKrQzIXLmT7HbMVed1Tzbny+t77VH-VSJbSGDKw-L9pggsLTi6Lld3QnPQBNAtps1By3Wpkw-OvZ2xqgaj3nKstikBjMWrMh2W5todLo9VvI0s3LWJkDYsfdGei9PmqX10M2hWjzpLycc9vx2eeje91d1rNLEArCgAYRIdAiKQIAFYL2oegTVjM-gBxe0qk2OVygye1UBgEkvwQH9yD9PpeH4ZdKRguCZgAdWQcgPgaGB0KdRC5GXWhkBEcgiXYZASAiAAxZBkiofQkIEDIUCotYWANUkEHoxjqAIFiwSAA';
const CINEMETA_BASE = 'https://v3-cinemeta.strem.io';

async function fetchMeta(imdbId) {
  // Try TMDB addon first (German titles)
  try {
    const tmdbUrl = `${TMDB_ADDON_BASE}/meta/series/${imdbId}.json`;
    const res = await fetch(tmdbUrl, { timeout: 8000 });
    if (res.ok) {
      const data = await res.json();
      if (data.meta) return data.meta;
    }
  } catch (err) {
    console.log(`[Meta] TMDB addon failed for ${imdbId}: ${err.message}`);
  }

  // Fallback to Cinemeta
  try {
    const url = `${CINEMETA_BASE}/meta/series/${imdbId}.json`;
    const res = await fetch(url, { timeout: 8000 });
    if (res.ok) {
      const data = await res.json();
      return data.meta || null;
    }
  } catch (err) {
    console.log(`[Meta] Cinemeta failed for ${imdbId}: ${err.message}`);
  }

  return null;
}

async function enrichMeta(imdbId) {
  const meta = await fetchMeta(imdbId);
  if (!meta || !meta.videos || meta.videos.length === 0) {
    return meta;
  }

  // Group videos by season to batch OMDB requests
  const seasons = new Set();
  for (const video of meta.videos) {
    if (video.season && video.season > 0) {
      seasons.add(video.season);
    }
  }

  // Fetch all season ratings in parallel
  const seasonRatings = {};
  const fetches = [...seasons].map(async (s) => {
    const ratings = await omdb.getSeasonEpisodes(imdbId, s);
    if (ratings) seasonRatings[s] = ratings;
  });
  await Promise.all(fetches);

  // Enrich each video/episode
  for (const video of meta.videos) {
    if (!video.season || video.season <= 0) continue;

    const sRatings = seasonRatings[video.season];
    let rating = sRatings ? sRatings[video.episode] : null;

    // Fallback: try individual episode lookup if we have an episode imdb id
    if (!rating && video.imdb_id) {
      rating = await omdb.getEpisodeRating(video.imdb_id);
    }

    if (!rating) continue;

    // Enrich title and name with rating prefix
    const originalTitle = video.title || video.name || '';
    const enrichedTitle = originalTitle
      ? `★ ${rating} | ${originalTitle}`
      : `★ ${rating}`;
    video.title = enrichedTitle;
    video.name = enrichedTitle;

    // Enrich overview with rating prefix
    const ratingLine = `⭐ IMDb: ${rating}/10`;
    if (video.overview) {
      video.overview = `${ratingLine}\n\n${video.overview}`;
    } else {
      video.overview = ratingLine;
    }
  }

  return meta;
}

module.exports = { enrichMeta };
