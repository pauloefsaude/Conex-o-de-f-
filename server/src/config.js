import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Carrega .env simples (CHAVE=valor), sem dependências.
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;
const isProd = env.NODE_ENV === 'production';

if (isProd && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET (mín. 32 caracteres) é obrigatório em produção.');
}

export const config = {
  root,
  isProd,
  port: Number(env.PORT || 4000),
  // No Render, RENDER_EXTERNAL_URL já vem preenchida com o endereço público do serviço.
  publicUrl: (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${env.PORT || 4000}`).replace(/\/$/, ''),
  dbFile: env.DB_FILE || path.join(root, 'data', 'conexao.db'),
  uploadDir: env.UPLOAD_DIR || path.join(root, 'data', 'uploads'),
  jwtSecret: env.JWT_SECRET || crypto.createHash('sha256').update('dev-only-' + root).digest('hex'),
  tokenTtlSec: Number(env.TOKEN_TTL_SEC || 60 * 60 * 24 * 7),
  corsOrigins: (env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()),
  freeDailyLikes: Number(env.FREE_DAILY_LIKES || 50),
  // E-mail: Resend (https://resend.com). Sem chave, o link é impresso no console (somente dev).
  resendApiKey: env.RESEND_API_KEY || '',
  mailFrom: env.MAIL_FROM || 'Conexão de Fé <nao-responda@exemplo.com>',
  // IA opcional (sugestão de biografia). Sem chave, usa regras locais e diz isso na resposta.
  anthropicApiKey: env.ANTHROPIC_API_KEY || '',
  anthropicModel: env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
  // Ativação de premium sem pagamento — só para testes locais, nunca em produção.
  devPremium: !isProd && env.DEV_PREMIUM === '1',
  // Multiplicador dos limites de requisição (usado nos testes automatizados). Não alterar em produção.
  rateLimitScale: isProd ? 1 : Number(env.RATE_LIMIT_SCALE || 1),
  requireEmailVerified: env.REQUIRE_EMAIL_VERIFIED === '1',
};
