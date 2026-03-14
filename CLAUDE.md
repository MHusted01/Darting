# Darting

Dart scoring and game tracking app built with Expo (React Native).

## Product Vision

Darting is the go-to dart companion app — covering the most widely played dart games across **party**, **classic**, and **training** categories.

### Two modes of use

- **Solo**: Pick up and play, practice on your own, and track your progress over time. See stats, trends, and personal bests.
- **Organization (Clubs)**: Entire dart clubs use Darting for weekly training sessions, tournaments, and casual play. Clubs get leaderboards, member progress tracking, and all the tools a dart club needs to stay organized.

### Club system

- Players discover clubs by searching and requesting access
- Club admins invite players by username or email
- Clubs maintain their own leaderboards, session history, and member stats

### Game types

- **Party games**: Fun, casual formats for social play
- **Classic games**: Standard dart (301/501), doubles, cricket, and other traditional formats
- **Training games**: Structured practice drills to improve accuracy and consistency
- **Free play**: Classic dartboard mode for just throwing and scoring without game rules

### Monetization

Free for all users. Monetization may be explored later but is not a current priority — focus is on building the best dart experience first.

## Stack

- **Framework**: Expo 55 + Expo Router (file-based routing)
- **Language**: TypeScript (strict mode)
- **Auth**: Clerk (`@clerk/clerk-expo`) with Expo SecureStore token cache
- **Cloud DB**: Supabase (user sync via Clerk webhook, RLS enforced)
- **Local DB**: expo-sqlite + Drizzle ORM (on-device game state)
- **State**: Zustand (client state, MMKV persistence) + TanStack React Query (server state)
- **Styling**: NativeWind v4 + Tailwind CSS v3
- **Icons**: lucide-react-native
- **Animations**: react-native-reanimated

## Commands

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Start web version
npm run lint       # ESLint
npx drizzle-kit generate   # Generate migration from schema changes
npx drizzle-kit push       # Push schema to dev database
```

## Project Structure

```
app/
  _layout.tsx              # Root: ClerkProvider + migrations
  (public)/                # Unauthenticated: sign-in, sign-up
  (protected)/             # Auth-gated routes
    (tabs)/                # Bottom tab nav (home, settings)
    game/[slug]/           # Game screens: setup → play → results
components/                # Reusable UI (GameCard, PlayerManager, etc.)
db/
  client.ts                # Drizzle + expo-sqlite client
  schema.ts                # All table definitions
drizzle/                   # SQL migrations (auto-generated)
lib/                       # Utilities (supabase client, storage, game logic)
  games/                   # Pure game logic functions per game type
hooks/                     # Custom React hooks
stores/                    # Zustand stores (appStore)
types/                     # Shared TypeScript types
constants/                 # App constants (game definitions)
providers/                 # Context providers (Supabase + QueryClient)
supabase/
  functions/               # Edge functions (clerk-webhook)
  migrations/              # Cloud DB migrations
```

## Architecture Rules

### Routing
- Group routes with `(groupName)/` for layout boundaries
- Protected routes check `useAuth().isSignedIn`, redirect to `/(public)/sign-in` if false
- Dynamic segments use `[param]` convention (e.g., `[slug]`)
- Each route group has its own `_layout.tsx`

### Database (Local SQLite + Drizzle)
- All schema in `db/schema.ts`, client in `db/client.ts`
- Use transactions for multi-table writes
- Migrations run on app start in root `_layout.tsx` via `useMigrations()`
- Use `IF NOT EXISTS` in migrations for idempotency
- Game state stored as JSON in `gameState` column, darts as JSON array
- Always use Drizzle query builder, never raw SQL in app code

### Auth (Clerk)
- `useAuth()` for auth state checks
- `useSignIn()` / `useSignUp()` for auth flows
- Token stored in Expo SecureStore (not AsyncStorage)
- Clerk user synced to Supabase via webhook edge function

### Supabase
- Two clients: `supabaseAnon` (bootstrap) and `createClerkSupabaseClient` (authenticated)
- Authenticated client uses Clerk JWT for RLS
- QueryClient recreated per user to prevent data leakage
- RLS policies enforce user-scoped access

### State Management
- **Zustand + MMKV**: Client-side persistent state (theme, preferences)
- **TanStack React Query**: Server state, caching, background refetch
- Do NOT mix: Zustand for local, React Query for remote

### Styling (NativeWind)
- Tailwind classes directly on React Native components via `className`
- No `StyleSheet.create()` — use NativeWind exclusively
- Color palette: black/white primary, gray-100–600, emerald-500 (success), red-500 (danger)
- Layout: `flex-1`, `flex-row`, padding `px-6 py-4`, rounded `rounded-xl`
- Active states: `active:opacity-70`
- SafeAreaView with `edges={['top']}` on screen roots

### Imports
- Always use `@/*` path alias (maps to project root)
- Example: `import { db } from '@/db/client'`

### Components
- Functional components only
- Colocate types in component file unless shared (then `types/`)
- Use `Alert.alert()` for error feedback to users
- Game logic as pure functions in `lib/games/`

### Game Architecture
- Games defined in `constants/games.ts` with metadata (slug, name, rules)
- Flow: setup (add players) → play (turns/rounds) → results
- Each game type has its own logic module in `lib/games/`
- Turn data: `{ segment: number, multiplier: number }` per dart throw
- Game state per player stored as JSON in `gamePlayers.gameState`

## Environment Variables

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # Server-side only (webhook)
CLERK_WEBHOOK_SECRET=             # Webhook verification
```

## ECC Workflow

When working on features, follow this order:
1. `/plan` — Design the approach
2. `/code-review` — Review changes before finalizing
3. `/verify` — Verify everything works
