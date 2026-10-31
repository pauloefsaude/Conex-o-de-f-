// Servidor WebSocket mínimo (RFC 6455) só para empurrar eventos do servidor ao app.
// O app não envia dados por aqui — mensagens vão pela API REST, onde há validação e moderação.
import crypto from 'node:crypto';
import { verifyToken } from './security.js';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function createRealtime(server, db) {
  const sockets = new Map(); // userId -> Set<socket>

  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname !== '/ws' || req.headers.upgrade?.toLowerCase() !== 'websocket') return socket.destroy();
    const payload = verifyToken(url.searchParams.get('token'));
    const user = payload && db.prepare("SELECT id, status FROM users WHERE id = ?").get(payload.sub);
    if (!user || user.status === 'suspended') {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      return socket.destroy();
    }
    const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);

    const set = sockets.get(user.id) || new Set();
    set.add(socket); sockets.set(user.id, set);
    const drop = () => { set.delete(socket); if (!set.size) sockets.delete(user.id); };
    socket.on('close', drop); socket.on('error', drop);
    socket.setTimeout(0); socket.setKeepAlive(true, 30000);

    socket.on('data', (buf) => {
      const opcode = buf[0] & 0x0f;
      if (opcode === 0x8) { try { socket.end(Buffer.from([0x88, 0x00])); } catch {} drop(); }
      else if (opcode === 0x9) socket.write(frame(unmaskPayload(buf), 0xA));
      else if (buf.length > 4096) socket.destroy(); // clientes não devem enviar dados grandes
    });
    write(socket, { type: 'hello' });
  });

  function emit(userId, event) {
    for (const s of sockets.get(userId) || []) write(s, event);
  }
  return { emit, connected: (id) => sockets.has(id) };
}

function write(socket, obj) {
  try { socket.write(frame(Buffer.from(JSON.stringify(obj)), 0x1)); } catch {}
}

function frame(payload, opcode) {
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | opcode, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}

function unmaskPayload(buf) {
  const masked = buf[1] & 0x80; let len = buf[1] & 0x7f; let off = 2;
  if (len === 126) { len = buf.readUInt16BE(2); off = 4; }
  if (!masked) return buf.subarray(off, off + len);
  const mask = buf.subarray(off, off + 4); off += 4;
  const out = Buffer.alloc(len);
  for (let i = 0; i < len; i++) out[i] = buf[off + i] ^ mask[i % 4];
  return out;
}
