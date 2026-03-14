# Darting

Dart scoring and game tracking app built with Expo (React Native).

## Stack

- Expo 55 + Expo Router (file-based routing)
- TypeScript (strict mode)
- Clerk auth (`@clerk/clerk-expo`) with Expo SecureStore
- Supabase (cloud DB, RLS, user sync via Clerk webhook)
- expo-sqlite + Drizzle ORM (on-device game state)
- Zustand + MMKV (client state) + TanStack React Query (server state)
- NativeWind v4 + Tailwind CSS v3
- lucide-react-native icons
- react-native-reanimated

## Commands

- `npm start` — Expo dev server
- `npm run ios` / `npm run android` — Run on simulator
- `npm run lint` — ESLint
- `npx drizzle-kit generate` — Generate migration from schema
- `npx drizzle-kit push` — Push schema to dev DB

## Key Patterns

- Routes: `app/(public)/` (unauth), `app/(protected)/` (auth-gated), `app/(protected)/game/[slug]/` (game screens)
- DB schema in `db/schema.ts`, client in `db/client.ts`
- Use Drizzle transactions for multi-table writes
- Migrations run on app start via `useMigrations()`
- Auth: `useAuth()` for state, redirect to `/(public)/sign-in` if not signed in
- Supabase: two clients — anon (bootstrap) and Clerk-authenticated (RLS)
- Styling: NativeWind `className` on RN components, no StyleSheet.create()
- Imports: always use `@/*` path alias
- Game logic: pure functions in `lib/games/`, state as JSON in DB columns
- Game flow: setup → play → results per `[slug]`

## Do NOT

- Use raw SQL in app code (use Drizzle)
- Use AsyncStorage (use MMKV or SecureStore)
- Mix Zustand and React Query responsibilities
- Use StyleSheet.create (use NativeWind)
- Push to git without explicit approval
