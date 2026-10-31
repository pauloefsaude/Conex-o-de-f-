// Micro-roteador HTTP sem dependências: rotas, JSON, erros, CORS e cabeçalhos de segurança.
import { config } from './config.js';
import { verifyToken, rateLimit, sha256 } from './security.js';

export class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
export const fail = (status, message, code) => { throw new HttpError(status, message, code); };

export function createRouter() {
  const routes = [];
  const add = (method) => (pattern, handler, opts = {}) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    routes.push({ method, re, keys, handler, opts });
  };
  return {
    routes,
    get: add('GET'), post: add('POST'), put: add('PUT'), delete: add('DELETE'),
    match(method, pathname) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = pathname.match(r.re);
        if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
      }
      return null;
    },
  };
}

export function securityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (config.isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  const origin = req.headers.origin;
  if (origin && (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
}

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

export function readJson(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) { reject(new HttpError(413, 'Conteúdo grande demais.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'JSON inválido.')); }
    });
    req.on('error', reject);
  });
}

export const clientIp = (req) =>
  (config.isProd && req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

// Resolve usuário autenticado a partir do Bearer token e confere status no banco.
export function authenticate(db, req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = db.prepare('SELECT id, email, role, status, email_verified, premium_until, birthdate, settings, created_at, password_hash FROM users WHERE id = ?').get(payload.sub);
  if (!user || user.status === 'suspended') return null;
  if (payload.tv !== tokenVersion(user.password_hash)) return null;
  delete user.password_hash;
  return user;
}
// Trocar a senha invalida todas as sessões anteriores: o token carrega uma impressão do hash.
export const tokenVersion = (passwordHash) => sha256(passwordHash).slice(0, 12);

export function enforceRate(req, name, max, windowMs, who) {
  if (!rateLimit(`${name}:${who || clientIp(req)}`, max * config.rateLimitScale, windowMs)) {
    fail(429, 'Muitas tentativas. Aguarde um pouco e tente de novo.', 'rate_limited');
  }
}
