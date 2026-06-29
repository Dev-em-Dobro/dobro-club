# Spec — Story 8.1: Inscrição + Magic Link (entrada sem fricção)

> **Produto:** Dobro Club · **Epic:** 8 · **Story:** 8.1 · **Status:** Draft (SDD)
> **Data:** 2026-06-29 · **Origem:** `epic-8-plataforma-evento-lancamento.md` (Story 8.1) + `estrategia-evento-experiencia-scale-club.md`
> **Stack:** greenfield neste repo — React+Vite (front) + Express `server.js` :3001 (back), storage em arquivo via camada de dados isolada.

---

## 1. Objetivo

Permitir que um lead entre no ambiente do evento **com um clique, já logado, sem senha**, e **continue logado** nas visitas seguintes. É a fundação de acesso de todo o Epic 8 — nenhuma outra story funciona sem ela.

**Por que importa (estratégia):** o magic link elimina a fricção de login (funciona até para público 45–60+), e o **mesmo link** é reenviado no WhatsApp/e-mail dia após dia ("clique aqui pra assistir a aula 1") sem o lead precisar lembrar de nada.

---

## 2. Decisões desta spec (definidas no brainstorming)

| Decisão | Escolha | Consequência |
|---|---|---|
| Base de código | Greenfield neste repo, stack do epic | A spec define a estrutura de pastas inicial |
| Modelo do link | **Reutilizável, longevo, revogável** | Token sem expiração automática; revogável pelo admin |
| Arquitetura do token | **Token opaco com estado** (Abordagem A) | Revogação é operação de 1ª classe; sem segredo de cripto a rotacionar |
| Persistência | Arquivo (`fsLib`/`pathLib`) atrás de camada isolada | Trocar por SQLite depois não toca a regra de negócio |
| Captação | **Externa ao sistema** (evento gratuito no MVP) | Nosso front **não** tem formulário; recebemos o lead via API |

> ⚠️ **Supersede o epic:** a Story 8.1 do epic citava "token assinado" e "página de captação" própria. Esta spec refina para **token opaco armazenado** e **captação externa via API de ingestão**. O epic foi alinhado.

---

## 3. Escopo

**Dentro:**
- Endpoint de **ingestão de lead** chamado pela página de captação externa.
- Geração de **token opaco** único por lead + montagem do `magicLink`.
- **Disparo do webhook de inscrição** com o `magicLink` (para automação reusar no WhatsApp).
- Rota de **entrada** (`/entrar/:token`) → sessão persistente → redireciona pra home do evento.
- `GET /api/me` para o `AuthContext` do front.
- **Revogação** de acesso por lead (admin/API).
- A **casca** da home do evento (layout logado vazio que as outras stories preenchem).

**Fora (com costura preparada):**
- UI da página de captação (vive fora do sistema).
- Checkout pago (Ticto/Hubla) — fase posterior.
- Motor de envio de e-mail/WhatsApp (Story 8.11 / automação externa) — aqui só devolvemos o link e disparamos webhook.
- Pesquisa-gate (8.2), conteúdo/aulas (8.4) — a casca logada só os hospeda depois.

---

## 4. Fronteira de integração

```
[Página de captação EXTERNA]
        │  (lead preenche nome/email/telefone)
        ▼
POST /api/events/:eventId/leads        (auth: X-Api-Key do evento)
        │
        ▼
[Dobro Club]  cria lead + token  ──►  responde { magicLink, leadId }
        │
        └─► dispara WEBHOOK de inscrição { event, lead, magicLink }
                    │
                    ▼
        [Automação externa: e-mail / WhatsApp entrega o magicLink]
                    │  lead clica
                    ▼
        GET /entrar/:token  ──►  seta cookie de sessão  ──►  redirect /e/:slug (home logada)
```

A entrega do link (e-mail/WhatsApp) é responsabilidade do sistema externo; o Dobro Club expõe o link de duas formas: na **resposta** da ingestão e no **payload do webhook**.

---

## 5. Modelo de dados (arquivos)

```
data/
  events/
    {eventId}.json              # config do evento
    {eventId}/leads.json        # array de leads do evento
  tokens/
    index.json                  # mapa token -> { leadId, eventId }  (lookup O(1))
```

**Event** (`{eventId}.json`):
```json
{ "id": "evt_abc", "slug": "node-dezembro", "name": "Desafio Node",
  "status": "active", "apiKeyHash": "<hash>", "webhookUrl": "https://...",
  "createdAt": "2026-06-29T12:00:00Z" }
```

**Lead** (item de `leads.json`):
```json
{ "id": "lead_123", "eventId": "evt_abc",
  "name": "Diego F.", "email": "d@x.com", "phone": "+5511...",
  "token": "<base64url-43>", "source": "captacao-externa",
  "revoked": false, "createdAt": "...", "lastSeenAt": "..." }
```

- **Toda** leitura/escrita passa por `server/data/store.js` (escrita atômica: grava em `.tmp` + rename) → seam para migrar a SQLite sem mudar a regra.
- Apenas o **hash** da API key do evento é persistido (a chave em claro é entregue ao integrador uma vez).

---

## 6. Contratos de API

### `POST /api/events/:eventId/leads`  (ingestão — captação externa)
- **Auth:** header `X-Api-Key` (validado contra `apiKeyHash` do evento). 401 se inválida.
- **Body:** `{ name, email, phone }` (email **ou** phone obrigatório).
- **Idempotência:** se já existe lead com mesmo email/phone no evento → **retorna o mesmo lead/token** (não duplica, não gera link novo).
- **200:** `{ leadId, magicLink, isNew: true|false }`.
- **Efeito colateral:** dispara webhook de inscrição (best-effort, com retry simples).
- **Erros:** 400 (validação), 401 (api key), 404 (evento inexistente), 409 não se aplica (idempotente).

### `GET /entrar/:token`  (entrada — clique do lead)
- Valida token no `tokens/index.json` → lead.
- Se válido e **não revogado**: seta cookie `dc_session`, atualiza `lastSeenAt`, **302** para `/e/{slug}`.
- Se inválido/revogado: **302** para `/e/{slug}/link-invalido` (tela amigável "pedir novo link").
- Idempotente: clicar 10 vezes → 10 entradas válidas (link reutilizável).

### `GET /api/me`  (estado de sessão para o front)
- Lê e valida cookie `dc_session`.
- **200:** `{ leadId, name, eventId }` · **401:** sem/sessão inválida.

### `POST /api/auth/logout` *(opcional no MVP)*
- Limpa o cookie. (Raro — o objetivo é manter logado.)

### Webhook de inscrição (saída)
- `POST {event.webhookUrl}` body `{ type:"lead.created", event:{id,slug}, lead:{id,name,email,phone}, magicLink }`.

---

## 7. Token & Sessão

- **Token:** `crypto.randomBytes(32)` → base64url (~43 chars). Opaco, não-adivinhável. **Sem expiração automática** (MVP). Único por lead.
- **`magicLink`:** `https://{host}/entrar/{token}`.
- **Revogação:** `lead.revoked = true` → `/entrar` passa a rejeitar; sessões existentes invalidadas na próxima checagem de `/api/me` (que confere `revoked`).
- **Cookie de sessão `dc_session`:** valor assinado (HMAC, segredo do servidor) contendo `leadId+eventId`; flags `HttpOnly`, `Secure`, `SameSite=Lax`, `maxAge` longo (ex.: 180 dias) → "fica logado". A sessão evita reconsultar o token a cada navegação; o token só é tocado na entrada.

---

## 8. Fluxos

**Feliz:** captação externa → `POST /leads` → link devolvido + webhook → automação envia → lead clica → cookie setado → home do evento logada. Dias depois: mesmo link (ou cookie ainda válido) → segue logado.

**Erros:**
- Token desconhecido/revogado → tela `link-invalido` com ação "pedir novo link".
- Sem cookie e acessa rota logada direto → front chama `/api/me` → 401 → orienta a usar o link.
- Webhook falha → log + retry; **não** bloqueia a resposta da ingestão (o link já está na resposta).

---

## 9. UX — mobile-first premium (não-negociável)

A entrada é a 1ª impressão do evento; precisa ser impecável **no celular** (375–430px).

- **Entrada instantânea:** clicar no link do WhatsApp abre **direto** na home logada — sem interstitial, sem tela de senha, sem "pulo" de spinner. Se houver microcarga, transição suave (fade rápido), nunca layout shift.
- **Casca da home logada:** coluna única, navegação inferior (bottom-nav) com os itens do participante (Aulas, Comunidade, Feed, Ingresso, Indicações, Certificado) como *placeholders* desabilitados nesta story; safe-areas respeitadas; sem scroll horizontal.
- **Estados de erro** (link inválido/revogado): centrados, tom acolhedor, botão grande "pedir novo link".
- **Alvos de toque** ≥ 44px; tipografia legível; contraste no tema dark.
- **Orçamento de performance:** entrada interativa < 2,5s em 4G mediano; sem CLS perceptível.

---

## 10. Segurança

- Token via CSPRNG, opaco, fora de logs/URLs analíticas.
- Cookie assinado, `HttpOnly`/`Secure`/`SameSite=Lax`.
- **Rate-limit** em `POST /leads` (por API key/IP) e em `/entrar/:token` (anti-brute-force de token).
- API key por evento (apenas hash persistido); HTTPS obrigatório em produção.
- **O link É a credencial** (modelo aceito): mitigado por ser **revogável**, por não expor PII além do próprio evento e por rate-limit. Documentar para o cliente.

---

## 11. Critérios de aceite (mapeados ao epic 8.1)

- [ ] Lead ingerido via **API** a partir da captação externa (evento gratuito); checkout pago fora do MVP (costura pronta).
- [ ] Geração de **magic link único por lead** (token opaco armazenado, **revogável**, sem senha).
- [ ] Link disponível na **resposta da ingestão** e no **webhook de inscrição** (reuso em e-mail/WhatsApp).
- [ ] Ao clicar, usuário entra **já logado**; clique repetido continua válido (reutilizável).
- [ ] **Sessão persistida** no navegador (mantém login até limpar cookies).
- [ ] **Revogação** por lead funciona (acesso negado após revogar).
- [ ] Ingestão é **idempotente** por email/telefone (não duplica lead).
- [ ] Entrada e estados de erro **validados no mobile** (premium, sem fricção), incl. público leigo.

---

## 12. Testes (TDD)

**Unit**
- token: gera 43 chars base64url únicos; verifica conhecido; rejeita desconhecido.
- sessão: assina/valida cookie; rejeita assinatura adulterada.
- revogação: lead `revoked` → `/entrar` e `/api/me` negam.

**Integração**
- `POST /leads` cria lead+token, retorna `magicLink`, dispara webhook.
- `POST /leads` repetido (mesmo email) → idempotente (mesmo token, `isNew:false`).
- `POST /leads` sem/own API key errada → 401.
- `GET /entrar/:token` válido → seta cookie + 302 pra home; inválido → 302 pra `link-invalido`.
- `GET /api/me` com cookie → 200 lead; sem cookie → 401.

**Camada de dados**
- Escrita atômica (tmp+rename); dois `signup` concorrentes não corrompem `leads.json`.

---

## 13. Costuras para o futuro (não implementar agora)

- **Checkout pago:** `POST /leads` aceitará `source:"checkout"` e payload do Ticto/Hubla.
- **Motor de e-mail (8.11):** hoje só webhook; depois, envio nativo reusando o `magicLink`.
- **Pesquisa-gate (8.2):** a home logada redirecionará para a pesquisa antes de liberar conteúdo.

---

## 14. Perguntas em aberto

- **Gestão da API key de ingestão:** por evento (recomendado, isola e revoga por evento) vs. global. **Proposto:** por evento.
- **Host/domínio do `magicLink`** no piloto (subdomínio próprio vs. domínio do cliente) — decidir junto da 8.9 (tema/domínio).
