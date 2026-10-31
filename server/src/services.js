// Integrações externas opcionais. Sem credenciais, cada uma diz claramente o que fez.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

// ---------- E-mail ----------
export async function sendMail(to, subject, text) {
  if (!config.resendApiKey) {
    // Sem provedor de e-mail o app continua funcionando; só a confirmação e a recuperação de senha ficam indisponíveis.
    if (config.isProd) { console.warn(`[email] RESEND_API_KEY ausente — e-mail "${subject}" não enviado.`); return { delivered: false }; }
    console.log(`\n[email:DEV — não enviado] Para: ${to}\nAssunto: ${subject}\n${text}\n`);
    return { delivered: false, dev: true };
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.mailFrom, to: [to], subject, text }),
  });
  if (!r.ok) throw new Error(`Falha no envio de e-mail (${r.status})`);
  return { delivered: true };
}

// ---------- Armazenamento de fotos (disco local). Para S3/R2, substituir estas 3 funções. ----------
const MAGIC = { jpg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47], webp: [0x52, 0x49, 0x46, 0x46] };

export function detectImage(buf) {
  for (const [ext, sig] of Object.entries(MAGIC)) {
    if (sig.every((b, i) => buf[i] === b)) {
      if (ext === 'webp' && buf.subarray(8, 12).toString() !== 'WEBP') continue;
      return ext;
    }
  }
  return null;
}
export function savePhoto(buf, ext) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const file = `${crypto.randomBytes(16).toString('hex')}.${ext}`; // nome imprevisível
  fs.writeFileSync(path.join(config.uploadDir, file), buf);
  return file;
}
export function deletePhotoFile(file) {
  try { fs.unlinkSync(path.join(config.uploadDir, path.basename(file))); } catch {}
}
export const photoUrl = (file) => `${config.publicUrl}/photos/${file}`;

// ---------- IA: sugestões de biografia ----------
const AI_RULES = [
  'Comece com algo concreto sobre você (o que faz, do que gosta), em vez de adjetivos genéricos.',
  'Conte um detalhe da sua fé no dia a dia — sem precisar de termos difíceis.',
  'Diga o que você procura com clareza: amizade, namoro sério ou casamento.',
  'Termine com um convite à conversa, como uma pergunta simples.',
];

export async function bioSuggestions(profile) {
  const tips = [...AI_RULES];
  if ((profile.bio || '').length < 60) tips.unshift('Sua biografia está curta. Duas ou três frases já ajudam muito.');
  if (!config.anthropicApiKey) return { source: 'regras', tips };

  const prompt = `Você ajuda pessoas cristãs a escrever a biografia de um app de relacionamento sério.
Regras: português do Brasil, tom respeitoso e natural, nunca julgar a fé da pessoa, nunca prometer que Deus vai trazer alguém, não inventar fatos.
Dados declarados: ${JSON.stringify({ bio: profile.bio, interesses: profile.interests, valores: profile.values, objetivo: profile.relationship_goal })}
Responda só com JSON: {"tips": ["3 dicas curtas"], "example": "uma biografia de até 300 caracteres baseada apenas nos dados"}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': config.anthropicApiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: config.anthropicModel, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) throw new Error(String(r.status));
    const data = await r.json();
    const text = data.content?.[0]?.text || '';
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return { source: 'ia', tips: parsed.tips?.slice(0, 5) || tips, example: String(parsed.example || '').slice(0, 400) };
  } catch (e) {
    return { source: 'regras', tips, note: 'IA indisponível no momento; dicas por regras.' };
  }
}
