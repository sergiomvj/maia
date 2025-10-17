############
# Secrets
# YOU MUST CHANGE THESE BEFORE GOING INTO PRODUCTION
############


POSTGRES_PASSWORD=CHANGE_ME_SECURE
JWT_SECRET=CHANGE_ME_STRONG_SECRET
ANON_KEY=CHANGE_ME_ANON_JWT
SERVICE_ROLE_KEY=CHANGE_ME_SERVICE_ROLE_JWT
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=CHANGE_ME_DASHBOARD_PASS
SECRET_KEY_BASE=CHANGE_ME_SECRET_KEY_BASE
VAULT_ENC_KEY=CHANGE_ME_VAULT_ENC_KEY

# Domains (self-host)
# Example:
# APP_DOMAIN=app.seu-dominio.com
# AUTH_DOMAIN=auth.seu-dominio.com
APP_DOMAIN=
AUTH_DOMAIN=




############
# Database - You can change these to any PostgreSQL database that has logical replication enabled.
############


POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432
# default user is postgres




############
# Supavisor -- Database pooler
############
# Port Supavisor listens on for transaction pooling connections
POOLER_PROXY_PORT_TRANSACTION=6543
# Maximum number of PostgreSQL connections Supavisor opens per pool
POOLER_DEFAULT_POOL_SIZE=20
# Maximum number of client connections Supavisor accepts per pool
POOLER_MAX_CLIENT_CONN=100
# Unique tenant identifier
POOLER_TENANT_ID=your-tenant-id
# Pool size for internal metadata storage used by Supavisor
# This is separate from client connections and used only by Supavisor itself
POOLER_DB_POOL_SIZE=5




############
# API Proxy - Configuration for the Kong Reverse proxy.
############


KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443




############
# API - Configuration for PostgREST.
############


PGRST_DB_SCHEMAS=public,storage,graphql_public




############
# Auth - Configuration for the GoTrue authentication server.
############


## General
SITE_URL=https://$(APP_DOMAIN)
ADDITIONAL_REDIRECT_URLS=https://$(AUTH_DOMAIN)/auth/v1/callback,https://$(AUTH_DOMAIN)/functions/v1/oauth-google/callback,http://localhost:3000
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL=https://$(AUTH_DOMAIN)


## Mailer Config
MAILER_URLPATHS_CONFIRMATION="/auth/v1/verify"
MAILER_URLPATHS_INVITE="/auth/v1/verify"
MAILER_URLPATHS_RECOVERY="/auth/v1/verify"
MAILER_URLPATHS_EMAIL_CHANGE="/auth/v1/verify"


## Email auth
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
SMTP_ADMIN_EMAIL=admin@example.com
SMTP_HOST=supabase-mail
SMTP_PORT=2500
SMTP_USER=fake_mail_user
SMTP_PASS=fake_mail_password
SMTP_SENDER_NAME=fake_sender
ENABLE_ANONYMOUS_USERS=false

## OAuth providers
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=
GOTRUE_EXTERNAL_GOOGLE_SECRET=


## Phone auth
ENABLE_PHONE_SIGNUP=true
ENABLE_PHONE_AUTOCONFIRM=true




############
# Studio - Configuration for the Dashboard
############


STUDIO_DEFAULT_ORGANIZATION=Default Organization
STUDIO_DEFAULT_PROJECT=Default Project


STUDIO_PORT=3000
# replace if you intend to use Studio outside of localhost
SUPABASE_PUBLIC_URL=https://$(AUTH_DOMAIN)


# Enable webp support
IMGPROXY_ENABLE_WEBP_DETECTION=true


# Add your OpenAI API key to enable SQL Editor Assistant
OPENAI_API_KEY=

############
# Frontend (Vite) example envs (configure in deployment env, not here)
############
VITE_SUPABASE_URL=https://$(AUTH_DOMAIN)
VITE_SUPABASE_ANON_KEY=<mirror_of_ANON_KEY>




############
# Functions - Configuration for Functions
############
# NOTE: VERIFY_JWT applies to all functions. Per-function VERIFY_JWT is not supported yet.
FUNCTIONS_VERIFY_JWT=false

# Optional CORS allow-list for Functions (to wire in code if desired)
FUNCTIONS_ALLOWED_ORIGINS=https://$(APP_DOMAIN),http://localhost:3000




############
# Logs - Configuration for Analytics
# Please refer to https://supabase.com/docs/reference/self-hosting-analytics/introduction
############


# Change vector.toml sinks to reflect this change
# these cannot be the same value
LOGFLARE_PUBLIC_ACCESS_TOKEN=your-super-secret-and-long-logflare-key-public
LOGFLARE_PRIVATE_ACCESS_TOKEN=your-super-secret-and-long-logflare-key-private


# Docker socket location - this value will differ depending on your OS
DOCKER_SOCKET_LOCATION=/var/run/docker.sock


# Google Cloud Project details
GOOGLE_PROJECT_ID=GOOGLE_PROJECT_ID
GOOGLE_PROJECT_NUMBER=GOOGLE_PROJECT_NUMBER

