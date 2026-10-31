// Validação mínima e explícita de entradas (substitui Zod, sem dependências).
import { fail } from './http.js';

export const v = {
  str(val, name, { min = 0, max = 500, optional = false } = {}) {
    if (val == null || val === '') { if (optional) return null; fail(400, `${name} é obrigatório.`); }
    if (typeof val !== 'string') fail(400, `${name} inválido.`);
    const s = val.trim();
    if (s.length < min) fail(400, `${name} precisa ter ao menos ${min} caracteres.`);
    if (s.length > max) fail(400, `${name} pode ter no máximo ${max} caracteres.`);
    return s;
  },
  email(val) {
    const s = v.str(val, 'E-mail', { max: 254 }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) fail(400, 'E-mail inválido.');
    return s;
  },
  password(val) {
    const s = typeof val === 'string' ? val : '';
    if (s.length < 8 || s.length > 128) fail(400, 'A senha precisa ter entre 8 e 128 caracteres.');
    if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) fail(400, 'A senha precisa ter letras e números.');
    return s;
  },
  date(val, name) {
    if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val) || isNaN(Date.parse(val + 'T00:00:00Z'))) {
      fail(400, `${name} deve estar no formato AAAA-MM-DD.`);
    }
    return val;
  },
  oneOf(val, list, name, { optional = false } = {}) {
    if (val == null || val === '') { if (optional) return null; fail(400, `${name} é obrigatório.`); }
    if (!list.includes(val)) fail(400, `${name} inválido.`);
    return val;
  },
  listOf(val, list, name, max = 10) {
    if (val == null) return [];
    if (!Array.isArray(val) || val.length > max || val.some((x) => !list.includes(x))) fail(400, `${name} inválido.`);
    return [...new Set(val)];
  },
  int(val, name, min, max, { optional = false } = {}) {
    if (val == null || val === '') { if (optional) return null; fail(400, `${name} é obrigatório.`); }
    const n = Number(val);
    if (!Number.isInteger(n) || n < min || n > max) fail(400, `${name} deve estar entre ${min} e ${max}.`);
    return n;
  },
  bool: (val) => val === true,
};
