const { addonBuilder, getRouter } = require('stremio-addon-sdk');
const express = require('express');
const config = require('./config');
const { enrichMeta } = require('./meta');

if (!config.OMDB_API_KEY) {
  console.warn('[WARNING] OMDB_API_KEY not set — episode ratings will not be available');
}

const manifest = {
  id: 'community.episode-ratings',
  version: '1.0.0',
  name: 'Episode Ratings',
  description: 'Adds IMDb ratings to individual series episodes',
  resources: ['meta'],
  types: ['series'],
  idPrefixes: ['tt'],
  catalogs: [],
};

const builder = new addonBuilder(manifest);

builder.defineMetaHandler(async ({ type, id }) => {
  if (type !== 'series') return { meta: null };

  try {
    const meta = await enrichMeta(id);
    if (!meta) return { meta: null };
    return { meta };
  } catch (err) {
    console.error(`[Meta] Error enriching ${id}:`, err.message);
    return { meta: null };
  }
});

const app = express();
const addonInterface = builder.getInterface();
app.use(getRouter(addonInterface));

app.listen(config.PORT, () => {
  console.log(`[Episode Ratings] Listening on port ${config.PORT}`);
  console.log(`[Episode Ratings] Install: http://localhost:${config.PORT}/manifest.json`);
});
