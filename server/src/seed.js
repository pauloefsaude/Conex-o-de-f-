// Dados fictícios para desenvolvimento. NÃO rodar em produção.
import { openDb, tx } from './db.js';
import { hashPassword, newId } from './security.js';
import { config } from './config.js';
import { CITIES } from './content.js';

if (config.isProd) { console.error('Seed bloqueado em produção.'); process.exit(1); }

const db = openDb();
const PASS = hashPassword('Demo1234');

const people = [
  ['Ana Clara', 'woman', '1996-04-12', 'sao-paulo-sp', 'Católica', 'Namoro sério', 'Quero ter', ['Música', 'Leitura', 'Café', 'Viagens'], ['Sinceridade', 'Família', 'Bom humor'], 'Professora, amo uma boa conversa e café coado. Participo da pastoral da juventude e quero conhecer alguém para caminhar junto.'],
  ['Beatriz', 'woman', '1993-09-03', 'campinas-sp', 'Batista', 'Casamento', 'Quero ter', ['Louvor', 'Cozinhar', 'Trilhas'], ['Fidelidade', 'Família', 'Respeito'], 'Enfermeira, toco teclado no ministério de louvor e gosto de trilha no fim de semana.'],
  ['Camila', 'woman', '1999-01-22', 'rio-de-janeiro-rj', 'Assembleia de Deus', 'Namoro sério', 'Ainda não sei', ['Praia', 'Fotografia', 'Dança'], ['Bom humor', 'Generosidade'], 'Fotógrafa, carioca, sempre com uma câmera e um sorriso.'],
  ['Débora', 'woman', '1990-06-30', 'belo-horizonte-mg', 'Presbiteriana', 'Casamento', 'Já tenho e quero mais', ['Estudo bíblico', 'Jogos de tabuleiro', 'Pets'], ['Paciência', 'Família', 'Perdão'], 'Mãe de um menino incrível, engenheira e apaixonada por jogos de tabuleiro.'],
  ['Elisa', 'woman', '1995-11-15', 'sao-paulo-sp', 'Comunidade/Independente', 'Namoro sério', 'Quero ter', ['Voluntariado', 'Missões', 'Idiomas'], ['Serviço ao próximo', 'Humildade'], 'Já fiz missão no sertão e hoje trabalho com ONGs. Falo espanhol e estou aprendendo libras.'],
  ['Gabriel', 'man', '1994-02-08', 'sao-paulo-sp', 'Católica', 'Namoro sério', 'Quero ter', ['Música', 'Corrida', 'Café', 'Leitura'], ['Sinceridade', 'Família', 'Disciplina'], 'Desenvolvedor, corro aos sábados e sirvo no ministério de música da paróquia.'],
  ['Lucas', 'man', '1991-07-19', 'campinas-sp', 'Batista', 'Casamento', 'Quero ter', ['Esportes', 'Cozinhar', 'Louvor'], ['Fidelidade', 'Responsabilidade'], 'Contador que cozinha bem (dizem). Busco alguém para construir uma família com fé.'],
  ['Mateus', 'man', '1997-12-01', 'rio-de-janeiro-rj', 'Assembleia de Deus', 'Namoro sério', 'Ainda não sei', ['Praia', 'Tecnologia', 'Cinema'], ['Bom humor', 'Respeito'], 'Engenheiro de software, carioca, adoro cinema e um bom pôr do sol no Arpoador.'],
  ['Rafael', 'man', '1989-03-25', 'belo-horizonte-mg', 'Presbiteriana', 'Casamento', 'Quero ter', ['Estudo bíblico', 'Trilhas', 'Natureza'], ['Paciência', 'Perdão', 'Família'], 'Biólogo, líder de pequeno grupo e fã de trilhas na Serra do Cipó.'],
  ['Tiago', 'man', '1996-08-14', 'sao-paulo-sp', 'Metodista', 'Amizade', 'Ainda não sei', ['Jogos de tabuleiro', 'Artes', 'Café'], ['Generosidade', 'Bom humor'], 'Designer, quero fazer amizades na fé e ver aonde Deus leva.'],
];

tx(db, () => {
  for (const [name, gender, birth, cityKey, den, goal, kids, interests, values, bio] of people) {
    const email = `${name.split(' ')[0].toLowerCase()}@demo.conexaodefe.local`;
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) continue;
    const id = newId(); const [city, uf, lat, lng] = CITIES[cityKey];
    db.prepare(`INSERT INTO users (id, email, password_hash, birthdate, email_verified, terms_accepted_at, sensitive_consent_at) VALUES (?,?,?,?,1,datetime('now'),datetime('now'))`).run(id, email, PASS, birth);
    db.prepare(`INSERT INTO profiles (user_id, display_name, gender, seeking, city_key, city, region, lat, lng, bio, denomination, church_frequency, prayer_importance,
      relationship_goal, wants_children, values_json, interests_json, answers_json, favorite_verse, future, visibility_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, name, gender, gender === 'man' ? 'woman' : 'man', cityKey, city, uf, lat, lng, bio, den, 'Semanalmente', 4, goal, kids,
        JSON.stringify(values), JSON.stringify(interests),
        JSON.stringify([{ q: 'Como você gosta de passar seu tempo livre?', a: `Com ${interests[0].toLowerCase()} e pessoas queridas.` }]),
        'Salmos 23', 'Construir um lar com paz e propósito.',
        JSON.stringify({ denomination: true, church_frequency: false, prayer_importance: true, favorite_verse: true }));
    db.prepare('INSERT INTO preferences (user_id) VALUES (?)').run(id);
  }

  // Alguns perfis já "curtiram" quem se cadastrar? Não: curtidas só existem entre contas reais.
  // Para testar uma combinação, entre como ana@demo... e curta gabriel@demo..., depois o inverso.

  if (!db.prepare('SELECT 1 FROM events').get()) {
    const ev = db.prepare('INSERT INTO events (title, description, kind, city, location, online_url, starts_at) VALUES (?,?,?,?,?,?,?)');
    ev.run('Café de solteiros cristãos', 'Bate-papo leve com perguntas para quebrar o gelo. Aberto a todas as tradições.', 'Encontro de solteiros', 'São Paulo', 'Local a confirmar — região central', null, future(10));
    ev.run('Estudo bíblico online: amor e respeito', 'Quatro encontros online sobre comunicação e cuidado nos relacionamentos.', 'Estudo bíblico', null, null, 'https://exemplo.com/evento', future(5));
    ev.run('Trilha e louvor ao ar livre', 'Caminhada leve com momento de louvor no fim. Leve água e protetor solar.', 'Atividade social', 'Belo Horizonte', 'Parque a confirmar', null, future(17));
  }
});

function future(days) { return new Date(Date.now() + days * 864e5).toISOString().replace('T', ' ').slice(0, 19); }

console.log('Seed pronto. Contas de demonstração: <nome>@demo.conexaodefe.local / Demo1234 (ex.: ana@demo.conexaodefe.local).');
console.log('Para o painel: npm run create-admin -- admin@exemplo.com SenhaForte123');
