# Maia Test Plan

Este plano lista testes procedurais para as Edge Functions, integrações, UI e WebSocket. Execute após concluir a implantação. Use tokens de usuário reais (Authorization: Bearer <USER_ACCESS_TOKEN>).

- Projeto: `xsxdgcupzggofdkmhkmc`
- Base URL: `https://xsxdgcupzggofdkmhkmc.supabase.co/functions/v1`
- Critério geral de aceite: HTTP 2xx, corpo JSON com `error: null` e campos esperados. Em falhas, erro informativo e código apropriado.

## 0. Preparação

- **[verificar secrets]**
  - Web Search (CSE): `WEB_SEARCH_PROVIDER=google_cse`, `GOOGLE_CSE_CX`, `GOOGLE_CSE_API_KEY` (ou `GOOGLE_API_KEY`).
  - Maps: `MAPS_PROVIDER=google|mapbox`, `GOOGLE_MAPS_API_KEY` ou `MAPBOX_ACCESS_TOKEN`.
  - OAuth: Google/Notion/Spotify/Meta (client IDs/secret no provedor e tokens na tabela `public.oauth_tokens`).
- **[validar autenticação]**
  - Obter `<USER_ACCESS_TOKEN>` via login do app. 
  - Aceite: token válido retorna 200 em rotas protegidas.
 - **[Anthropic provider]**
   - Se `profiles.llm_provider='anthropic'`, garantir que `profiles.encrypted_api_key` seja uma chave válida da Anthropic (ou configurar `ANTHROPIC_API_KEY` via secret como fallback).

## 1. Profile

- **[GET /profile]**
```bash
curl -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  "$BASE/profile"
```
- Esperado: `data` com `full_name`, `llm_provider`, `language`.
- **[PUT /profile]**
```bash
curl -X PUT -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"full_name":"Teste QA","llm_provider":"gemini","language":"pt-BR"}' \
  "$BASE/profile"
```
- Aceite: atualização reflete no próximo GET.

## 2. Notes

- **[POST /notes]** criar nota
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"content":"nota de teste"}' \
  "$BASE/notes"
```
- Esperado: id gerado; GET lista contém a nota.

## 3. Reminders

- **[POST /reminders]** criar lembrete
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"task":"levar o lixo","dueDate":"2025-10-20"}' \
  "$BASE/reminders"
```
- Esperado: lembrete criado; GET lista contém.

## 4. Shopping List Items

- **[POST /shopping-list-items]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"item":"café","quantity":2}' \
  "$BASE/shopping-list-items"
```
- Aceite: item aparece na listagem.

## 5. Chat History

- **[POST /chat-history]** registrar
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"speaker":"user","text":"mensagem de teste"}' \
  "$BASE/chat-history"
```
- **[GET /chat-history?limit=5]**
```bash
curl -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  "$BASE/chat-history?limit=5"
```
- Aceite: paginação funcional; sem PII em logs.

## 6. OAuth Status/Disconnect

- **[GET /oauth-status]**
```bash
curl -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  "$BASE/oauth-status"
```
- Esperado: `{ google, notion, spotify, meta }` booleanos.
- **[DELETE /oauth-disconnect]**
```bash
curl -X DELETE -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"provider":"spotify"}' \
  "$BASE/oauth-disconnect"
```
- Aceite: provider selecionado fica falso no status.

## 7. Web Search

- **[GET /web-search]** CSE
```bash
curl -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  "$BASE/web-search?q=melhor+cafeteria+sp&num=5&lang=pt"
```
- Esperado: `items[]` com `title`, `link`, `snippet`.

## 8. Places Search

- **[GET /places-search]**
```bash
curl -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  "$BASE/places-search?q=restaurantes&lat=-23.5505&lng=-46.6333&limit=5"
```
- Aceite: lista de locais com nome, endereço e coordenadas (conforme provedor).

## 9. Routes

- **[POST /routes]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"origin":{"lat":-23.5505,"lng":-46.6333},"destination":{"lat":-23.5617,"lng":-46.6559},"mode":"driving"}' \
  "$BASE/routes"
```
- Aceite: `distance_meters`, `duration_seconds`, `polyline`, `legs[]`.

## 10. Google Calendar (integrations-google-calendar)

- **[GET]** listar futuro próximo
```bash
curl -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  "$BASE/integrations-google-calendar"
```
- **[POST]** criar evento
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"title":"Reunião QA","date":"2025-10-20","time":"14:00","durationMinutes":30}' \
  "$BASE/integrations-google-calendar"
```
- Aceite: evento aparece no calendário da conta conectada.

## 11. Gmail (integrations-gmail)

- **[GET]** não lidos
```bash
curl -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  "$BASE/integrations-gmail?type=unread"
```
- **[POST]** enviar e-mail
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"recipient":"you@example.com","subject":"Teste Maia","body":"Olá"}' \
  "$BASE/integrations-gmail"
```
- Aceite: mensagem enviada com sucesso; GET mostra metadados.

## 12. Notion (integrations-notion)

- **[POST createPage]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"action":"createPage","database_id":"<DB_ID>","title":"Teste","properties":{"Name":{"title":[{"text":{"content":"Teste"}}]}}}' \
  "$BASE/integrations-notion"
```
- **[POST appendBlock]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"action":"appendBlock","block_id":"<BLOCK_ID>","children":[{"paragraph":{"rich_text":[{"text":{"content":"Olá Notion"}}]}}]}' \
  "$BASE/integrations-notion"
```
- Aceite: página criada e bloco anexado com sucesso.

## 13. Spotify (integrations-spotify)

- **[POST searchTrack]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"action":"searchTrack","q":"Daft Punk Harder Better"}' \
  "$BASE/integrations-spotify"
```
- **[POST play]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"action":"play","uri":"spotify:track:4uLU6hMCjMI75M1A2tKUQC"}' \
  "$BASE/integrations-spotify"
```
- **[POST pause]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"action":"pause"}' \
  "$BASE/integrations-spotify"
```
- Aceite: reprodução controla dispositivo ativo; busca retorna resultados.

## 14. Facebook (integrations-facebook)

- **[POST post]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"action":"post","message":"Post via Maia","link":"https://example.com"}' \
  "$BASE/integrations-facebook"
```
- Aceite: post criado na conta/página com permissões adequadas.

## 15. Instagram (integrations-instagram)

- Requisitos: conta Instagram Business/Creator vinculada a uma Página do Facebook, permissões adequadas.
- **[POST postInstagramPhoto]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"action":"postInstagramPhoto","image_url":"https://example.com/image.jpg","caption":"Foto via Maia"}' \
  "$BASE/integrations-instagram"
```
- Aceite: mídia publicada com sucesso.

## 16. WebSocket (proxy-live-session)

- Cliente deve enviar `auth` com token e responder pings com `pong`.
- **[Conectar]**
  - Abrir WS para `$BASE/proxy-live-session` e enviar:
```json
{"type":"auth","token":"<USER_ACCESS_TOKEN>"}
```
- Esperado: `{"type":"connectionReady"}` e pings periódicos: `{"type":"ping"}`.
- **[Pong]**
  - Responder `{"type":"pong"}` ao ping; conexão permanece ativa.
- **[Rate limit]**
  - Enviar >120 mensagens em 1 min → servidor retorna `rate_limit_exceeded` e ignora excesso.
- **[Backpressure]**
  - Em redes lentas, servidor reduz envios de `audio/transcription` quando o buffer está alto.
- **[Encerramento]**
  - Sem pong por 30s → servidor fecha conexão por idle timeout.
 - **[Budget por sessão]** (se habilitado)
  - Defina prompts longos até exceder o budget configurado → servidor retorna erro `budget_exceeded` e encerra ou ignora novas mensagens.

## 19. Grounded Content (RAG)

- **[POST /generate-grounded-content]** inclui persona/relacionamento/notas/conhecimento
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{
    "query":"Qual a melhor rotina matinal pra mim?",
    "notes_like_limit":5,
    "knowledge_like_limit":5
  }' \
  "$BASE/generate-grounded-content"
```
- Esperado: `{ text, citations[] }` onde `citations` pode conter tipos `assistant_profile`, `relationship_context`, `note`, `knowledge` e fontes web.
- Aceite: resposta coerente, citações incluem trechos relevantes do contexto do usuário.

## 20. Assistant Onboarding

- **[POST /create-assistant-profile]** gerar seed a partir da descrição
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{
    "name":"Maia",
    "description":"Assistente empática, curiosa, estilo acolhedor; visual minimalista",
    "traits":{"tone":"acolhedor"}
  }' \
  "$BASE/create-assistant-profile"
```
- Esperado: `assistant` com `seed` JSON estruturado.
- **[POST /update-assistant-profile]** atualizar campos
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"id":"<ASSISTANT_ID>","motivations":"ajudar rotina"}' \
  "$BASE/update-assistant-profile"
```
- **[POST /generate-assistant-image]** gerar imagem via seed
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"assistant_id":"<ASSISTANT_ID>"}' \
  "$BASE/generate-assistant-image"
```
- **[GET /get-assistant-context]** contexto agregado
```bash
curl -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  "$BASE/get-assistant-context"
```
- Aceite: contexto retorna `assistant{...}` e `relationship` (se existir).

## 21. User Knowledge (CRUD simples)

- **[POST /upsert-user-knowledge]** criar
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"title":"Minhas preferências de café","content":"Prefiro espresso curto, sem açúcar."}' \
  "$BASE/upsert-user-knowledge"
```
- **[GET /list-user-knowledge?q=café&limit=5]**
```bash
curl -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  "$BASE/list-user-knowledge?q=caf%C3%A9&limit=5"
```
- Aceite: itens retornados e usados como `citations` em `generate-grounded-content` quando relevantes.

## 22. WS Logging (Histórico via WebSocket)

- Iniciar sessão WS (Gemini/OpenAI/Anthropic), falar uma frase curta.
- Validar em `chat_history` pelo Dashboard:
  - Inserção `speaker='user'` com `meta.session_id` e `meta.provider`.
  - Inserção `speaker='maia'` com texto final e `meta` correspondente.
- Aceite: logs consistentes em todos os provedores.

## 23. Onboarding Preferences

- **[GET /get-onboarding-preferences]**
```bash
curl -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  "$BASE/get-onboarding-preferences"
```
- Esperado: `{ preferences: { identidade, rotina, preferencias, locais, notificacoes, privacidade, assistente, metas, ... } | null }` sem dados sensíveis expostos indevidamente.

- **[POST /update-onboarding-preferences]** upsert
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{
    "identidade": { "nome_preferido": "Sergio" },
    "rotina": { "acorda": "06:30" },
    "preferencias": { "cafe": "espresso" },
    "locais": { "casa": { "lat": -23.5, "lng": -46.6 } },
    "notificacoes": { "silencio_noite": true },
    "privacidade": { "compartilhar_dados": false },
    "assistente": { "tom": "acolhedor" },
    "metas": { "saude": "correr 3x semana" }
  }' \
  "$BASE/update-onboarding-preferences"
```
- Aceite: 200 com objeto atualizado; GET subsequente reflete mudanças.

## 24. Admin Area (Profile)

- **[GET /get-profile-admin]**
```bash
curl -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  "$BASE/get-profile-admin"
```
- Esperado: `{ llm_provider, api_key_set, privacidade, assistente }`.

- **[POST /update-profile-admin]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{
    "llm_provider":"anthropic",
    "api_key_plain":"sk-ant-...",
    "privacidade": { "compartilhar_dados": false },
    "assistente": { "tom": "acolhedor" }
  }' \
  "$BASE/update-profile-admin"
```
- Aceite: 200 `{ ok: true }`; GET subsequente mostra `llm_provider` atualizado e `api_key_set: true`. Preferências refletidas em `profiles_preferences`.

## 25. Plugins Dispatcher (Integrações Unificadas)

- **[POST /plugins-dispatch] Spotify searchTrack**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"provider":"spotify","action":"searchTrack","payload":{"q":"Daft Punk Harder Better"}}' \
  "$BASE/plugins-dispatch"
```
- **[POST /plugins-dispatch] Notion createPage**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"provider":"notion","action":"createPage","payload":{"database_id":"<DB_ID>","title":"Teste"}}' \
  "$BASE/plugins-dispatch"
```
- **[POST /plugins-dispatch] Gmail send**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"provider":"gmail","action":"send","payload":{"recipient":"you@example.com","subject":"Oi","body":"Mensagem"}}' \
  "$BASE/plugins-dispatch"
```
- **[POST /plugins-dispatch] Facebook post**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"provider":"facebook","action":"post","payload":{"message":"Post via Maia"}}' \
  "$BASE/plugins-dispatch"
```
- **[POST /plugins-dispatch] Instagram postInstagramPhoto**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"provider":"instagram","action":"postInstagramPhoto","payload":{"image_url":"https://example.com/image.jpg","caption":"Legenda"}}' \
  "$BASE/plugins-dispatch"
```
- **[POST /plugins-dispatch] Google Calendar list (GET interno)**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"provider":"google_calendar","action":"list","payload":{}}' \
  "$BASE/plugins-dispatch"
```
- **[POST /plugins-dispatch] Web Search**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"provider":"web_search","payload":{"q":"cafeterias sp","num":5}}' \
  "$BASE/plugins-dispatch"
```
- **[POST /plugins-dispatch] Places Search**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"provider":"places_search","payload":{"q":"restaurantes","lat":-23.55,"lng":-46.63,"limit":5}}' \
  "$BASE/plugins-dispatch"
```
- **[POST /plugins-dispatch] Routes**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"provider":"routes","payload":{"origin":{"lat":-23.55,"lng":-46.63},"destination":{"lat":-23.5617,"lng":-46.6559},"mode":"driving"}}' \
  "$BASE/plugins-dispatch"
```
- Aceite: `{ ok: true, result: ... }` em cada chamada; erros informativos em casos inválidos.

## 26. WS Tool-Calls via Dispatcher

- Conectar ao WS e provocar uma tool-call (ex.: comando de voz para tocar música).
- Esperado:
  - Mensagem `toolCall` recebida no cliente contendo `{ name, args }`.
  - Servidor executa `plugins-dispatch` e envia `toolResult` com `{ ok, result }`.
  - Inserções em `chat_history` com `meta.tool` contendo `{ name, ok }` e `meta.provider`.

## 27. Internationalization (i18n)

- **[RAG com header x-user-lang]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" -H "x-user-lang: es" \
  -d '{"query":"Resumo de notícias de tecnologia do dia"}' \
  "$BASE/generate-grounded-content"
```
- Aceite: texto em espanhol; header `X-Request-Id` presente.

- **[RAG sem header, usando profiles.language=en]**
  - Ajuste `profiles.language` do usuário para `en`.
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"query":"Resumo de notícias de tecnologia do dia"}' \
  "$BASE/generate-grounded-content"
```
- Aceite: resposta em inglês; `X-Request-Id` presente.

- **[WS STT/TTS por idioma]**
  - Defina `profiles.language` para `pt-BR`, `en` e `es` em testes separados.
  - Conecte ao WS e fale uma frase curta em cada idioma.
  - Esperado: transcrição coerente (Whisper `language` aplicado) e TTS com voz correspondente ao idioma; logs em `chat_history` com `meta.provider`.

## 17. Segurança de Pagamentos

- Endpoints:
  - `payments-set-passphrase` (definição de senha e duress)
  - `payments-verify` (verificação pré-cobrança)
- **[Definir senhas]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"passphrase":"minhaSenha123","duress_passphrase":"socorro123"}' \
  "$BASE/payments-set-passphrase"
```
- Aceite: 201; gravação em `payment_security` (hash Argon2id, não plain).
- **[Verificar sucesso]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"passphrase":"minhaSenha123"}' \
  "$BASE/payments-verify"
```
- Aceite: `{ authorized: true, duress: false }`; auditoria `success` em `payment_auth_audit`.
- **[Verificar duress]**
```bash
curl -X POST -H "Authorization: Bearer <USER_ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"passphrase":"socorro123"}' \
  "$BASE/payments-verify"
```
- Aceite: `{ authorized: false, duress: true }`; auditoria `duress`.
- **[Rate limit]**
  - 6+ verificações em <1 min → 429 `rate_limited`; auditoria `failure` com `rate_limit`.

## 18. Observabilidade

- **[Logs]** confirmar presença de `request_id` em respostas e logs.
- **[Alertas]** configurar latência/erros nas funções críticas.

---

- Substitua `$BASE` por `https://xsxdgcupzggofdkmhkmc.supabase.co/functions/v1` ou exporte no shell:
```bash
export BASE="https://xsxdgcupzggofdkmhkmc.supabase.co/functions/v1"
```
- Execute os testes em ordem; registre resultados e evidências (timestamps, `request_id`).
