# Maia — Pending Tasks Only

Acompanhe aqui apenas o que ainda não foi concluído, agrupado por seção do `IMPLEMENTATION_PLAN.md`. Cada item cita arquivos/rotas relevantes e critérios de aceite.

## 0. Fundamentos e Higiene de Segredos

- **[Padronizar variáveis de ambiente (frontend)]**
  - Arquivos: `.env.example`, `.env.local`, `supabaseClient.ts`
  - Aceite: app inicia sem hardcodes; `VITE_*` preenchidas em `.env.local`.

## 2. Edge Functions: CRUD Seguro

- **[Reminders]**
  - Rotas: `GET/POST/PUT/DELETE /reminders`
  - Aceite: CRUD funcional respeitando RLS; validação (Zod) ativa.
- **[Notes]**
  - Rotas: `GET/POST/DELETE /notes` (com upsert de embeddings no POST/PUT)
  - Aceite: notas persistem e consultam corretamente; embeddings acionados.
- **[Shopping List]**
  - Rotas: `GET/POST/PUT/DELETE /shopping-list-items`
  - Aceite: operações ok com RLS; validação (Zod) ativa.

## 3. Perfil e API Key

- **[Hardening de dados]**
  - Objetivos: PII minimizada, criptografia em repouso para segredos sensíveis
  - Aceite: nenhum dado sensível em logs; acesso controlado por RLS.
- **[Autorização de Pagamentos por senha de segurança/duress]**
  - Endpoints: `payments/set-passphrase`, `payments/verify`
  - Armazenamento: Argon2id, rate limit, cooldown
  - Aceite: senha válida autoriza; duress bloqueia e audita.

## 4. Proxy em Tempo Real (WebSocket)

- **[Roteamento Multi-LLM]**
  - Suporte: Anthropic; budget por sessão
  - Arquivo: `supabase/functions/proxy-live-session/index.ts`
  - Aceite: troca de provider sem alterações no cliente.

## 5. RAG e Contexto Dinâmico

- **[Pipeline de recuperação]**
  - Keyword filter + embeddings (top-K) + memórias ativas
  - Aceite: contexto gerado por turno.
- **[Montagem de prompt]**
  - System prompt + contexto + histórico recente + query atual
  - Aceite: conforme PRD.
- **[Grounded content]**
  - Endpoint: `POST /generate-grounded-content` com citações
  - Aceite: texto + fontes normalizadas.

## 6. Chat Logging e Histórico

- **[REST fallback]**
  - Rotas: `POST /chat-history`, `GET /chat-history?limit&before`
  - Aceite: histórico paginado consultável.
- **[UI de histórico]**
  - Arquivos: `hooks/useGeminiLive.ts`, `components/ChatInterface.tsx`
  - Aceite: histórico visível/funcional com cartões de confirmação após tool-call.

## 7. Onboarding Inteligente

- **[Formulário de onboarding]**
  - Campos: identidade, rotina, preferências, locais, notificações, privacidade, assistente, metas
  - Tabelas: `profiles`/`profiles_preferences`
  - Aceite: dados salvos/editáveis.
- **[Integração com RAG]**
  - Aceite: preferências/rotina injetadas no contexto base.

## 8. Área de Administração (Perfil)

- **[Gestão de provider e chave]**
- **[Integrações (conectar/desconectar)]**
- **[Privacidade e budget]**
- **[Logs pessoais]**
  - Arquivo: `pages/ProfilePage.tsx`
  - Aceite: usuário controla seu ambiente e visualiza últimos tool-calls (sem PII).

## 9. Integrações Externas (Plugins)

- **[Tool-call handlers (voz e texto)]**
  - Spotify (playlist ops), Trello, Slack, Instagram/Twitter/Facebook postagens, Notion (bases), Gmail metadados, Alexa/Google/Home Assistant bridge
  - Aceite: comandos de voz acionam ações com confirmação no UI.
- **[Feature flags e secrets]**
  - Flags por usuário/projeto; Secrets por provider; UI de conexões e auditoria
  - Aceite: toggles/segredos configuráveis.
- **[Checklist Fase 1 — documentação e escopos]**
  - Documentar `CLIENT_ID/SECRET` e escopos efetivos por provider; validar renovação de tokens
  - Aceite: escopos mínimos/documentados; refresh configurado (quando aplicável).
- **[Fase 2]** Slack, Trello, Alexa/Google Assistant/Home Assistant, TMDB/YouTube/Maps, outros.

## 10. Observabilidade

- **[Logging estruturado]**
  - request_id, user_id hash, latência, erros (funções antigas)
  - Aceite: logs claros, sem PII.
- **[Dashboards e alertas]**
  - Supabase Logs; métricas por função/WS
  - Aceite: alertas de latência/taxa de erro configurados.

## 12. Testes

- **[Unit/Contract (Edge Functions)]**
- **[WebSocket]**
- **[Carga]**
  - Aceite: pipelines verdes; alvo <200ms (excluindo LLM).

## 13. Deploy e CI/CD

- **[Docker/nginx]**
  - `Dockerfile`, `nginx.conf` (gzip/brotli, cache, HSTS, rate limit)
- **[CI]**
  - PR checks, deploy preview (Edge Functions), promote para prod
- **[Import maps → deno.json]** (baixa prioridade)
  - Migrar por função para remover aviso deprecado.

## 14. Documentação

- **[README]**, **[PRD]**, **[Runbooks]**
  - Setup local, Supabase CLI, deploy; decisões; incidentes e rotação de segredos.

## 15. Internationalization (i18n)

- **[Frontend]**
  - Auditoria de chaves e paridade pt-BR/en/es
- **[Backend]**
  - Aceitar `x-user-lang`/`profiles.language`; mensagens localizadas
- **[Voz/ASR/TTS]**
  - Locale de STT/TTS por idioma
- **[Prompts]**
  - Prompts do sistema por idioma
- **[RAG]**
  - Embeddings multilíngues; detecção de idioma; cross-lingual
- **[Perfil]**
  - Integrar seleção de `language` na UI e backend
- **[Testes]**
  - Matriz QA pt-BR/en/es cobrindo chat, CRUD, WS, TTS/STT

---

- Referência do plano: `IMPLEMENTATION_PLAN.md`
- Plano de testes: `TEST_PLAN.md` (executar após concluir pendências por seção)
