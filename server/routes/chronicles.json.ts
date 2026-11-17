import catalog from '../../content/catalog.json';

// Prerendered alongside the pages; no server is needed on the public site.
export default defineEventHandler(() => catalog);
