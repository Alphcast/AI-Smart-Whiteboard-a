/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import app from '../server.ts';

export default function handler(req: any, res: any) {
  try {
    // 1. Resolve from query param __path passed by vercel.json rewrite
    if (req.query && req.query.__path) {
      const rawPath = Array.isArray(req.query.__path)
        ? req.query.__path.join('/')
        : req.query.__path;
      const cleanPath = String(rawPath).startsWith('/') ? String(rawPath) : `/${rawPath}`;

      // Build clean query string without __path
      const urlParts = req.url.split('?');
      let search = '';
      if (urlParts.length > 1) {
        const params = new URLSearchParams(urlParts[1]);
        params.delete('__path');
        const qs = params.toString();
        if (qs) search = `?${qs}`;
      }

      if (cleanPath.startsWith('/socket.io')) {
        req.url = `${cleanPath}${search}`;
      } else {
        req.url = `/api${cleanPath}${search}`;
      }
    } else {
      // 2. Check Vercel routing headers
      const matched =
        req.headers['x-matched-path'] ||
        req.headers['x-vercel-matched-path'] ||
        req.headers['x-now-route-matches'] ||
        req.headers['x-invoke-path'];

      if (matched && typeof matched === 'string' && (matched.startsWith('/api/') || matched.startsWith('/socket.io/'))) {
        req.url = matched;
      } else if (req.url) {
        // 3. Fallback: ensure /api prefix is present for subpaths
        const [pathname, ...rest] = req.url.split('?');
        const search = rest.length > 0 ? `?${rest.join('?')}` : '';

        if (!pathname.startsWith('/api') && !pathname.startsWith('/socket.io')) {
          req.url = `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}${search}`;
        }
      }
    }
  } catch (err) {
    console.error('Error normalizing Vercel request path:', err);
  }

  return app(req, res);
}
