# Plano de Implementação — Maia (Backend/Frontend)

Documento vivo para controle de execução. Marque as checkboxes conforme concluir cada item. Arquivos e critérios de aceite estão especificados por seção.

## Sumário

- [0. Fundamentos e Higiene de Segredos](#0-fundamentos-e-higiene-de-segredos)
- [1. Banco de Dados (Supabase)](#1-banco-de-dados-supabase)
- [2. Edge Functions: CRUD Seguro](#2-edge-functions-crud-seguro)
- [3. Perfil e API Key](#3-perfil-e-api-key)
- [4. Proxy em Tempo Real (WebSocket)](#4-proxy-em-tempo-real-websocket)
- [5. RAG e Contexto Dinâmico](#5-rag-e-contexto-dinâmico)
- [6. Chat Logging e Histórico](#6-chat-logging-e-histórico)
- [7. Onboarding Inteligente](#7-onboarding-inteligente)
- [8. Área de Administração (Perfil)](#8-área-de-administração-perfil)
- [9. Integrações Externas (Plugins)](#9-integrações-externas-plugins)
- [10. Observabilidade](#10-observabilidade)
- [11. Segurança e Compliance](#11-segurança-e-compliance)
- [12. Testes](#12-testes)
- [13. Deploy e CI/CD](#13-deploy-e-cicd)
- [14. Documentação](#14-documentação)
- [15. Internationalization (i18n)](#15-internationalization-i18n)
- [Critérios de Conclusão (MVP)](#critérios-de-conclusão-mvp)
- [Próximas Ações](#próximas-ações)

---

## 0. Fundamentos e Higiene de Segredos

- [x] Remover credenciais expostas do PRD
  - Arquivo: `maia/prd_backend.md`
  - Aceite: documento sem chaves; usa instruções de env.
- [x] Tipagem de env Vite
  - Arquivo: `maia/vite-env.d.ts`
  - Aceite: sem erro TS de `import.meta.env`.
- [ ] Padronizar variáveis de ambiente (frontend)
  - [x] Template criado: `.env.example`
  - [ ] Configuração local: criar `.env.local` (não versionado) com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Arquivo: `maia/supabaseClient.ts` usa `import.meta.env.VITE_*`
  - Aceite: app inicia sem hardcodes.
- [ ] Secrets (Edge Functions)
  - [x] Documentação criada: `README_SECRETS.md` com passos de `supabase secrets set`
  - [x] Definidas no projeto: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ENCRYPTION_KEY`, `GOOGLE_API_KEY`, `OPENAI_API_KEY` (funções ajustadas para fallback)
  - Aceite: nenhuma secret em repositório.

## 1. Banco de Dados (Supabase)

- [x] Ativar `pgvector`
  - Aceite: extensão ativa no projeto.
- [x] Tabela de embeddings de notas
  - Nome: `notes_embeddings(note_id uuid, content text, embedding vector(1536), created_at timestamptz)`
  - RLS: consistente com `notes` por `user_id`
  - Aceite: tabela criada e protegida.
- [x] Funções SQL
  - Upsert embeddings em INSERT/UPDATE de `notes`
  - Busca híbrida (BM25 + vetor) com top-K
  - Aceite: função retorna itens relevantes por similaridade.
  - Extra: criada base `public.notes` com RLS (owner-only) para suportar embeddings.

## 2. Edge Functions: CRUD Seguro

- [ ] Reminders
  - Endpoints: `GET/POST/PUT/DELETE /reminders`
  - Status: endpoints criados (scaffold) + validação e respostas padronizadas; frontend integrado; deploy/secrets ok.
  - Validação: Zod; auth com `auth.getUser()`
  - Aceite: CRUD funcional respeitando RLS.
- [ ] Notes
  - Endpoints: `GET/POST/DELETE /notes`
  - Status: endpoints criados (scaffold) + validação e respostas padronizadas; frontend integrado; deploy/secrets ok.
  - Ação: disparar upsert de embeddings ao criar/atualizar (ligar RPC) — concluído no POST.
  - Aceite: notas persistem e consultam corretamente.
- [ ] Shopping List
  - Endpoints: `GET/POST/PUT/DELETE /shopping-list-items`
  - Status: endpoints criados (scaffold) + validação e respostas padronizadas; frontend integrado; deploy/secrets ok.
  - Aceite: operações ok com RLS.

Arquivos alvo: `supabase/functions/<recurso>/`

## 3. Perfil e API Key

- [x] `GET /profile` e `PUT /profile`
  - Campos: `full_name`, `llm_provider`, preferências
  - Status: endpoint `profile` criado (scaffold, GET/PUT com `language`); deploy/secrets ok.
  - Aceite: usuário lê/atualiza o próprio perfil.
  - Status extra: adicionados botões de conexão em `pages/ProfilePage.tsx` para Google, Notion, Spotify e Meta (iniciam OAuth via `/functions/v1/oauth-<provider>/start`).
  - Status extra: endpoints backend criados para conexões — `oauth-status` (GET) e `oauth-disconnect` (DELETE); UI deve usar estes em vez de acessar `public.oauth_tokens` direto.
- [x] Coluna `profiles.language`
  - SQL: `supabase/sql/02_profiles_language.sql` (adiciona `language` com check pt-BR/en/es)
  - Status: script executado no projeto; RLS e política aplicadas
- [ ] Hardening de dados
  - PII minimizada, criptografia em repouso para segredos sensíveis
  - Aceite: nenhum dado sensível em logs; acesso controlado por RLS
- [ ] Autorização de Pagamentos por senha de segurança
  - Requisito: definir uma senha de segurança (via chat ou áudio) para autorizar pagamentos iniciados pela Maia (Wallet via PSP)
  - Requisito: definir uma "senha de coação" (duress) que libera acesso, mas NÃO conclui operações e dispara alerta silencioso/auditoria reforçada
  - Armazenamento: hashes com sal (ex.: Argon2id), rate limit por usuário e cooldown após falhas
  - Fluxo: antes de confirmar cobrança, Maia solicita senha; em voz, usar ASR local ou provider com verificação adicional
  - Aceite: somente após senha válida a operação é confirmada; duress impede execução e registra evento

## 4. Proxy em Tempo Real (WebSocket)

- [x] Autenticação e ciclo de vida
  - Handshake com JWT; heartbeats; timeout; backpressure; rate limit por usuário
  - Aceite: sessões estáveis e limpeza correta de recursos.
  - Status extra: implementados heartbeat (ping/pong), idle-timeout (30s), rate limiting (120 msgs/min) e backpressure básico em `supabase/functions/proxy-live-session/index.ts`.
- [ ] Roteamento Multi-LLM
  - Seleção por `llm_provider`; fallback; budget por sessão
  - Aceite: troca de provider sem alterações no cliente.
  - Status: suporte ativo para `gemini` e `openai`; `anthropic` pendente.

Arquivo: `supabase/functions/proxy-live-session/`

## 5. RAG e Contexto Dinâmico

- [ ] Pipeline de recuperação
  - Keyword filter + embeddings (top-K) + “memórias ativas” (lembretes de hoje/alta prioridade)
  - Aceite: contexto gerado por turno.
- [ ] Montagem de prompt
  - System prompt + contexto + histórico recente + query atual
  - Aceite: prompt conforme PRD.
- [ ] Grounded content
  - Endpoint: `POST /generate-grounded-content` com citações
  - Aceite: texto + fontes normalizadas.

Arquivo: `supabase/functions/generate-grounded-content/`

## 6. Chat Logging e Histórico

- [x] Persistência no WS
  - `proxy-live-session`: salvar mensagens `user/maia/system` em `chat_history`
  - Aceite: cada turno armazenado.
- [ ] REST fallback
  - `POST /chat-history`, `GET /chat-history?limit&before`
  - Status: endpoint `chat-history` criado (scaffold, POST/GET paginado); deploy/secrets ok.
  - Aceite: histórico paginado consultável.
  - Observação: tool-calls de integrações (Calendar/Gmail/Notion/Spotify/Meta) serão registrados para auditoria.
- [ ] UI
  - `hooks/useGeminiLive.ts`: carregar histórico inicial; salvar mensagens finais
  - `components/ChatInterface.tsx`: cartões de confirmação após tool-call
  - Aceite: histórico visível/funcional.

## 7. Onboarding Inteligente

- [ ] Formulário de onboarding
  - Campos: identidade, rotina, preferências, locais, notificações, privacidade, assistente, metas
  - Tabelas: `profiles` e/ou `profiles_preferences`
  - Aceite: dados salvos e editáveis.
- [ ] Integração com RAG
  - Injetar preferências/rotina no contexto base
  - Aceite: respostas mais pessoais.

Arquivos: `pages/ProfilePage.tsx` ou `pages/OnboardingPage.tsx`

## 8. Área de Administração (Perfil)

- [ ] Gestão de provider e chave
  - `llm_provider` e status de chave (salva/pendente)
- [ ] Integrações
  - Conectar/desconectar (Spotify, Google, Trello)
- [ ] Privacidade e budget
  - Retenção, export/delete data, budget mensal
- [ ] Logs pessoais
  - Últimos tool-calls (sem PII)
- Aceite: usuário controla seu ambiente.

Arquivo: `pages/ProfilePage.tsx`

## 9. Integrações Externas (Plugins)

- [x] Infra OAuth
  - `/oauth/{provider}/start` e `/oauth/{provider}/callback`
  - Tabela `oauth_tokens(user_id, provider, access_token, refresh_token, expires_at, scope)`
  - Scopes por provider documentados
  - Webhooks/callbacks quando aplicável (ex.: Slack Events, Trello, Meta/Instagram)
  - Aceite: tokens armazenados com segurança e renovação automática (refresh)
  - Status: OAuth Functions criadas e deployadas — `oauth-google`, `oauth-notion`, `oauth-spotify`, `oauth-meta` (Instagram/Facebook)
  - Próximo: adicionar botões na `pages/ProfilePage.tsx` — “Conectar Google/Notion/Spotify/Meta”; implementar handlers mínimos por provedor
  - Status extra: botões adicionados na UI; handlers Google criados e deployados — `integrations-google-calendar`, `integrations-gmail`
  - Status extra: handlers criados e deployados — `integrations-notion` (createPage/appendBlock), `integrations-spotify` (play/pause/next/searchTrack), `integrations-facebook` (post), `integrations-instagram` (postInstagramPhoto)
- **Fase 1 (prioritárias)**: Notion, Google Calendar, Spotify, Instagram, Facebook, Gmail — concluídas (handlers e deploys)
- **Fase 2**: Slack, Trello, Alexa/Google Assistant/Home Assistant, TMDB/YouTube/Maps, outros
- [ ] Tool-call handlers (voz e texto)
  - Spotify: play/pause/next/playlist/search
  - Google Calendar: criar/listar eventos
  - Trello: criar cards/listas, mover, comentar
  - Slack: enviar mensagens a canais/DMs
  - Instagram/Twitter(FKA X)/Facebook: postar conteúdo básico (quando APIs permitirem)
  - Notion: criar páginas/notes, anexar a bases
  - Gmail: enviar emails, listar não lidos (somente metadados)
  - Alexa/Google Assistant/Home Assistant: criar bridge para rotas de automação (rotinas)
  - Outros: TMDB, YouTube, Maps, etc. conforme necessidade
  - Aceite: comandos de voz acionam ações com confirmação no UI
  - Status extra: Google Calendar e Gmail concluídos; Notion/Spotify/Instagram/Facebook concluídos (Edge Functions ativas)

### Busca, Locais e Rotas

- [x] `web-search` — provedor configurável (Google CSE/Bing); secrets e deploy concluídos
- [x] `places-search` — Google Places/Mapbox; deploy concluído
- [x] `routes` — Google Directions/Mapbox; deploy concluído
- [ ] Feature flags e secrets
  - Flags por usuário/projeto (ex.: `VITE_ENABLE_SPOTIFY`, etc.)
  - Secrets por provider via Supabase Secrets (server-side)
  - UI de conexões em `ProfilePage` (conectar/desconectar)
  - Logs sem PII, auditoria de tool-calls

Checklist específico da Fase 1:
- [ ] Notion: `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`; escopos `pages:read`, `pages:write`, `databases:read`; handlers `createNotionPage`, `appendNotionBlock`.
- [ ] Google Calendar: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; escopos `calendar.events.readonly`, `calendar.events`; handlers `createEvent`, `listEvents`.
- [ ] Spotify: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`; escopos `user-read-playback-state`, `user-modify-playback-state`, `playlist-modify-private`; handlers `play`, `pause`, `next`, `searchTrack`.
- [ ] Instagram/Facebook (Meta): `META_APP_ID`, `META_APP_SECRET`; escopos IG `instagram_basic`, `pages_show_list`; FB `pages_manage_posts`, `pages_read_engagement`; handlers `postInstagramPhoto`, `postFacebookFeed`.
- [ ] Gmail: usa `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`; escopos `gmail.send`, `gmail.readonly` (mínimos); handlers `sendEmail`, `listUnread`.

## 10. Observabilidade

- [ ] Logging estruturado
  - request_id, user_id hash, latência, erros
  - Aceite: logs claros, sem PII.
- [ ] Dashboards e alertas
  - Supabase Logs; métricas por função e WS
  - Aceite: alertas de latência/taxa de erro configurados.
  - Status extra: `request_id` presente em todas as funções criadas hoje; ampliar dashboards.

## 11. Segurança e Compliance

- [ ] Validação de entrada
  - Zod em todas as funções
- [ ] Content filters
  - Antes de tool-calls sensíveis
- [ ] Rate limiting
  - Por IP/usuário
- [ ] RLS e testes
  - Verificar políticas e tentativas de quebra
- Aceite: testes de segurança passando.

## 12. Testes

- [ ] Unit/Contract (Edge Functions)
  - Sucesso/erro, validação, auth
- [ ] WebSocket
  - Conexão, reconexão, barge-in, backpressure
- [ ] Carga
  - WS e funções; alvo <200ms (excluindo LLM)
- Aceite: pipelines de teste verdes.
 - Status extra: criado `TEST_PLAN.md` com suíte procedural (cURLs e critérios de aceite) para todas as funções/integrações/WS.

## 13. Deploy e CI/CD

- [ ] Docker/nginx
  - Completar `Dockerfile` e `nginx.conf` (gzip/brotli, cache, HSTS, rate limit)
- [x] Scripts Supabase
  - Deploy de funções por ambiente
  - Status: deploys via CLI executados e verificados; pendente migration de import maps para `deno.json`.
- [ ] CI
  - PR checks, deploy preview (Edge Functions), promote para prod
- Aceite: pipeline estável com revisão.

## 14. Documentação

- [ ] README
  - Setup local, `.env.local`, Supabase CLI, deploy
- [ ] PRD
  - Status e decisões; links para dashboards/endpoints
- [ ] Runbooks
  - Incidentes comuns, rotacionar segredos, rollback

---

## 15. Internationalization (i18n)

- [ ] Frontend
  - Auditoria de chaves em `translations.ts` e uso de `useLanguage()`
  - Paridade de textos pt-BR, en, es
- [ ] Backend
  - Edge Functions e `proxy-live-session` aceitam `x-user-lang` e/ou leem `profiles.language`
  - Mensagens de erro/sucesso localizadas onde aplicável
- [ ] Voz/ASR/TTS
  - Selecionar locale de STT/TTS e parâmetros por idioma
- [ ] Prompts
  - Manter prompts do sistema por idioma e selecionar por `profiles.language`
- [ ] RAG
  - Embeddings multilíngues; detecção de idioma em notas; recuperação cross-lingual
- [ ] Perfil
  - Campo `language` em `profiles` e UI em `ProfilePage`
  - DB: coluna preparada via `02_profiles_language.sql` (pendente execução)
- [ ] Testes
  - Matriz de QA pt-BR/en/es cobrindo chat, CRUD, WS, TTS/STT

## Critérios de Conclusão (MVP)

- [ ] CRUD seguro operante com RLS
- [ ] Proxy WS com auth, estabilidade e latência alvo (<200ms excl. LLM)
- [ ] Histórico de chat persistido e visível no UI
- [ ] RAG básico funcional (keyword + vetor)
- [ ] Onboarding com preferências afetando contexto
- [ ] Deploy/CI estáveis; sem segredos no repo

## Próximas Ações

- **[UI Conexões]** Atualizar `pages/ProfilePage.tsx` para usar `oauth-status`/`oauth-disconnect` (status e desconectar) e remover acesso direto à tabela.
- **[Cliente WS]** Responder `pong` aos `ping` do servidor para evitar idle-timeout; validar limites de mensagem no cliente.
- **[Import maps]** (Baixa prioridade) Migrar por função de `import_map.json` para `deno.json` conforme aviso do CLI.
- **[Testes]** Executar `TEST_PLAN.md` e coletar `request_id`/logs; abrir issues para falhas.
- **[Pagamentos]** Implementar endpoints `payments/set-passphrase` e `payments/verify` (senha de segurança e duress); integrar com PSP (Stripe) e auditar eventos.
