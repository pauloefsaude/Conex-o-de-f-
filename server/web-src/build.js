// Gera public/index.html a partir de web-src/app.html + estilo base. Uso: npm run build:web
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'app.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'base.css'), 'utf8');
fs.writeFileSync(path.join(dir, '..', 'public', 'index.html'), html.replace('/*BASE_CSS*/', css));
console.log('public/index.html gerado.');
