import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { openDb } from './db.js';
import { createRouter, securityHeaders, sendJson, readJson, authenticate, HttpError } from './http.js';
import { createRealtime } from './ws.js';
import { loadProfile, isComplete } from './profiles.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import socialRoutes from './routes/social.js';
import contentRoutes from './routes/content.js';
import adminRoutes from './routes/admin.js';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export function createApp({ dbFile } = {}) {
  const db = openDb(dbFile);
  const router = createRouter();
  const server = http.createServer();
  const rt = createRealtime(server, db);

  authRoutes(router, db);
  profileRoutes(router, db);
  socialRoutes(router, db, rt);
  contentRoutes(router, db);
  adminRoutes(router, db);

  router.get('/health', async () => ({ ok: true }));

  server.on('request', async (req, res) => {
    securityHeaders(req, res);
    const url = new URL(req.url, 'http://x');
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

      if (req.method === 'GET' && !url.pathname.startsWith('/api/') && url.pathname !== '/health') {
        return serveStatic(url.pathname, res);
      }

      const found = router.match(req.method, url.pathname);
      if (!found) throw new HttpError(404, 'Rota não encontrada.');
      const { route, params } = found;
      const body = ['POST', 'PUT', 'DELETE'].includes(req.method) ? await readJson(req, route.opts.bodyLimit || 64 * 1024) : {};

      let user = null;
      if (route.opts.auth) {
        user = authenticate(db, req);
        if (!user) throw new HttpError(401, 'Sessão expirada. Entre novamente.', 'unauthorized');
        db.prepare("UPDATE users SET last_active_at = datetime('now') WHERE id = ? AND last_active_at < datetime('now','-5 minutes')").run(user.id);
        if (!route.opts.allowIncomplete) {
          if (!isComplete(loadProfile(db, user.id))) throw new HttpError(409, 'Complete seu perfil para continuar.', 'profile_incomplete');
          if (config.requireEmailVerified && !user.email_verified) throw new HttpError(403, 'Confirme seu e-mail para continuar.', 'email_unverified');
        }
      }

      const result = await route.handler({ req, res, body, params, query: url.searchParams, user, db });
      if (result && result.status && result.data) sendJson(res, result.status, result.data);
      else sendJson(res, 200, result ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message, code: e.code });
      console.error('[erro]', e);
      sendJson(res, 500, { error: 'Algo deu errado do nosso lado. Tente novamente.' });
    }
  });

  return { server, db, rt };
}

function serveStatic(pathname, res) {
  let file;
  if (pathname.startsWith('/photos/')) file = path.join(config.uploadDir, path.basename(pathname));
  else if (pathname === '/admin' || pathname === '/admin/') file = path.join(config.root, 'public', 'admin', 'index.html');
  else if (pathname === '/verificar-email' || pathname === '/redefinir-senha') file = path.join(config.root, 'public', 'link.html');
  else if (pathname === '/termos' || pathname === '/privacidade') file = path.join(config.root, 'public', 'termos.html');
  else if (pathname === '/' ) file = path.join(config.root, 'public', 'index.html');
  else if (pathname.startsWith('/static/')) file = path.join(config.root, 'public', 'static', path.basename(pathname));
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado');
  }
  const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' };
  if (pathname.startsWith('/photos/')) headers['Cache-Control'] = 'private, max-age=86400';
  if (file.endsWith('.html')) headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; manifest-src 'self'; frame-ancestors 'none'";
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}
