module.exports = {
  OMDB_API_KEY: process.env.OMDB_API_KEY || '',
  PORT: parseInt(process.env.PORT, 10) || 7879,
  CACHE_TTL_HOURS: parseInt(process.env.CACHE_TTL_HOURS, 10) || 24,
};
