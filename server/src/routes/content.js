import { fail } from '../http.js';
import { INSPIRATION, HELP_FAQ } from '../content.js';
import { isPremium } from '../profiles.js';
import { config } from '../config.js';

export default function contentRoutes(r, db) {
  r.get('/api/inspiration', async () => ({
    items: INSPIRATION,
    note: 'Conteúdos de reflexão. Não prometem resultados espirituais ou amorosos.',
  }));

  r.get('/api/help', async () => ({ faq: HELP_FAQ, contact: 'suporte@conexaodefe.com.br (a configurar)' }));

  r.get('/api/events', async ({ user }) => {
    const rows = db.prepare(`SELECT e.*, (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id) going,
      EXISTS (SELECT 1 FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = ?) mine
      FROM events e WHERE e.starts_at >= datetime('now','-1 day') ORDER BY e.starts_at LIMIT 100`).all(user.id);
    // Lista de participantes nunca é exposta — só a contagem.
    return { events: rows.map((e) => ({ id: e.id, title: e.title, description: e.description, kind: e.kind, city: e.city,
      location: e.location, onlineUrl: e.online_url, startsAt: e.starts_at, going: e.going, imGoing: !!e.mine })) };
  }, { auth: true, allowIncomplete: true });

  r.post('/api/events/:id/rsvp', async ({ user, params }) => {
    if (!db.prepare('SELECT 1 FROM events WHERE id = ?').get(Number(params.id))) fail(404, 'Evento não encontrado.');
    db.prepare('INSERT OR IGNORE INTO event_rsvps (event_id, user_id) VALUES (?,?)').run(Number(params.id), user.id);
    return { imGoing: true };
  }, { auth: true, allowIncomplete: true });

  r.delete('/api/events/:id/rsvp', async ({ user, params }) => {
    db.prepare('DELETE FROM event_rsvps WHERE event_id = ? AND user_id = ?').run(Number(params.id), user.id);
    return { imGoing: false };
  }, { auth: true, allowIncomplete: true });

  r.get('/api/premium', async ({ user }) => ({
    active: isPremium(user),
    premiumUntil: user.premium_until,
    benefits: [
      'Ver quem curtiu você',
      'Curtidas sem limite diário (com limites antiabuso)',
      'Desfazer o último "passar"',
      'Filtros avançados: só e-mails verificados, só perfis com foto',
    ],
    notIncluded: 'Premium nunca permite enviar mensagem sem combinação, contornar bloqueios ou ver dados privados.',
    plans: [
      { id: 'mensal', label: 'Mensal', price: null },
      { id: 'anual', label: 'Anual', price: null },
    ],
    priceNote: 'Preços a definir após pesquisa de mercado. Pagamento real será feito pela App Store / Google Play (fase 2).',
    purchaseAvailable: false,
    devActivateAvailable: config.devPremium,
  }), { auth: true, allowIncomplete: true });

  // SOMENTE PARA TESTES LOCAIS (DEV_PREMIUM=1 e fora de produção). Não é um pagamento.
  r.post('/api/premium/dev-activate', async ({ user }) => {
    if (!config.devPremium) fail(404, 'Não encontrado.');
    db.prepare("UPDATE users SET premium_until = datetime('now', '+30 days') WHERE id = ?").run(user.id);
    return { ok: true, note: 'Premium de teste ativado por 30 dias (ambiente de desenvolvimento).' };
  }, { auth: true, allowIncomplete: true });
}
