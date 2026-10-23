# Darting

A dart scoring and game tracking app for iOS, Android and web, built with Expo (React Native).

> Work in progress.

## What it does

- **Games**: X01 (301/501), Cricket, Killer, Shanghai, Halve-It, Baseball, Bermuda Triangle, High Score,
  and training drills such as Around the Clock and Bob's 27, with setup, live scoring and results
- **Stats**: personal progress, trends and bests over time
- **Social**: friends, challenges and player profiles
- **Clubs**: players find and join clubs; clubs get leaderboards, sessions, tournaments and member stats
- **Account**: sign-in, password reset, notification preferences and account deletion

## Tech stack

| Area | Choice |
|---|---|
| App | Expo 55, Expo Router (file-based routing), TypeScript (strict) |
| Auth | Clerk, tokens in Expo SecureStore |
| Cloud data | Supabase (Postgres with row-level security, edge functions) |
| Local data | expo-sqlite + Drizzle ORM for on-device game state |
| State | Zustand (MMKV persistence) and TanStack Query |
| UI | NativeWind (Tailwind CSS), Reanimated, lucide icons |
| Quality | Jest + React Native Testing Library (76 test files), ESLint, CI on GitHub Actions |

## Project structure

```text
app/          Screens and routes: (public) sign-in, (protected) tabs, games, clubs, settings
components/   Reusable UI
lib/games/    Pure game logic per game type
db/           Drizzle schema and client; drizzle/ holds migrations
stores/       Zustand stores
supabase/     Cloud migrations and edge functions
```

## Running locally

Requires Node.js and an Expo dev build, plus your own Clerk and Supabase projects.

```bash
cp .env.example .env   # add your Clerk and Supabase keys
npm install
npm start              # or: npm run ios / npm run android / npm run web
npm run verify         # typecheck, lint, tests and web build
```
