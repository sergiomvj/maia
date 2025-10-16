# Setup de Variáveis de Ambiente e Secrets (Supabase)

Este guia cobre as etapas para concluir o item 0 do plano (Fundamentos e Higiene de Segredos):

## 1) Frontend (.env.local)

- Copie o template:
```
cp .env.example .env.local
```
- Edite `.env.local` e preencha:
```
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```
- Teste o app:
```
npm install
npm run dev
```

## 2) Edge Functions (Supabase Secrets)

Defina secrets no projeto Supabase (CLI autenticado):
```
npx supabase secrets set SUPABASE_URL=https://SEU_PROJETO.supabase.co
npx supabase secrets set SUPABASE_ANON_KEY=eyJhbGciOi...
```
Secrets adicionais (conforme necessário):
```
# Criptografia de API keys (usado em save-api-key e proxy-live-session)
npx supabase secrets set ENCRYPTION_KEY="$(openssl rand -base64 32)"

# Acesso service role (somente quando necessário por função específica)
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

## 3) Deploy das Edge Functions

Após configurar os secrets, faça o deploy:
```
npx supabase functions deploy reminders --no-verify-jwt
npx supabase functions deploy notes --no-verify-jwt
npx supabase functions deploy shopping-list-items --no-verify-jwt
npx supabase functions deploy profile --no-verify-jwt
npx supabase functions deploy chat-history --no-verify-jwt
npx supabase functions deploy proxy-live-session --no-verify-jwt
```

Verifique as URLs das funções no Dashboard do Supabase.

## 4) Testes rápidos (cURL)

Substitua `FUNCTION_URL` e `ACCESS_TOKEN` do usuário:
```
# Reminders (GET)
curl -H "Authorization: Bearer ACCESS_TOKEN" "FUNCTION_URL/reminders?limit=20"

# Notes (POST)
curl -X POST -H "Authorization: Bearer ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"content":"Minha primeira nota"}' "FUNCTION_URL/notes"
```

## 5) Checklist para dar como concluído o Item 0

- [ ] `.env.local` criado e preenchido
- [ ] App inicia sem hardcodes
- [ ] Secrets criadas no Supabase (URL/ANON e demais necessárias)
- [ ] Deploy realizado das funções principais
