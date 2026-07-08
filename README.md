# VoiceTask

A Trello-style task tracker with **voice capture for driving**. Works in any desktop browser and installs on Android like a native app (PWA).

## Features

- **Board** — To Do / In Progress / Done columns with drag & drop, filterable by project and assignee
- **Drive mode** — one giant mic button. Say *"Task call the plumber due tomorrow assign to Ramesh for project Home"* or *"Note …"*. The app speaks a confirmation back so you never look at the screen, and shows a 10-second UNDO button. Works offline — captures queue and sync later.
- **Timeline** — tasks as bars across the next 30 days, colored by project
- **Notes** — typed or dictated, taggable with a project
- **Assignees** — people you delegate to; they are labels only and never get access
- **Audit trail** — every action (created, assigned, moved, due date set, completed…) is automatically timestamped and shown in the task's Activity panel
- **Offline-first** — everything lives in the browser (IndexedDB) and syncs to Supabase when online

## Run locally

```
npm install
npm run dev
```

Without configuration the app runs in **local-only mode** (data stays in this browser).

## Turn on cloud sync (free)

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. In the Supabase dashboard, open **SQL Editor**, paste the contents of [`supabase/migration.sql`](supabase/migration.sql), and click **Run**.
3. Go to **Project Settings → API** and copy the **Project URL** and **anon public key**.
4. Copy `.env.example` to `.env` and fill in both values.
5. Restart/rebuild the app. Create your account on the login screen (email + password).

Row Level Security ensures only your account can read or write your rows, even though the anon key is public.

## Deploy (free hosting on Vercel)

1. Push this folder to a GitHub repository.
2. At [vercel.com](https://vercel.com), **Import** the repository (defaults are fine for Vite).
3. Add the two environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the project settings.
4. Deploy. Open the URL on your Android phone in Chrome → menu ⋮ → **Add to Home screen**.

Voice recognition requires HTTPS (Vercel provides it) or localhost, and Chrome/Edge (the Web Speech API).

## Voice grammar

| You say | Result |
| --- | --- |
| "Task buy cement" | Task in To Do |
| "Task pay electrician **due Friday**" | Task with due date |
| "Task follow up **assign to Priya**" | Task assigned (contact auto-created) |
| "Task order tiles **for project Home Reno**" | Task tagged with the project |
| "Note the supplier quoted 40,000" | Note |
| anything else | Saved as a note — nothing is ever lost |

Date phrases understood: `today`, `tomorrow`, `day after tomorrow`, weekday names, `next week`, `in N days`, `July 15`.

## While driving — safety note

Mount the phone, open Drive mode before you set off, and use the single large tap target. A true zero-touch "Hey Google, add a task" integration requires a native Android app (a possible phase 2); task apps cannot appear on the Android Auto screen itself per Google's app-category rules.
