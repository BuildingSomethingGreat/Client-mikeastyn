import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// The public address of the site, used for canonical links, share images and the sitemap.
// Netlify provides URL at build time; set VITE_SITE_URL to override (e.g. a custom domain).
const SITE_URL = (process.env.VITE_SITE_URL || process.env.URL || 'http://localhost:5173').replace(/\/$/, '');

const PUBLIC_PAGES = ['/', '/music/'];

function siteMeta() {
  return {
    name: 'site-meta',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', SITE_URL),
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          PUBLIC_PAGES.map((p) => `  <url><loc>${SITE_URL}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
          `\n</urlset>\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      });
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [siteMeta()],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        music: resolve(import.meta.dirname, 'music/index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
});
