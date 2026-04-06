const fetch = require('node-fetch');
const omdb = require('./omdb');

const CINEMETA_BASE = 'https://v3-cinemeta.strem.io';

async function fetchCinemetaMeta(imdbId) {
  const url = `${CINEMETA_BASE}/meta/series/${imdbId}.json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.meta || null;
}

async function enrichMeta(imdbId) {
  const meta = await fetchCinemetaMeta(imdbId);
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

    // Enrich title (use name as fallback since Cinemeta often uses name instead of title)
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
