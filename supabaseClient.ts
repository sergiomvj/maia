import { createClient } from '@supabase/supabase-js';

// --- ACTION REQUIRED ---
// Replace the placeholder values below with your own Supabase project's URL and Anon Key.
// You can find these in your Supabase project settings under the "API" section.
// The authentication features of this app will not work until you do this.
const supabaseUrl = 'https://cjomrvfwonjwuygljciy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqb21ydmZ3b25qd3V5Z2xqY2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNjgzNDksImV4cCI6MjA3NDc0NDM0OX0.9LSawRItOOrcUAs_9IjNun-OVIMBtvcrfcYOkkzwJzc';


export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/*
--- SUPABASE BACKEND SETUP ---

For the new features (user profiles, persistent data, and secure API key storage) to work,
you need to set up your Supabase backend. This involves running a SQL script,
setting some secrets, and deploying Edge Functions.

--- STEP 1: Run the Database Setup SQL ---

1. Go to the "SQL Editor" in your Supabase project dashboard.
2. Click "New query" and paste the entire script below.
3. Click "RUN" to execute it. This script is idempotent, meaning you can run it again safely.

-- START OF SQL SCRIPT --

-- *** FULL DATABASE SETUP SCRIPT FOR MarIA ***
-- Run this entire script in your Supabase SQL Editor.


-- 1. PROFILES TABLE (Stores user-specific info)

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  updated_at timestamptz,
  full_name text,
  encrypted_api_key text,
  llm_provider text DEFAULT 'gemini'::text,
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING ( auth.uid() = id );
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK ( auth.uid() = id );
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING ( auth.uid() = id ) WITH CHECK ( auth.uid() = id );

-- This function automatically creates a profile for a new user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, llm_provider)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'gemini');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function when a new user signs up.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. REMINDERS TABLE
CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task text NOT NULL,
  due_date date,
  due_time time,
  priority text DEFAULT 'Medium'::text,
  is_completed boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own reminders." ON public.reminders;
CREATE POLICY "Users can manage their own reminders." ON public.reminders FOR ALL USING ( auth.uid() = user_id ) WITH CHECK ( auth.uid() = user_id );


-- 3. NOTES TABLE
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own notes." ON public.notes;
CREATE POLICY "Users can manage their own notes." ON public.notes FOR ALL USING ( auth.uid() = user_id ) WITH CHECK ( auth.uid() = user_id );


-- 4. SHOPPING LIST ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item text NOT NULL,
  quantity integer DEFAULT 1,
  is_collected boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own shopping list." ON public.shopping_list_items;
CREATE POLICY "Users can manage their own shopping list." ON public.shopping_list_items FOR ALL USING ( auth.uid() = user_id ) WITH CHECK ( auth.uid() = user_id );


-- 5. CHAT HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.chat_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  speaker text NOT NULL CHECK (speaker IN ('user', 'maria', 'system')),
  text text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own chat history." ON public.chat_history;
CREATE POLICY "Users can manage their own chat history." ON public.chat_history FOR ALL USING ( auth.uid() = user_id ) WITH CHECK ( auth.uid() = user_id );

-- END OF SQL SCRIPT --


--- STEP 2: Set Up Encryption Secret ---

The application encrypts user API keys before storing them. You need to create a secure, secret
key for this encryption process.

1. Install the Supabase CLI if you haven't already: `npm install supabase --save-dev`
2. Log in to the CLI: `npx supabase login`
3. Link your project: `npx supabase link --project-ref <your-project-ref>`
4. Set the secret. Run this command in your terminal:
   `npx supabase secrets set ENCRYPTION_KEY=$(openssl rand -base64 32)`

--- STEP 3: Deploy Edge Functions ---

The app now uses two backend Edge Functions to securely handle API keys and proxy requests to the Gemini API.
You need to deploy them to your Supabase project.

1. In your project's code, you should have a `supabase/functions` directory containing:
   - `save-api-key/index.ts`
   - `proxy-live-session/index.ts`
   - `_shared/cors.ts`
   - `import_map.json`
   (The code for these files is provided in the project.)

2. Deploy the functions by running this command in your terminal:
   `npx supabase functions deploy --no-verify-jwt`

After completing these steps, the profile and voice assistant features will be fully functional.
*/