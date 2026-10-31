# Conexão de Fé — MVP

*Dois corações, uma fé, um propósito.* (nome e slogan provisórios)

Aplicativo de relacionamento cristão para maiores de 18 anos: perfis, descoberta com compatibilidade explicável, curtidas, combinações, chat em tempo real, denúncia e bloqueio, privacidade por campo, inspiração, eventos e painel de moderação.

**Para colocar no ar, siga [`docs/LANCAMENTO.md`](docs/LANCAMENTO.md).** O servidor já entrega a versão web do app em `/` (instalável na tela inicial).

```
conexao-de-fe/
├── docs/ARQUITETURA.md   ← arquitetura, mapa de telas, modelo de dados, fluxos, plano, custos, segurança
├── docs/POSTGRES.md      ← migração para PostgreSQL em produção
├── docs/marca/           ← logotipo original (SVG + PNG)
├── render.yaml           ← publicação no Render em um clique (Blueprint)
├── server/               ← API Node.js (sem dependências externas) + app web em / + painel em /admin
└── app/                  ← app React Native (Expo) para Android e iOS
```

## O que funciona hoje e o que não funciona

| Recurso | Situação |
|---|---|
| Cadastro, login, verificação de idade (18+), consentimento LGPD para dado religioso | ✅ implementado e testado |
| Confirmação de e-mail e redefinição de senha | ✅ fluxo completo; **envio real exige `RESEND_API_KEY`** (sem ela, o link aparece no console) |
| Perfil cristão completo, visibilidade por campo, fotos (validação de formato real) | ✅ |
| Descoberta com filtros (idade, distância, intenção, denominação) e motivos da compatibilidade | ✅ |
| Curtir/passar, combinação mútua, desfazer combinação | ✅ |
| Chat em tempo real (WebSocket), lido, silenciar, sugestões de perguntas | ✅ |
| Alertas de golpe (Pix/dinheiro, links, contato externo), antispam, limite de curtidas | ✅ regras |
| Denúncia (com trecho da mensagem), bloqueio imediato, revisão automática preventiva | ✅ |
| Painel admin: métricas, denúncias, fotos, eventos, usuários, auditoria | ✅ |
| Exclusão de conta e dados | ✅ |
| Inspiração, eventos com confirmação privada, notificações no app, central de ajuda | ✅ |
| Sugestões de biografia por IA | ⚙️ **exige `ANTHROPIC_API_KEY`**; sem ela, dicas por regras (o app informa) |
| Premium | ⚠️ regras de premium implementadas no servidor; **pagamento real não implementado** (só botão de teste em dev) |
| Notificações push (app fechado) | ❌ fase 2 — exige EAS + APNs/FCM |
| Login com Google/Apple | ❌ fase 2 — exige credenciais das lojas |
| Envio de imagens no chat, verificação por selfie, moderação automática de imagem | ❌ fase 2 |

## 1. Rodar o backend

Requisito: **Node.js 22.5 ou superior** (usa o SQLite embutido). Não há `npm install`.

```bash
cd server
cp .env.example .env          # opcional em dev
npm run seed                  # 10 perfis fictícios + 3 eventos
npm run create-admin -- admin@exemplo.com SenhaForte123
npm start                     # http://localhost:4000  ·  painel: http://localhost:4000/admin
npm test                      # 18 testes de ponta a ponta
```

Contas de demonstração: `ana@demo.conexaodefe.local`, `gabriel@demo.conexaodefe.local` etc., senha `Demo1234`.
Para ver uma combinação: entre como Ana e curta Gabriel; depois entre como Gabriel e curta Ana.

## 2. Rodar o app

```bash
cd app
npm run setup                 # instala e alinha as versões com o Expo SDK mais recente
EXPO_PUBLIC_API_URL=http://SEU-IP-NA-REDE:4000 npx expo start
```

- Abra no celular com o **Expo Go** (mesma rede Wi-Fi do computador) lendo o QR code.
- No celular, `localhost` não funciona: use o IP do computador (ex.: `192.168.0.12`).
- Emulador Android: `http://10.0.2.2:4000`. Simulador iOS: `http://localhost:4000`.

## 3. Publicar

**Backend** (Render, Railway ou Fly.io):
1. Defina `NODE_ENV=production`, `JWT_SECRET` (48+ caracteres aleatórios), `PUBLIC_URL=https://api.seudominio.com.br`, `RESEND_API_KEY`, `MAIL_FROM`, `CORS_ORIGINS`.
2. Monte um **disco persistente** em `/data` e aponte `DB_FILE=/data/conexao.db` e `UPLOAD_DIR=/data/uploads` (ou migre para PostgreSQL/S3 — ver `docs/POSTGRES.md`).
3. HTTPS é obrigatório (o provedor fornece). Comando de início: `npm start` dentro de `server/`.

**App** (EAS Build):
1. `npm i -g eas-cli && eas login && eas build:configure`
2. Em `app.json`, troque `extra.apiUrl` pela URL de produção.
3. `eas build -p android` e `eas build -p ios` (iOS exige conta Apple Developer, US$ 99/ano; Google Play, US$ 25 uma vez).
4. `eas submit -p android` / `eas submit -p ios`. Lojas exigem: política de privacidade publicada, formulário de segurança de dados, classificação 18+, conta de teste para revisão e opção de exclusão de conta dentro do app (já existe).

**Antes do lançamento**
- Revisar `server/public/termos.html` com advogado (é um rascunho) e nomear o encarregado (DPO).
- Validar o nome "Conexão de Fé" no INPI e nas lojas.
- Contratar pagamentos via RevenueCat + App Store/Google Play para o Premium.
- Licenciar uma tradução bíblica caso queira exibir o texto dos versículos (hoje só a referência aparece).
