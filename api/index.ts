/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import app from '../server.ts';

export default function handler(req: any, res: any) {
  // Normalize and restore the original path from Vercel rewrites if needed
  const matchedPath =
    req.headers['x-matched-path'] ||
    req.headers['x-now-route-matches'] ||
    req.headers['x-invoke-path'];

  if (matchedPath && typeof matchedPath === 'string') {
    if (req.url === '/api' || req.url === '/api/' || req.url === '/') {
      req.url = matchedPath;
    }
  }

  return app(req, res);
}
