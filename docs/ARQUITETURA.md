# Conexão de Fé — Arquitetura e Plano de Execução

> "Dois corações, uma fé, um propósito." — nome e slogan provisórios, a validar antes do lançamento (INPI + disponibilidade de domínio e nas lojas).

Identidade, textos, logotipo e código são originais. Usamos apenas padrões genéricos de usabilidade do segmento (pilha de cartões, curtir/passar, combinação mútua, chat liberado após combinação). Nada de marca, cores, ícones ou textos de concorrentes.

---

## 1. Arquitetura recomendada

```
┌──────────────────────┐        HTTPS (JSON)        ┌──────────────────────────┐
│ App Expo (RN)        │ ─────────────────────────▶ │ API Node.js / Express    │
│ Android + iOS (+web) │ ◀── WebSocket (Socket.IO)─ │  • auth JWT + bcrypt     │
└──────────────────────┘                            │  • validação Zod         │
                                                    │  • rate limit / helmet   │
┌──────────────────────┐                            │  • moderação/antifraude  │
│ Painel admin (web)   │ ── HTTPS ────────────────▶ │  • RBAC (user/mod/admin) │
│ servido em /admin    │                            └────────────┬─────────────┘
└──────────────────────┘                                         │
                                       ┌─────────────────────────┼───────────────────────┐
                                       ▼                         ▼                       ▼
                               Banco SQL                 Armazenamento de fotos   SMTP (e-mails)
                     (SQLite em dev → PostgreSQL)      (disco em dev → S3/R2)   (log no console em dev)
```

**Por que esta escolha**

| Decisão | Escolha | Motivo |
|---|---|---|
| App | React Native + Expo | Um código para Android/iOS, build na nuvem (EAS), atualização OTA, mesma linguagem do backend. Flutter seria igualmente viável; Expo vence pela equipe única em JS. |
| Backend | Node 22 + Express + Socket.IO | Simples, maduro, tempo real nativo. |
| Banco | SQL relacional. Dev: SQLite embutido no Node (zero instalação). Produção: PostgreSQL gerenciado | Combinações, bloqueios e denúncias são relacionais por natureza. O schema usa SQL portável. |
| Fotos | Disco local em dev; S3/Cloudflare R2 em produção | Interface única `storage.js`, troca por variável de ambiente. |
| Auth | E-mail + senha (bcrypt custo 12), JWT curto | Login social (Apple/Google) fica na fase 2 — exige credenciais das lojas. |
| Pagamentos | RevenueCat sobre Google Play Billing / Apple IAP (fase 2) | Assinaturas digitais em app precisam usar o faturamento das lojas. |
| Push | Expo Notifications (fase 2) | Exige projeto EAS e chaves APNs/FCM. |
| Erros | Sentry (fase 2) | Exige DSN. |

---

## 2. Mapa de telas

```
Abertura ─▶ Apresentação ─▶ Cadastro ─▶ Verificação de idade (data de nascimento, ≥18)
                         └▶ Login        └▶ Aceite de termos/privacidade (no cadastro)
                                              │
                                              ▼
                       Preferências iniciais ─▶ Criação do perfil ─▶ Fotos
                                              │
                                              ▼
               ┌────────── Abas principais ──────────────────────────┐
               │ Descobrir │ Combinações │ Inspiração │ Eventos │ Eu │
               └───────────────────────────────────────────────────────┘
 Descobrir ─▶ Perfil completo ─▶ Denunciar/Bloquear
 Combinações ─▶ Chat ─▶ Perguntas para conversar · Desfazer combinação · Denunciar/Bloquear
 Eu ─▶ Editar perfil · Privacidade · Notificações · Premium · Central de ajuda · Excluir conta
 Painel administrativo (web, /admin) ─▶ Métricas · Fila de denúncias · Eventos · Usuários
```

As 22 telas pedidas estão cobertas; o que é MVP e o que é fase 2 está no item 5.

---

## 3. Modelo de dados (resumo — schema completo em `server/src/schema.sql`)

| Tabela | Campos principais |
|---|---|
| `users` | id, email (único), password_hash, birthdate, email_verified, role (user/moderator/admin), status (active/suspended/deleted), terms_accepted_at, premium_until, created_at, last_active_at |
| `profiles` | user_id, display_name, gender, seeking, city, region, lat_approx, lng_approx (arredondadas ~1 km), bio, denomination, church_frequency, prayer_importance, relationship_goal, wants_children, values (JSON), interests (JSON), favorite_verse, future, visibility (JSON por campo) |
| `preferences` | user_id, age_min, age_max, max_distance_km, goals (JSON), denominations (JSON) |
| `photos` | id, user_id, path, position, moderation_status |
| `swipes` | from_user, to_user, action (like/pass), created_at — PK composta |
| `matches` | id, user_a < user_b, created_at, unmatched_at |
| `messages` | id, match_id, sender_id, body, flags (spam/money), created_at, read_at |
| `blocks` | blocker_id, blocked_id |
| `reports` | id, reporter_id, reported_id, message_id?, reason, details, status, handled_by, resolution |
| `events` | id, title, description, kind, city, starts_at, online_url, created_by |
| `event_rsvps` | event_id, user_id (privado; nunca exibido publicamente) |
| `audit_log` | id, actor_id, action, target, meta, created_at |
| `email_tokens` | token_hash, user_id, kind (verify/reset), expires_at |

Denominação, frequência e oração são **dados sensíveis (LGPD art. 5º, II e art. 11)**: coletados com consentimento específico no cadastro, ocultáveis campo a campo e excluídos com a conta.

---

## 4. Principais fluxos

1. **Cadastro**: e-mail + senha + data de nascimento + aceite (termos, privacidade, consentimento de dado religioso) → API recusa < 18 → token de confirmação enviado por e-mail → perfil → fotos → descoberta.
2. **Descoberta**: API devolve candidatos filtrando: ativos, perfil completo, gênero/busca mútua, idade, distância aproximada, denominação/objetivo (se o usuário pediu), excluindo já avaliados, bloqueados nos dois sentidos e a si mesmo. Ordena por pontuação de compatibilidade **explicável** (a API devolve os motivos).
3. **Combinação**: curtida → se a outra pessoa já curtiu, cria `match` e notifica ambos via WebSocket.
4. **Chat**: só entre combinações ativas e não bloqueadas (checado no servidor a cada mensagem). Mensagens passam pelo filtro de spam/golpe: links em excesso, Pix/transferência/cartão/"me empresta" geram alerta visível para quem recebe.
5. **Denúncia/Bloqueio**: bloqueio é imediato e desfaz a combinação; denúncia entra na fila do painel; moderador vê só a mensagem denunciada, não a conversa inteira.
6. **Exclusão**: apaga perfil, fotos, curtidas, mensagens enviadas e preferências; mantém registro mínimo anonimizado de denúncias por obrigação de segurança.

---

## 5. Plano de desenvolvimento

| Fase | Duração estimada (1–2 devs) | Entregas |
|---|---|---|
| 0. Validação | 2–4 semanas | Entrevistas (15–25 pessoas, católicos e evangélicos de várias regiões), benchmarking, validação do nome no INPI, protótipo navegável |
| **1. MVP (este repositório)** | 6–8 semanas até loja | Cadastro/login, idade, perfil, fotos, descoberta com filtros, curtidas, combinações, chat em tempo real, denúncia/bloqueio, privacidade, exclusão, inspiração, eventos (leitura), painel admin básico |
| 2. Produção | 4–6 semanas | PostgreSQL gerenciado, S3/R2, SMTP real, push, Sentry, login Apple/Google, assinatura premium via lojas, moderação de imagem automática, testes em aparelhos |
| 3. Crescimento | contínuo | IA de sugestão de bio/perguntas (LLM via backend), verificação por selfie, eventos com inscrição paga, A/B de onboarding |

---

## 6. Custos operacionais estimados (mensais, em R$, câmbio ~R$ 5,50/US$)

| Item | Início (≤ 5 mil usuários) | Crescimento (~50 mil) |
|---|---|---|
| Servidor API (Render/Railway/Fly) | 40–150 | 400–1.200 |
| PostgreSQL gerenciado | 0–140 | 300–900 |
| Fotos (R2/S3 + CDN) | 0–30 | 100–400 |
| E-mail transacional | 0–110 | 110–500 |
| Push (Expo) | 0 | 0 |
| Monitoramento (Sentry) | 0 | 145–450 |
| Moderação de imagem por API | 0–100 | 300–1.500 |
| IA (LLM para sugestões) | 50–200 | 500–2.500 |
| Contas de desenvolvedor | Apple US$ 99/ano + Google US$ 25 único | — |
| **Total aproximado** | **R$ 100–850/mês** | **R$ 2–7,5 mil/mês** |

Taxas das lojas sobre assinaturas: 15% (programa para pequenas empresas) a 30%. Valores são estimativas de ordem de grandeza; confirmar preços atuais de cada fornecedor antes de contratar.

---

## 7. Medidas de segurança

- Senhas com bcrypt (custo 12); nunca em texto simples. JWT assinado com segredo de ambiente; nenhum segredo no app.
- Toda regra crítica no servidor: idade, combinação para conversar, bloqueios, limites diários, papéis de moderador/admin.
- Premium **não** fura bloqueio, não envia mensagem sem combinação e não vê dados privados.
- Rate limit global e por rota (login, curtidas, mensagens); limite diário de curtidas no plano gratuito.
- Helmet, CORS restrito, validação Zod em todas as entradas, uploads limitados a JPEG/PNG/WebP até 5 MB.
- Localização armazenada arredondada (~1 km) e exibida só como cidade/distância em faixa.
- Filtro de mensagens: alerta de pedido de dinheiro/Pix, links suspeitos, repetição (spam).
- Moderadores acessam apenas a mensagem denunciada; toda ação administrativa vai para `audit_log`.
- LGPD: consentimento específico para dado religioso, controle de visibilidade por campo, exclusão de conta e dados, exportação de dados (fase 2), encarregado (DPO) nomeado antes do lançamento, plano de resposta a incidentes (notificar ANPD e titulares em prazo razoável).
- Selo "e-mail verificado" mostra só isso — não sugere verificação de identidade.
