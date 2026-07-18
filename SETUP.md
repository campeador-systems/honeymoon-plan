# Backend setup (Phase 1) — one-time steps

The dashboard stays on GitHub Pages. Supabase adds shared data + auth + the Claude
assistant. These are the steps only the account owner can do; everything else is code
in this repo.

## 1. Create the Supabase project (~5 min)
1. supabase.com → sign up (free, no card) → **New project** (any name, region: US West).
2. **SQL Editor** → paste and run `supabase/migrations/001_items.sql`.
3. **Authentication → Sign In / Up**: enable **Email** provider, turn **OFF** "Allow new
   users to sign up".
4. **Authentication → Users → Add user**: create both traveler emails (send invite or
   set passwords — OTP login works either way).

## 2. Deploy the assistant function (~5 min)
1. **Edge Functions → Deploy new function** → name it `assistant`.
2. Paste `supabase/functions/assistant/index.ts` (and `context.ts` as a second file).
3. **Settings → Edge Functions → Secrets**: add `ANTHROPIC_API_KEY` = your key from
   console.anthropic.com (set a monthly spend limit there while you're at it, e.g. $10).

## 3. Hand Claude Code the two public values
From **Settings → API**: the **Project URL** and the **anon (public) key** — paste both
into chat. They are safe to be public (they ship in the page; RLS + disabled signups do
the protecting). NEVER paste the service_role key or the Anthropic key into chat.

Then Claude Code wires the dashboard: login screen (email OTP), items loaded from the
DB, and the assistant chat view.
