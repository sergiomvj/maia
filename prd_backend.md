 seguir, apresento um Documento de Requisitos de Produto (PRD) detalhado para o backend da Maia, com base na arquitetura e funcionalidades existentes no frontend. Este documento servirá como um guia claro para a equipe de backend implementar e criar os serviços necessários.
Documento de Requisitos de Produto (PRD): Backend da Maia - Assistente Pessoal de IA
1. Introdução
1.1. Objetivo
Este documento detalha os requisitos funcionais e não-funcionais para o backend que suporta a aplicação "Maia - Voice Assistant". O objetivo é guiar o desenvolvimento de uma infraestrutura segura, escalável e de baixa latência que possibilite todas as funcionalidades da aplicação, desde a autenticação de usuários até a conversação em tempo real com modelos de linguagem (LLMs).
1.2. Visão Geral do Produto
A Maia é uma assistente pessoal de IA que permite aos usuários gerenciar tarefas, lembretes, notas e listas de compras através de conversas de voz naturais. O backend atua como a espinha dorsal do serviço, gerenciando dados de usuários, processando a lógica de negócios e atuando como um proxy seguro para as APIs de IA (como Google Gemini e OpenAI).
2. Requisitos Funcionais (RF)
RF-01: Módulo de Autenticação e Usuários
Descrição: O sistema deve fornecer uma maneira segura para os usuários se registrarem, fazerem login e gerenciarem suas informações de perfil.
Requisitos:
RF-01.1: Utilizar o Supabase Auth para gerenciar todo o ciclo de vida da autenticação (registro, login, logout, recuperação de senha).
RF-01.2: Manter uma tabela profiles que se sincronize com a tabela auth.users do Supabase. Um perfil deve ser criado automaticamente para cada novo usuário.
RF-01.3: Fornecer um endpoint (/save-api-key) que permita ao usuário salvar sua chave de API de LLM. A chave deve ser criptografada antes de ser armazenada no banco de dados. O segredo de criptografia deve ser gerenciado de forma segura (ex: Supabase Secrets).
RF-01.4: O endpoint de salvar a chave de API deve validar o token de autenticação do usuário para garantir que ele só possa atualizar seu próprio perfil.
RF-02: Módulo de Conversação em Tempo Real (Proxy de WebSocket)
Descrição: O sistema deve fornecer um serviço de proxy via WebSocket para mediar a comunicação de áudio em tempo real entre o cliente (frontend) e o provedor de LLM (ex: Gemini Live API).
Requisitos:
RF-02.1: Implementar um endpoint de WebSocket (/proxy-live-session).
RF-02.2: O primeiro passo após a conexão WebSocket deve ser a autenticação. O cliente enviará um token de acesso do Supabase, que o backend validará. Conexões não autenticadas devem ser encerradas.
RF-02.3: Após a autenticação, o backend deve buscar o perfil do usuário para identificar o provedor de LLM selecionado (gemini, openai, etc.) e sua chave de API criptografada.
RF-02.4: A chave de API deve ser descriptografada em memória e usada para estabelecer uma conexão com o serviço de LLM correspondente. A chave descriptografada nunca deve ser registrada em logs ou enviada de volta ao cliente.
RF-02.5: O serviço deve ser capaz de receber streams de áudio do cliente (formato PCM, 16000Hz) e retransmiti-los em tempo real para o LLM.
RF-02.6: O serviço deve receber as respostas do LLM (que podem incluir áudio, transcrições, chamadas de função/ferramenta) e retransmiti-las de volta para o cliente conectado via WebSocket.
RF-02.7: Gerenciar o ciclo de vida da conexão, garantindo que os recursos (conexão com LLM, etc.) sejam liberados quando o cliente se desconectar.
RF-03: Módulo de Ferramentas e Integrações (APIs de Lógica de Negócios)
Descrição: O backend deve expor endpoints para executar ações solicitadas pelo LLM (via "tool calls") e para que o cliente gerencie seus dados. Atualmente, muita dessa lógica está no frontend e deve ser movida para o backend para maior segurança e consistência.
Requisitos:
RF-03.1: APIs CRUD Seguras: Criar endpoints RESTful (ou equivalentes) para gerenciar os dados do usuário. Cada endpoint deve validar o token do usuário para garantir a autorização.
GET, POST, PUT, DELETE /reminders
GET, POST, PUT, DELETE /notes
GET, POST, PUT, DELETE /shopping-list-items
RF-03.2: API de Geração de Conteúdo Grounded: Implementar um endpoint (/generate-grounded-content) que receba uma query, utilize a chave de API do usuário para consultar um LLM com a ferramenta de busca (ex: Google Search grounding) e retorne a resposta e as citações.
RF-03.3: API de Geração de Imagens: Implementar um endpoint (/generate-image) que receba um prompt (e um prompt negativo opcional), utilize a chave de API do usuário para chamar o modelo de geração de imagem do provedor selecionado (ex: Imagen da Google, DALL-E 3 da OpenAI) e retorne a imagem em formato base64.
RF-03.4: API de Histórico de Chat: Fornecer um endpoint para salvar e recuperar o histórico de conversas do usuário.
3. Requisitos Não-Funcionais (RNF)
RNF-01: Segurança:
Todas as chaves de API e dados sensíveis devem ser criptografados em repouso (at-rest).
Toda a comunicação deve usar TLS/SSL.
Implementar políticas de RLS (Row Level Security) no Supabase para garantir que um usuário só possa acessar seus próprios dados.
Validar todas as entradas para prevenir injeção de SQL e outros ataques.
RNF-02: Desempenho e Latência:
A latência do proxy de WebSocket (do cliente para o LLM e vice-versa) deve ser minimizada para garantir uma experiência de conversação fluida. A latência de ponta a ponta (excluindo o processamento do LLM) deve ser inferior a 200ms.
As respostas das APIs RESTful devem ter um tempo médio de resposta inferior a 500ms.
RNF-03: Escalabilidade:
A arquitetura (usando Supabase Edge Functions) deve ser serverless e capaz de escalar horizontalmente para lidar com um número crescente de usuários simultâneos.
RNF-04: Confiabilidade:
O sistema deve ter um uptime de 99.9%.
Implementar tratamento de erros robusto e retentativas (retry logic) para chamadas a APIs externas (LLMs).
RNF-05: Logging e Monitoramento:
Implementar logging estruturado para depuração e auditoria. NUNCA registrar chaves de API ou PII (Informações de Identificação Pessoal).
Configurar monitoramento para acompanhar a saúde do sistema, latência e taxas de erro.
4. Estrutura de Dados (Schema do Banco de Dados)
A estrutura atual no Supabase atende aos requisitos iniciais e deve ser mantida:
profiles: Armazena dados do usuário, incluindo encrypted_api_key e llm_provider.
reminders: Gerencia os lembretes do usuário.
notes: Armazena as notas do usuário.
shopping_list_items: Mantém a lista de compras do usuário.
chat_history: Salva o histórico de conversas para persistência.

sta estrutura é projetada para o Supabase (PostgreSQL) e inclui as melhores práticas de segurança, como chaves estrangeiras e a preparação para a Segurança em Nível de Linha (Row Level Security - RLS).
Detalhamento do Schema do Banco de Dados
1. Tabela: profiles
Armazena informações adicionais e configurações para cada usuário autenticado.
Nome da Coluna	Tipo de Dado	Restrições e Padrões	Descrição
id	uuid	PRIMARY KEY, FOREIGN KEY para auth.users(id) com ON DELETE CASCADE	Chave primária que espelha o ID do usuário na tabela de autenticação do Supabase. Garante que, se um usuário for deletado, seu perfil também será.
updated_at	timestamptz	NULLABLE	Data e hora da última atualização do perfil. Útil para auditoria e sincronização.
full_name	text	NULLABLE	Nome completo do usuário, que ele pode definir no seu perfil.
encrypted_api_key	text	NULLABLE	A chave de API do provedor de LLM (Gemini, OpenAI, etc.) fornecida pelo usuário, sempre armazenada criptografada. Nula até que o usuário a salve.
llm_provider	text	NOT NULL, DEFAULT 'gemini'	Identifica o provedor de IA selecionado pelo usuário (ex: 'gemini', 'openai'). O padrão é 'gemini'.
Segurança: Esta tabela deve ter RLS ativada para garantir que um usuário só possa visualizar e modificar seu próprio perfil.
2. Tabela: reminders
Armazena os lembretes criados pelos usuários.
Nome da Coluna	Tipo de Dado	Restrições e Padrões	Descrição
id	uuid	PRIMARY KEY, DEFAULT gen_random_uuid()	Identificador único para cada lembrete.
user_id	uuid	NOT NULL, FOREIGN KEY para auth.users(id) com ON DELETE CASCADE	Associa o lembrete ao usuário que o criou. Essencial para o RLS.
task	text	NOT NULL	A descrição da tarefa a ser lembrada (ex: "Ligar para o dentista").
due_date	date	NULLABLE	A data de vencimento do lembrete. Opcional.
due_time	time	NULLABLE	A hora de vencimento do lembrete. Opcional.
priority	text	NOT NULL, DEFAULT 'Medium' (Pode ter um CHECK para 'High', 'Medium', 'Low')	A prioridade do lembrete.
is_completed	boolean	NOT NULL, DEFAULT false	Indica se o lembrete foi concluído ou não.
created_at	timestamptz	NOT NULL, DEFAULT now()	Data e hora em que o lembrete foi criado.
Segurança: RLS é fundamental aqui para que um usuário veja apenas os seus próprios lembretes.
3. Tabela: notes
Armazena notas de texto criadas pelos usuários.
Nome da Coluna	Tipo de Dado	Restrições e Padrões	Descrição
id	uuid	PRIMARY KEY, DEFAULT gen_random_uuid()	Identificador único para cada nota.
user_id	uuid	NOT NULL, FOREIGN KEY para auth.users(id) com ON DELETE CASCADE	Associa a nota ao usuário que a criou.
content	text	NOT NULL	O conteúdo da nota.
created_at	timestamptz	NOT NULL, DEFAULT now()	Data e hora em que a nota foi criada.
Segurança: RLS deve garantir que um usuário só possa acessar e gerenciar suas próprias notas.
4. Tabela: shopping_list_items
Armazena os itens da lista de compras de cada usuário.
Nome da Coluna	Tipo de Dado	Restrições e Padrões	Descrição
id	uuid	PRIMARY KEY, DEFAULT gen_random_uuid()	Identificador único para cada item da lista.
user_id	uuid	NOT NULL, FOREIGN KEY para auth.users(id) com ON DELETE CASCADE	Associa o item ao usuário que o adicionou.
item	text	NOT NULL	O nome do item a ser comprado (ex: "Leite", "Pão").
quantity	integer	NOT NULL, DEFAULT 1	A quantidade do item.
is_collected	boolean	NOT NULL, DEFAULT false	Indica se o item já foi coletado no supermercado.
created_at	timestamptz	NOT NULL, DEFAULT now()	Data e hora em que o item foi adicionado à lista.
Segurança: RLS é crucial para isolar a lista de compras de cada usuário.
5. Tabela: chat_history
Armazena o histórico das conversas para persistência e para fornecer contexto em futuras interações.
Nome da Coluna	Tipo de Dado	Restrições e Padrões	Descrição
id	uuid	PRIMARY KEY, DEFAULT gen_random_uuid()	Identificador único para cada entrada no histórico.
user_id	uuid	NOT NULL, FOREIGN KEY para auth.users(id) com ON DELETE CASCADE	Associa a mensagem ao usuário da sessão.
speaker	text	NOT NULL, CHECK (speaker IN ('user', 'maia', 'system'))	Identifica quem falou: o usuário, a assistente (Maia) ou o sistema (ex: "Lembrete definido").
text	text	NOT NULL	O conteúdo da mensagem transcrita.
created_at	timestamptz	NOT NULL, DEFAULT now()	Data e hora em que a mensagem foi registrada.
Segurança: RLS é necessário para que um usuário só possa acessar seu próprio histórico de conversas.

A seguir, apresento uma lista de recursos extras que podem ser implementados e, em seguida, uma estratégia detalhada para o prompt base e o RAG (Retrieval-Augmented Generation), que é o segredo para tornar a Maia verdadeiramente pessoal e contextualmente ciente.
1. Recursos Extras via APIs Externas
A verdadeira força de uma assistente de IA está em sua capacidade de interagir com o mundo digital. A arquitetura de "tool calling" que já temos é perfeita para isso. Aqui estão algumas integrações de alto impacto que podemos adicionar:
Área do Recurso	Exemplo de Comando de Voz	API(s) Externa(s) Sugerida(s)	Benefício para o Usuário / Notas de Implementação
Entretenimento	"Maia, toque a playlist 'Focus' no Spotify." ou "O que você sabe sobre o filme Oppenheimer?"	Spotify API<br/>The Movie Database (TMDB) API	Permite que a Maia controle a reprodução de músicas e forneça informações sobre filmes/séries, tornando-se um hub de entretenimento. A implementação exigiria um fluxo OAuth para o usuário conectar sua conta do Spotify.
Viagens e Logística	"Quanto custa um Uber do aeroporto para o centro da cidade?" ou "Procure voos para o Rio de Janeiro na próxima sexta-feira."	Uber API / Lyft API<br/>Skyscanner API / Amadeus API	Transforma a Maia em uma assistente de viagens. Pode fornecer estimativas de preço, verificar horários de voos e, eventualmente, até mesmo fazer reservas.
Saúde e Fitness	"Registre que corri 5 quilômetros hoje." ou "Encontre uma receita saudável de frango com menos de 500 calorias."	Strava API / Google Fit API<br/>Edamam API / Spoonacular API	Conecta a Maia ao estilo de vida do usuário. Ela pode ajudar a registrar atividades físicas e encontrar receitas com base em critérios nutricionais específicos.
Produtividade no Trabalho	"Crie um novo card no Trello chamado 'Revisar design do app'." ou "Qual o status do ticket JIRA-123?"	Trello API<br/>Jira API<br/>Google Workspace APIs	Expande a utilidade da Maia para o ambiente profissional. O usuário pode gerenciar tarefas de trabalho diretamente por voz, aumentando a produtividade.
Finanças Pessoais	"Qual a cotação atual das ações da Google?" ou "Registre um gasto de 25 reais com almoço."	Finnhub API / Alpha Vantage API	Fornece informações financeiras em tempo real. O registro de gastos pode ser feito em uma nova tabela no Supabase ou até integrado a uma planilha do Google Sheets via API.
2. Estratégia de Prompt Base e RAG
Esta é a parte mais crítica para a "inteligência" da Maia. Não basta apenas enviar a última frase do usuário para a IA. Precisamos dar à IA um cérebro, uma personalidade e, o mais importante, contexto sobre o usuário.
2.1. O Prompt Base (System Instruction)
O systemInstruction é a "constituição" da Maia. Ele define sua persona, suas regras e como ela deve se comportar. Devemos configurá-lo no proxy-live-session antes de iniciar a conversa.
Exemplo de Prompt Base Estruturado:
code
Code
You are Maia, a highly efficient, friendly, and concise personal assistant. Your primary goal is to help the user organize their life and access information quickly and accurately by using the tools available to you.

**Core Directives:**
1.  **Use Your Tools:** You have access to a set of tools to perform actions like creating reminders, saving notes, managing shopping lists, searching the web, generating images, and more. When a user's request matches a tool's capability, you MUST use that tool. Do not answer from your general knowledge if a specific tool is more appropriate (e.g., for weather, news, or user-specific data).
2.  **Be Proactive (When Context Allows):** Use the provided user context to offer more relevant help. For example, if a user asks to add an item to the shopping list, and the item is already there, inform them.
3.  **Confirm, Then Act:** For actions that create or delete data (reminders, notes), confirm the action's completion in your response. For example, after creating a reminder, say "Ok, I've set a reminder for..."
4.  **Clarity and Brevity:** Keep your spoken responses clear, natural, and to the point. Avoid unnecessary verbosity.
5.  **Safety First:** Do not invent information. If you don't know something or cannot fulfill a request, state it clearly. Absolutely refuse to provide financial, medical, or legal advice.

You will now receive the user's personal context, followed by the conversation history and their latest request.
2.2. A Estratégia de RAG (Retrieval-Augmented Generation)
RAG é o processo de "buscar" informações relevantes e "aumentar" o prompt com elas antes de enviá-lo para a IA. No nosso caso, a "busca" é uma consulta seletiva ao nosso banco de dados Supabase.
O processo deve ocorrer no backend (proxy-live-session) a cada turno da conversa ou, para otimização, quando a IA precisar de mais contexto.
Fluxo de Implementação do RAG:
Receber a Query do Usuário: O backend recebe a transcrição da fala do usuário (ex: "Lembre-me de verificar o relatório amanhã").
Recuperação Seletiva de Dados (O Coração do RAG): Antes de enviar a query para a IA, o backend consulta o banco de dados para obter dados potencialmente relevantes. Não enviamos tudo, apenas um resumo conciso.
Consulta por Palavras-chave: Se a query contém "lembrete" ou "amanhã", o backend busca os lembretes do usuário para o dia seguinte.
Busca por Vetores (Para Notas): Para perguntas como "O que anotei sobre o projeto Phoenix?", a coluna content da tabela notes deve ser convertida em embeddings vetoriais (usando pg_vector no Supabase). O backend então faz uma busca por similaridade semântica para encontrar as notas mais relevantes.
Sempre Incluir o Básico: Um resumo dos lembretes de alta prioridade ou para o dia de hoje é quase sempre útil.
Montagem do Contexto Dinâmico: O backend formata os dados recuperados em um bloco de texto claro e estruturado.
Exemplo de Bloco de Contexto Montado:
code
Markdown
--- User Context (Generated at YYYY-MM-DD HH:MM) ---
User Name: Bruno
Active Reminders (2):
- [High Priority] Call Ana about the presentation (Due: Today, 4 PM)
- Buy plane tickets (Due: Today)
Most Recent Note (from 2 hours ago):
- "The Q3 marketing strategy should focus on social media engagement and video content."
Shopping List Items (3):
- Milk, Bread, Coffee
--- End Context ---
Formulação do Prompt Final: O backend une todas as partes.
[Parte 1] O Prompt Base (definido acima).
[Parte 2] O Contexto Dinâmico (montado no passo 3).
[Parte 3] O Histórico Recente da Conversa (as últimas 4-6 trocas).
[Parte 4] A Query Atual do Usuário.
Envio para o LLM: Apenas agora o prompt completo e enriquecido é enviado para a API do Gemini.
Resultado: Quando a IA recebe uma pergunta como "O que é mais importante para hoje?", em vez de dar uma resposta genérica, ela verá o bloco de contexto e responderá: "Olá Bruno. Hoje, sua prioridade é ligar para a Ana sobre a apresentação às 4 PM. Você também tem que comprar as passagens de avião."
Esta abordagem transforma a Maia de uma simples interface de comandos para uma assistente verdadeiramente contextual e pessoal.


Implementar um formul[ario de onbording para parametrizacao do conhecimento do assistente sobre detalhaes do usu'ario para facilitar a comunica'cao... sugira os campos que oferecam maiores possibilidades de interacao 
@@
 Crie uma area de administração para que o usuario possa parametrizar os dados do assistente APIs externas e dados do usuario

 Implementar um sistema de feedback para que o usuario possa avaliar a assistente e que os dados sejam enviados para o supabase

 Implementar um sistema de logs para que o usuario possa ver o historico de conversas e que os dados sejam enviados para o supabase

 Implementar um sistema de notificacao para que o usuario possa receber notificacoes de lembretes e que os dados sejam enviados para o supabase

 Implementar um sistema de chat para que o usuario possa conversar com a assistente e que os dados sejam enviados para o supabase

 Conexão com Supabase (sem expor credenciais em arquivos versionados)

 Exemplo no frontend (Vite/React):

 ```ts
 import { createClient } from '@supabase/supabase-js';
 
 const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
 const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
 
 export const supabase = createClient(supabaseUrl, supabaseAnonKey);
 ```
 
 Configure as variáveis em um arquivo local não versionado (ex.: `.env.local`):
 
 ```bash
 VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
 VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
 ```
 
 Para Edge Functions (Supabase), use `supabase secrets set` para armazenar segredos com segurança.
