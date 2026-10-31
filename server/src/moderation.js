// Moderação automática por regras (MVP). Explicável e previsível.
// Fase 2: somar um classificador (LLM ou serviço de moderação) sem remover estas regras.

const MONEY = /\b(pix|transfer[eêi]|transferência|dep[oó]sit|empr[eé]st|me empresta|dinheiro|boleto|cart[aã]o de cr[eé]dito|bitcoin|cripto|investiment|gift ?card|vale[- ]presente|western union|conta banc[aá]ria|chave pix)/i;
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|xyz|top|io|link|site|online|br)\b)/i;
const OFF_PLATFORM = /\b(whats(app)?|zap|telegram|me chama no|meu n[uú]mero)\b|\(?\d{2}\)?\s?9?\d{4}[- ]?\d{4}/i;
const ABUSE = /\b(idiota|vagabund[ao]|burr[ao]|nojent[ao]|vadia|puta|otári[ao])\b/i;

export function analyzeMessage(body) {
  const flags = [];
  if (MONEY.test(body)) flags.push('money');
  if (LINK.test(body)) flags.push('link');
  if (OFF_PLATFORM.test(body)) flags.push('off_platform');
  if (ABUSE.test(body)) flags.push('abusive');
  return flags;
}

export const FLAG_WARNINGS = {
  money: 'Esta mensagem menciona dinheiro. Nunca envie dinheiro, Pix ou presentes a quem você não conhece pessoalmente.',
  link: 'Esta mensagem contém um link. Só abra se confiar na pessoa.',
  off_platform: 'A pessoa sugeriu sair do app. Vá com calma: dentro do app você pode denunciar e bloquear.',
  abusive: 'Esta mensagem pode conter linguagem ofensiva. Você pode denunciar ou bloquear.',
};

export function analyzeProfileText(text) {
  const flags = [];
  if (LINK.test(text)) flags.push('link');
  if (OFF_PLATFORM.test(text)) flags.push('off_platform');
  if (MONEY.test(text)) flags.push('money');
  return flags;
}
