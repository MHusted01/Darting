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
  _layout.tsx              # Root: ClerkProvider + fonts + migrations
  (public)/                # Unauthenticated: sign-in, sign-up
  (protected)/             # Auth-gated routes
    (tabs)/                # Bottom tab nav: index, stats, social
    games/                 # Game screens: setup → play → results
    settings.tsx           # Settings (pushed screen, not a tab)
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

### Styling (NativeWind + Design System)

- Tailwind classes directly on React Native components via `className`
- No `StyleSheet.create()` — use NativeWind exclusively
- Always use `ds-*` tokens (defined in `tailwind.config.js`) — never raw hex or old gray/emerald classes

#### Color tokens

| Token | Value | When to use |
| --- | --- | --- |
| `ds-bg` | `#fdf8f8` | Screen/page background |
| `ds-surface` | `#ffffff` | Cards, input backgrounds |
| `ds-surface-low` | `#f7f3f2` | Subtle fills, avatar backgrounds |
| `ds-surface-container` | `#f1edec` | Deeper container backgrounds |
| `ds-on-surface` | `#1c1b1b` | Primary text, strong icons |
| `ds-on-surface-variant` | `#444748` | Secondary text, muted icons |
| `ds-outline` | `#747878` | Placeholder text, tertiary icons |
| `ds-outline-variant` | `#c4c7c7` | Borders, dividers |
| `ds-red` | `#ba1a1a` | Primary actions, brand accent, danger |
| `ds-red-container` | `#ffdad6` | Light red backgrounds |
| `ds-green` | `#b8f0bc` | Success badge backgrounds |
| `ds-green-dark` | `#1e502a` | Success badge text |

#### Typography

Fonts loaded in `app/_layout.tsx`. Always use these — no system fonts.

| Class | Weight | When to use |
| --- | --- | --- |
| `font-barlow-condensed-xbold` | ExtraBold | App logo, hero headings (e.g. "DARTING", "Step Up") |
| `font-barlow-condensed` | Bold | Screen titles, card labels, nav headers |
| `font-barlow-semi` | SemiBold | Form labels, buttons, section headers, initials |
| `font-barlow-bold` | Bold | Large numeric displays, stat figures |
| `font-barlow` | Regular | Body text, subtitles, input text, descriptions |

#### Screen structure

```tsx
// Standard tab screen
<SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
  {/* header row */}
  <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
    <Text className="text-2xl font-barlow-condensed-xbold text-ds-on-surface tracking-tight">TITLE</Text>
  </View>
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
    <View className="px-6">...</View>
  </ScrollView>
</SafeAreaView>

// Pushed screen (with back button)
<SafeAreaView className="flex-1 bg-ds-bg" edges={['top']}>
  <View className="flex-row items-center gap-3 px-6 pt-4 pb-3 border-b border-ds-outline-variant">
    <Pressable onPress={() => router.back()} className="active:opacity-70">
      <ArrowLeft size={22} color="#1c1b1b" />
    </Pressable>
    <Text className="text-xl font-barlow-condensed text-ds-on-surface">Screen Title</Text>
  </View>
  ...
</SafeAreaView>
```

#### Common patterns

```tsx
// Card / surface container
<View className="bg-ds-surface border border-ds-outline-variant rounded-xl">...</View>

// Section label (above a group of items)
<Text className="text-xs font-barlow-semi text-ds-on-surface-variant uppercase tracking-widest mb-2">
  Section Name
</Text>

// List row inside a card
<Pressable className="px-4 py-4 flex-row items-center justify-between active:opacity-70 border-b border-ds-outline-variant">
  <Text className="text-base font-barlow text-ds-on-surface">Label</Text>
  <ChevronRight size={18} color="#747878" />
</Pressable>

// Primary button (red)
<Pressable className="bg-ds-red rounded-xl py-4 items-center active:opacity-70">
  <Text className="text-white text-base font-barlow-semi">Action</Text>
</Pressable>

// Input field with icon
<View className="bg-ds-surface border border-ds-outline-variant rounded-xl flex-row items-center px-4">
  <SomeIcon size={18} color="#747878" />
  <TextInput className="flex-1 py-4 pl-3 text-base font-barlow text-ds-on-surface" />
</View>

// Large feature card (home screen style)
<Pressable className="bg-ds-red rounded-2xl p-5 active:opacity-80" style={{ minHeight: 140 }}>
  <View className="w-11 h-11 rounded-full bg-white/20 items-center justify-center mb-auto">
    <SomeIcon size={22} color="white" />
  </View>
  <View className="mt-6 flex-row items-end justify-between">
    <Text className="text-2xl font-barlow-condensed text-white">Label</Text>
    <ChevronRight size={20} color="white" />
  </View>
</Pressable>
```

#### Active / disabled states

- All tappable elements: `active:opacity-70` (cards: `active:opacity-80`)
- Disabled loading state: add `opacity-50` conditionally

#### Icons (lucide-react-native)

- `#1c1b1b` (`ds-on-surface`) — primary/strong icons
- `#444748` (`ds-on-surface-variant`) — secondary icons
- `#747878` (`ds-outline`) — tertiary icons in rows, placeholders
- Sizes: 18 (inline rows), 20–22 (headers/nav), 24 (standalone emphasis)

#### Tab bar

Active: `#ba1a1a` | Inactive: `#9ca3af` | Background: `#ffffff`

Tabs: **Home** (House), **Stats** (BarChart2), **Social** (Users)

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

## Roadmap

### Phase 1 — Game Engine (unblocks Stats and Social) ✅

Every game needs: setup screen (add players) → play screen (turn-by-turn scoring) → results screen. Logic lives in `lib/games/<slug>.ts` as pure functions.

- [x] **501 / 301** — X01 checkout detection, double-out rule, bust handling
- [x] **Cricket** — close 15–20 and Bull, mark system, points scoring
- [x] **Around the Clock** — sequential targeting 1–20, optional Bull
- [x] **Shanghai** — rounds 1–7, target segment per round, Shanghai instant-win
- [x] **Baseball** — 9 innings, runs counting per inning segment
- [x] **Halve-It** — 9-round target sequence, miss = halve score
- [x] **High Score** — 10 rounds, all segments score, highest total wins
- [x] **Bob's 27** — 20 rounds targeting double-N, elimination on zero

### Phase 1.5 — Remaining Game Formats ✅

- [x] **Killer** — assign numbers, earn Killer status, eliminate opponents (3+ players)
- [x] **Bermuda Triangle** — 12-round fixed target sequence, highest score wins

### Phase 2 — Stats (needs real game data) ✅

- [x] Personal bests per game type
- [x] Three-dart average calculation stored on session complete
- [x] Trend chart (last 10 sessions)
- [x] Game history filterable by game type and date
- [x] Cross-device sync: push completed sessions to Supabase on game end

### Phase 3 — Cloud Backend (Supabase) ✅

Schema and sync shipped:

- [x] `game_sessions` table — gameSlug, userId, status, startedAt, completedAt, `source_session_id` dedup key
- [x] `game_players` table — playerId, sessionId, placement, threeDartAvg, gameState
- [x] RLS: users can only read/write/update/delete their own sessions
- [x] Clerk webhook already syncs users → `users` table (done)
- [x] Idempotent upsert sync keyed on `(created_by, source_session_id)` — no duplicates on retry
- [x] Local `cloudSyncStatus` + `cloudSessionId` tracking on every completed session
- [x] `retryFailedSyncs` — retries all `failed` completed sessions on app launch via `SyncRetryOnMount`

### Phase 4 — Social / Clubs / Friends

- [ ] **Friends** — `friendships` table (userId, friendId, status: pending/accepted), friend request flow, mutual-follow model
- [ ] **Clubs** — `clubs`, `club_memberships`, `club_invites` tables; create club, search + join flow, admin management
- [ ] **Leaderboards** — club and global, driven by Supabase views + TanStack Query polling
- [ ] **Presence** — online / in-match status via Supabase Realtime (types already defined in `social.tsx`)
- [ ] Wire Social screen to real data, remove `PLACEHOLDER_CLUBS` and `PLACEHOLDER_FRIENDS`

### Phase 4.5 — Smart Game Setup (depends on Social)

The current setup screen requires typing every player name manually every game. The intended model:

- **You** — the signed-in user is auto-added as the first player (no typing). Needs `useUser()` lookup against `players.userId`. This can ship independently as a quick win before Phase 4.
- **Friends / club members** — selectable from a contact picker once the `friendships` and `club_memberships` tables exist (Phase 4). Shown as a list above the guest input.
- **Guests** — the "Add Player" text input remains, but only for people playing in-person who do not have an account.

Order of delivery:
1. Auto-add signed-in user (quick win, no Social needed)
2. Pick from friends / club members (after Phase 4 ships social graph)

### Phase 5 — Production Hardening

- [ ] Password reset flow (currently "Coming Soon" in sign-in)
- [ ] Push notifications — Expo Notifications + Supabase Edge Function trigger
- [ ] Error tracking — Sentry for React Native
- [ ] `expo-splash-screen` — hold splash open during font + migration load
- [ ] EAS Build configuration for App Store and Google Play submission
- [ ] App Store / Play Store metadata, icons, screenshots

## ECC Workflow

When working on features, follow this order:

1. `/plan` — Design the approach
2. `/code-review` — Review changes before finalizing
3. `/verify` — Verify everything works
