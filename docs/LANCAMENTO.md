# Como colocar o Conexão de Fé no ar

Tudo isto pode ser feito pelo navegador do celular. Tempo estimado: 30 a 40 minutos.

## Fase 1 — Site público (app web que pode ser instalado na tela inicial)

### 1. Criar a conta no GitHub (grátis)
1. Acesse https://github.com/signup e crie sua conta.
2. Toque em **+** › **New repository**.
3. Nome: `conexao-de-fe` · marque **Private** · não marque nenhuma outra opção · **Create repository**.
4. Envie ao Claude o endereço do repositório (ex.: `github.com/seu-usuario/conexao-de-fe`). O Claude envia o código para lá.
   - Se o Claude não tiver acesso, conecte o GitHub em claude.ai › Configurações › Conectores e peça de novo.

### 2. Criar a conta no Render e publicar
1. Acesse https://render.com e entre com **Sign in with GitHub**.
2. Cadastre um cartão de crédito em **Billing** (o plano necessário custa cerca de US$ 7/mês + US$ 0,25/mês pelo disco de 1 GB).
3. Toque em **New** › **Blueprint** e escolha o repositório `conexao-de-fe`.
4. O Render lê o arquivo `render.yaml` e pede alguns valores:
   - `ADMIN_EMAIL`: seu e-mail (para entrar no painel de moderação).
   - `ADMIN_PASSWORD`: uma senha forte, com 10 ou mais caracteres.
   - Os demais podem ficar em branco por enquanto.
5. Toque em **Apply**. Em 2 a 5 minutos o serviço fica **Live**.
6. O endereço aparece no topo, no formato `https://conexao-de-fe-xxxx.onrender.com`.

### 3. Testar
- Abra o endereço no celular, crie uma conta comum e monte um perfil.
- Peça a uma segunda pessoa para criar conta; curtam-se e conversem.
- Painel de moderação: `https://SEU-ENDERECO/admin`, com o ADMIN_EMAIL e a ADMIN_PASSWORD.
- Para instalar como app: no iPhone, Safari › Compartilhar › **Adicionar à Tela de Início**; no Android, Chrome › ⋮ › **Instalar app**.

### 4. Opcionais recomendados
| O quê | Para quê | Como |
|---|---|---|
| E-mail (Resend, grátis até 3.000/mês) | Confirmação de e-mail e "esqueci minha senha" | Crie conta em resend.com, verifique seu domínio, gere a API key e cole em `RESEND_API_KEY` no Render (Environment). Preencha `MAIL_FROM` com `Conexão de Fé <nao-responda@seudominio.com.br>`. |
| Domínio próprio (~R$ 40/ano) | Endereço como `conexaodefe.com.br` | Registre em registro.br; no Render, Settings › Custom Domains; copie os registros DNS para o Registro.br. |
| IA para biografias | Sugestões personalizadas | Gere a chave em console.anthropic.com e cole em `ANTHROPIC_API_KEY`. Sem ela, o app mostra dicas gerais. |

### 5. Antes de divulgar ao público
- Revisar Termos e Política de Privacidade com advogado (`server/public/termos.html` é um rascunho) e nomear o encarregado de dados (DPO).
- Trocar o contato da Central de ajuda em `server/src/content.js`.
- Validar o nome no INPI.
- Moderar fotos e denúncias diariamente no painel.

## Fase 2 — Lojas (Google Play e App Store)
Usa o mesmo servidor da Fase 1.
1. Contas: Google Play Console (US$ 25, pagamento único) e Apple Developer (US$ 99/ano). Ambas pedem documento; a da Apple, como empresa, pede D-U-N-S/CNPJ.
2. Em `app/app.json`, trocar `extra.apiUrl` pelo endereço do Render.
3. Num computador: `cd app && npm run setup && npx eas build -p android` e `-p ios` (conta gratuita em expo.dev).
4. Enviar com `npx eas submit`. As lojas exigem: política de privacidade publicada (`/termos`), classificação 18+, conta de teste para os revisores, exclusão de conta dentro do app (já existe) e o formulário de segurança de dados.
5. A revisão leva de alguns dias a duas semanas. Apps de relacionamento costumam receber perguntas sobre moderação; o painel `/admin` e as regras de denúncia atendem a isso.
