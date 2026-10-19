# 02. Supabase (auth + database)

**Short answer to "do I need Supabase?"**: yes, use it. It gives you working email/password sign-up and log-in, session storage on the phone, a Postgres database for profiles and progress, and row-level security, all on the free plan, with an official React Native client. Building the same on AWS Cognito + DynamoDB would eat most of a hackathon.

What the app uses Supabase for:

- **Auth**: sign up, log in, stay logged in, log out.
- **`profiles` table**: display name, chosen language, whether setup is done (this is what decides "send to setup page" vs "send to main app" after sign-up).
- **`encounter_progress` table**: which Encounters the user has completed (shown on the Profile tab).

---

## 1. Create the project

1. Go to **supabase.com** > **Start your project** > sign in with GitHub.
2. **New project**:
   - Organization: your personal org is fine.
   - Name: `lingvoyage`
   - Database password: click **Generate**, then save it in your scratch note (you won't need it for this app, but you can't see it again).
   - Region: **West US (North California)** is the closest to Hawaii. Any US region is fine.
   - If you see security options for the **Data API**, leave the Data API **enabled**. Leave "automatically expose new tables" **off** (that's the new default); the SQL below grants access explicitly.
3. Click **Create new project** and wait about a minute.

## 2. Copy the Project URL and publishable key

1. On the project home page, click **Connect** (top of the page).
2. Choose the **Mobile frameworks** tab > **Expo React Native**.
3. Copy:
   - **Project URL**: `https://abcdefghijkl.supabase.co` → scratch note as `SUPABASE_URL`
   - **Publishable key**: starts with `sb_publishable_` → scratch note as `SUPABASE_PUBLISHABLE_KEY`

You can also find the key under **Project Settings > API Keys**. If you only see a long key starting with `eyJ`, that's the legacy `anon` key; click **Create new API keys** on that page to get a publishable key. Legacy keys are being deprecated at the end of 2026, so start on the new one.

**Is it safe to put the publishable key in the app?** Yes. It's meant to ship in client apps. What protects your data is row-level security (step 4). Never put a **secret** key (`sb_secret_...`) in the mobile app; this project doesn't need one at all.

## 3. Turn off email confirmation (for the hackathon)

By default, Supabase makes new users click a link in an email before they can log in. That's annoying to demo and the built-in email sender only allows a few emails per hour.

1. **Authentication** (left sidebar) > **Sign In / Providers**.
2. Click **Email**.
3. Make sure **Enable Email provider** is on.
4. Turn **Confirm email** **off**.
5. **Save**.

Now `signUp` returns a session immediately and the app can send the user straight to the setup page.

Turn this back on before a real launch (and set up custom SMTP under Authentication > Emails).

## 4. Create the tables (SQL)

1. Left sidebar > **SQL Editor** > **New query**.
2. Paste everything below and click **Run**. You should see "Success. No rows returned".

```sql
-- =========================================================
-- Lingvoyage schema v1
-- =========================================================

-- 1) Profiles: one row per user, created automatically on sign-up
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  target_language text,                 -- e.g. 'zh-CN' (Mandarin Chinese)
  native_language text not null default 'en',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: insert own"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- New Supabase projects don't expose tables to the API until you grant access
grant select, insert, update on public.profiles to authenticated;

-- Create a profile row whenever someone signs up.
-- display_name comes from supabase.auth.signUp({ options: { data: { display_name } } })
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2) Encounter progress: one row each time a user finishes an Encounter
create table if not exists public.encounter_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scenario_id text not null,            -- 'restaurant' | 'train' | 'hotel'
  goals_completed int not null default 0,
  goals_total int not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.encounter_progress enable row level security;

create policy "progress: read own"
  on public.encounter_progress for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "progress: insert own"
  on public.encounter_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.encounter_progress to authenticated;
```

Check it worked: **Table Editor** should list `profiles` and `encounter_progress`.

If the app later shows an error with code `42501` or "permission denied for table", a `grant` line didn't run. Re-run the script; it's safe to run twice except for the `create policy` lines, which will say "already exists" (that's fine).

## 5. Test sign-up from the dashboard (optional)

1. **Authentication > Users > Add user > Create new user**, enter any email and password, tick **Auto Confirm User**.
2. **Table Editor > profiles** should now have a row with that user's id.
3. Delete the test user afterwards if you like (the profile row is deleted with it).

## 6. Invite teammates

**Organization settings** (top-left org menu) > **Team** > **Invite**. Give Lin and Ran **Developer** access so they can see tables and logs.

## 7. Things to know about the free plan

- Free projects **pause after about a week with no activity**. If the app suddenly can't log in after a break, open the dashboard and click **Restore project**.
- Built-in email sending is rate limited; that's why we turned confirmation off.

---

Done when: you have `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` saved, Confirm email is off, and both tables exist.

Where these values go: guide 05. `SUPABASE_URL` and the publishable key go in **both** `mobile/.env` (for login) and `backend/.env` (the backend uses them to check that requests come from a logged-in user).
