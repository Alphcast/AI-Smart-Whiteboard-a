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
      delete req.query.__path;

      // Build clean query string without __path
      const urlParts = (req.url || '').split('?');
      let search = '';
      if (urlParts.length > 1) {
        const params = new URLSearchParams(urlParts[1]);
        params.delete('__path');
        const qs = params.toString();
        if (qs) search = `?${qs}`;
      }

      if (cleanPath.startsWith('/socket.io')) {
        req.url = `${cleanPath}${search}`;
      } else if (cleanPath.startsWith('/api')) {
        req.url = `${cleanPath}${search}`;
      } else {
        req.url = `/api${cleanPath}${search}`;
      }
    } else if (req.query && req.query.all) {
      // 2. Resolve from catch-all route api/[...all].ts
      const allParts = Array.isArray(req.query.all) ? req.query.all.join('/') : req.query.all;
      delete req.query.all;
      const cleanAll = String(allParts).startsWith('/') ? String(allParts) : `/${allParts}`;
      const urlParts = (req.url || '').split('?');
      const search = urlParts.length > 1 ? `?${urlParts.slice(1).join('?')}` : '';

      if (cleanAll.startsWith('/socket.io')) {
        req.url = `${cleanAll}${search}`;
      } else if (cleanAll.startsWith('/api')) {
        req.url = `${cleanAll}${search}`;
      } else {
        req.url = `/api${cleanAll}${search}`;
      }
    } else {
      // 3. Fallback: normalize req.url for native Vercel function routing
      let urlPath = req.url || '/api';
      const [pathname, ...rest] = urlPath.split('?');
      const search = rest.length > 0 ? `?${rest.join('?')}` : '';

      // CRITICAL: Do NOT overwrite req.url with x-matched-path if it contains dynamic segment '[...all]'
      if (!pathname.startsWith('/api') && !pathname.startsWith('/socket.io') && !pathname.startsWith('/health')) {
        req.url = `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}${search}`;
      }
    }
  } catch (err) {
    console.error('Error normalizing Vercel request path in api/index.ts:', err);
  }

  return app(req, res);
}
