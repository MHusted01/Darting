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

### Phase 4 — Social / Clubs / Friends ✅

- [x] **Friends** — `friendships` table (userId, friendId, status: pending/accepted), friend request flow, mutual-follow model
- [x] **Clubs** — `clubs`, `club_memberships`, `club_invites` tables; create club, search + join flow, admin management
- [x] **Leaderboards** — club leaderboard driven by `club_leaderboard_stats` Supabase view + TanStack Query
- [x] **Presence** — online / in-match status via Supabase Realtime (`usePresence` hook)
- [x] Wire Social screen to real data, removed `PLACEHOLDER_CLUBS` and `PLACEHOLDER_FRIENDS`

### Phase 4.5 — Smart Game Setup (depends on Social)

The current setup screen requires typing every player name manually every game. The intended model:

- **You** — the signed-in user is auto-added as the first player (no typing). Needs `useUser()` lookup against `players.userId`. This can ship independently as a quick win before Phase 4.
- **Friends / club members** — selectable from a contact picker once the `friendships` and `club_memberships` tables exist (Phase 4). Shown as a list above the guest input.
- **Guests** — the "Add Player" text input remains, but only for people playing in-person who do not have an account.

Order of delivery:
1. Auto-add signed-in user (quick win, no Social needed)
2. Pick from friends / club members (after Phase 4 ships social graph)

### Phase 5 — Production Hardening ✅

- [x] Password reset flow — Clerk `resetPasswordEmailCode` typed API, 3-step screen
- [x] Push notifications — `expo-notifications`, `usePushToken` hook, `notify-friend-request` edge function
- [x] Error tracking — Sentry initialised in root layout, `Sentry.wrap`, push token errors captured
- [x] `expo-splash-screen` — holds splash until fonts + SQLite migrations ready
- [ ] EAS Build — `eas.json` profiles configured; App Store / Play Store credentials + metadata still pending

---

### Phase 6 — Settings & Account Polish

Make every settings item functional; nothing shows "Coming Soon".

**Personal Info screen** (`app/(protected)/personal-info.tsx`)
- Edit first name, last name (Clerk `updateUser`)
- Change username — validated uniqueness via Supabase `users_username_lower_key` index
- Avatar: initials-based colour picker (no image upload yet)

**Security screen** (`app/(protected)/security.tsx`)
- Change password — reuse the `resetPasswordEmailCode` flow but from within the app (user is already signed in, confirm current password first via `signIn.password`, then `resetPasswordEmailCode` flow)
- Shows last sign-in time from Clerk session

**Notification preferences** (`app/(protected)/notification-prefs.tsx`)
- Per-event toggles stored in Supabase `users.notification_prefs` (JSONB column): friend requests, club invites, tournament updates, match challenges
- Toggles respected by `notify-friend-request` edge function and future notification edge functions

**Friends: unfriend**
- Add remove / unfriend action on existing friend list rows (soft delete from `friendships` table)
- Confirmation alert before removing

**Help Center** — static screen with FAQ content
**Privacy Policy** — opens system browser to a hosted URL (no in-app screen needed)
**Delete account** — Clerk `user.delete()` + cascade via Supabase RLS

**Feature gate architecture** (used from Phase 6 onward)
- `lib/subscription.ts` — `useFeatureGate(feature: FeatureName): boolean`
- All gates return `true` for now; designed to plug into RevenueCat entitlements later without refactoring call sites
- Gate checked at render time; gates: `UNLIMITED_STATS_HISTORY`, `CREATE_TOURNAMENT`, `AI_COACHING`, `REALTIME_GAMES`, `CREATE_CLUBS_UNLIMITED`, `JOIN_CLUBS_UNLIMITED`

---

### Phase 7 — Advanced Stats & Game Intelligence

Transform stats from a history viewer into a genuine coaching tool. Stats answer: "What do I need to practice to actually get better?"

#### Stat collection rules

- **Skill KPIs** (3-dart avg, checkout %, win rate, marks/round, personal bests): completed games only (`status = 'completed'`).
- **Segment accuracy / dart-count heatmap**: all sessions with turn data (completed + abandoned) — each dart is individually valid regardless of game outcome.
- **Engagement stats** (games started, abandon rate): all sessions.

#### Context tagging

Every `game_session` gets a `context` column: `'casual' | 'tournament' | 'practice' | 'realtime'`, defaulting to `'casual'`. Tournament games (Phase 9) set `'tournament'`; drill sessions set `'practice'`; real-time challenges (Phase 10) set `'realtime'`.

**Stats are unified — not forked.** Headline numbers (lifetime avg, personal bests) aggregate `casual + tournament`. A context filter pill on the stats screen lets you slice by context. Practice throws count toward the segment heatmap but are excluded from competitive KPIs by default. This prevents players from avoiding tournaments to "protect" their stats while still enabling "how do I perform under pressure?" analysis.

#### Schema changes

**Local SQLite** (`db/schema.ts` + new Drizzle migration):
- `gameSessions.context` — `text` enum `['casual','tournament','practice','realtime']` default `'casual'`
- `gamePlayers.analytics` — `text({mode:'json'})` nullable: `{ dartCounts, perGameKPIs, checkoutStats }` stored per-player (not per-session) so multi-player games get individual blobs

**Cloud** (new Supabase migration):
- `ALTER TABLE game_sessions ADD COLUMN context text NOT NULL DEFAULT 'casual'`
- `ALTER TABLE game_players ADD COLUMN analytics jsonb, ADD COLUMN dart_counts jsonb, ADD COLUMN checkout_stats jsonb`
- New RPC `get_player_public_stats(p_user_id text)` — `security definer`, returns aggregate KPIs only (mirrors `get_club_leaderboard` privacy model); checks friendship/club-mutual relationship before returning

**Sync mapping** (`lib/supabase-sync.ts` `buildPlayerPayloads` / `buildSessionPayload`):
- `gameSessions.context` → `game_sessions.context` (1-to-1)
- `gamePlayers.analytics` (full blob) → `game_players.analytics` (same blob)
- `gamePlayers.analytics.dartCounts` → `game_players.dart_counts` (promoted to top-level column for direct SQL queries)
- `gamePlayers.analytics.checkoutStats` → `game_players.checkout_stats` (promoted to top-level column)
- `gamePlayers.analytics.perGameKPIs` — stays inside the `analytics` blob only; no dedicated cloud column
- `get_player_public_stats` and `get_club_leaderboard` aggregate from `game_players` / `game_sessions` directly; raw dart data (`dart_counts`, `checkout_stats`) is never returned by either RPC

#### Phase 7a — Engine + capture (foundation)

- `lib/games/analytics.ts` — pure functions: `computeSessionAnalytics(session, turns)` → `{ dartCounts, perGameKPIs, checkoutStats }`. Per-game KPI calculators reuse existing `lib/games/*` helpers.
- Hook computation into session-complete in the results screen; store blob on `gamePlayers.analytics`.
- One-time backfill for existing completed sessions (idempotent, keyed on null `analytics`).
- Extend `supabase-sync.ts` `buildPlayerPayloads` to send new columns + `buildSessionPayload` to send `context`.

#### Phase 7b — Self stats UI

**Segment accuracy heatmap**
- Hit rate per number 1–20 + bull, with single/double/triple/miss breakdown
- Filterable by game type and context pill
- Includes abandoned sessions (raw dart data is valid regardless of completion)

**Per-game-type KPI dashboards** — each game gets its meaningful coaching metrics:

| Game | Key stats |
|---|---|
| **X01 (501/301)** | 3-dart avg, first-9-dart avg, checkout % per double, highest checkout, 180s / 140s / 100+ count, bust rate |
| **Cricket** | Marks per round (MPR), hit rate on 15–20 + bull, segments closed efficiency, points conceded |
| **Around the Clock** | Darts per number (which numbers need work), total darts to complete, stuck-number count |
| **Shanghai** | Hit rate per round-target (1–7), triples hit, Shanghais achieved |
| **Baseball** | Runs per inning, hit rate on inning segment |
| **Halve-It** | Halve count, hit rate per target including doubles/triples rounds |
| **High Score** | Avg score per round, best single round |
| **Bob's 27** | Doubles hit rate by number, rounds survived, elimination rate |
| **Killer** | Hits on own number, opponent eliminations, survival rate |
| **Bermuda Triangle** | Hit rate per fixed target in the 12-round sequence |

Target-based games (ATC, Shanghai, Baseball, Bob's 27, Bermuda, Halve-It) have a deterministic target per round number — since `roundNumber` is stored, intended-target accuracy is computable without any extra capture.

**Universal coaching metrics** (every game type):
- Consistency (std-dev of per-turn scores)
- Improvement velocity (KPI slope over last N sessions)
- Session fatigue (KPI by round-number bucket — "your avg drops after round 12")
- Head-to-head stats vs a specific opponent (filter sessions containing their `playerId`)

**Checkout analysis (X01)**
- Attempt detection: double thrown while `remaining ≤ 50` = attempt (labeled "estimated")
- Best closer / worst closer — top and bottom doubles by success rate
- Suggested doubles to practice (lowest success rate with ≥ meaningful attempt count)

**Extended trends**
- Trend chart extended from last 10 → last 30 sessions, per-KPI, per-game-type breakdown
- Full history gated behind `UNLIMITED_STATS_HISTORY` (free tier: last 3 months / ~90 sessions)

#### Phase 7c — Intelligence + social profile

**Rule-based improvement suggestions**
- `lib/suggestions.ts` — deterministic rules engine
- Rules: low doubles %, low average for game type, inconsistent finishing, high bust rate, etc.
- Each suggestion maps to a named drill in `constants/drills.ts` catalogue
- Drill detail screen: what to practice, how to score it, benchmark targets

**Friend / club member stat profile** (`app/(protected)/friend/[userId].tsx`)
- Tapping a friend or club member row navigates to their profile (aggregate-only)
- Stats shown: 3-dart avg, games played, win rate, per-game KPIs via `get_player_public_stats` RPC
- Raw dart data stays self-only (RLS on `game_turns` is unchanged)
- Phase 8 enriches this same file with recent games, streak, mutual clubs, challenge CTA — do not duplicate or re-create the file in Phase 8

**Claude-powered coaching (gated)**
- Gate: `AI_COACHING` (off by default until Phase 11)
- When gate open: call Claude API with aggregated stats JSON → return 3 personalised coaching observations
- Prompt lives in `supabase/functions/ai-coaching/index.ts` (edge function to keep API key server-side)

---

### Phase 8 — Social Evolution

**Club social feed**
- New tables: `club_posts` (clubId, authorId, body, createdAt), `club_post_comments` (postId, authorId, body), `club_post_reactions` (postId, userId, type)
- Feed tab within each club screen; infinite scroll via TanStack Query + cursor pagination
- Post creation: text + optional auto-attach of a recent game result
- Comments: threaded (one level deep)
- @mentions: parse `@username` in body, notify mentioned user via push
- Reactions: 👍 🎯 🔥 (stored as type enum, aggregated count shown)
- Moderation: club admins can delete any post/comment

**Friends evolution**
- Friend profile screen (`app/(protected)/friend/[userId].tsx`) — **file created in Phase 7 with aggregate KPI cards**; Phase 8 extends it with:
  - Recent games list, current streak
  - Mutual clubs shown
  - "Challenge to a game" CTA (Phase 10)
- Friend activity feed on Social tab (friends' recent completed games)
- Push notification for friend request accepted (new edge function `notify-friend-accepted`)

---

### Phase 9 — Tournaments

**Schema**
- `tournaments` — id, clubId (nullable for multi-club), createdBy, name, format (`league`|`cup`|`weekly`|`round_robin`), gameSlug, status, startDate, endDate, settings (JSONB: legs per match, double-out, etc.)
- `tournament_participants` — tournamentId, userId, clubId (for multi-club), seeding
- `tournament_rounds` — tournamentId, roundNumber, status
- `tournament_matches` — roundId, participant1Id, participant2Id, winnerId, gameSessionId (linked to a real scored game)
- `divisions` — id, name, adminUserId (for multi-club league organisation)
- `division_clubs` — divisionId, clubId

**Formats**
- **League / Season** — points table (W=3, D=1, L=0), configurable season length; standings view
- **Knockout / Cup** — auto-generated bracket, best-of-X legs per tie; bracket visualisation
- **Weekly Challenge** — auto-recurring (pg_cron edge function resets every Monday); open to all club members; ranks by score in chosen game type
- **Round Robin** — everyone plays everyone once; winner by most wins then leg difference

**Multi-club tournaments**
- Division admin creates a tournament, invites clubs (invite by club name/code)
- Club admins accept the division invite
- Players in invited clubs can participate
- Standings show per-club and per-player rankings

**Tournament creation flow** — gated behind `CREATE_TOURNAMENT` (free for now)

**Integration with game engine**
- "Play tournament match" CTA on match card → launches normal game setup pre-filled with both players and match settings → on complete, result is recorded against the match
- Sets `game_sessions.context = 'tournament'` and links `tournament_match_id` so tournament performance is filterable in stats but contributes to lifetime KPIs

---

### Phase 10 — Real-Time Multiplayer

Play against a friend or club member in real time from different locations.

**Architecture**
- `game_challenges` Supabase table — challengerId, challengeeId, gameSlug, settings (JSONB), status (`pending`|`accepted`|`declined`|`in_progress`|`complete`)
- Lobby: Supabase Realtime channel per challenge (`challenge:<id>`)
- Shared game state: each player's turn result is broadcast via Realtime; opponent sees live score update between throws
- Turn enforcement: server-side validation via edge function `validate-turn` — prevents cheating by verifying turn belongs to the active player

**Flow**
1. Player A taps "Challenge" on a friend/club member profile
2. Supabase INSERT to `game_challenges` → push notification to Player B (`notify-game-challenge` edge function)
3. Player B accepts → both enter lobby screen, see each other's online status
4. Game starts: turn-based, each player scores their own darts; opponent sees real-time update
5. On game complete: result synced to `game_sessions` as normal; recorded in both players' stats

**Spectator mode**
- Club members can join a read-only Realtime subscription on an active challenge to watch live

**Gate**: `REALTIME_GAMES` (off by default; free for now)

---

### Phase 11 — UI / UX Optimisation

A dedicated polish pass across all screens before App Store submission.

- Empty states: every list screen has an illustrated empty state with a clear CTA
- Skeleton loaders: replace `ActivityIndicator` with skeleton screens on all data-fetching screens
- Haptic feedback: `expo-haptics` on button presses, game score submission, achievements
- Reanimated micro-interactions: card press scale, list item slide-in, tab switch transitions
- Accessibility: ensure all interactive elements have `accessibilityLabel`, support Dynamic Type, VoiceOver/TalkBack passes
- Keyboard avoidance: `KeyboardAvoidingView` on all form screens
- Pull-to-refresh on all feed / list screens
- Error boundary wrapping key screens (Sentry-aware)
- Review every "Coming Soon" remnant — replace or remove

---

### Phase 12 — Subscription & Monetisation

When income is needed. Requires Apple Developer account in good standing and Google Play Console setup.

**Platform**: RevenueCat (`react-native-purchases`)

**Free tier** (permanent, not a trial):
- All game types, unlimited local play
- Stats history: last 3 months
- Join up to 2 clubs
- Up to 15 friends
- Participate in tournaments (join, not create)
- Basic improvement suggestions

**Pro tier** (subscription):
- Unlimited stats history
- Create clubs (members always free to join)
- Create & manage tournaments at club and division level
- Advanced stats: segment heatmap, checkout analysis, full historical breakdown
- AI coaching (Claude-powered, ~3 analyses/month)
- Real-time games against friends
- Unlimited friends + clubs

**Implementation**
- RevenueCat SDK initialised in root layout
- `lib/subscription.ts` `useFeatureGate` updated to query RevenueCat entitlements instead of returning `true`
- Paywall screen triggered on gate fail
- Supabase webhook from RevenueCat to sync subscription status to `users.subscription_tier`

---

## ECC Workflow

When working on features, follow this order:

1. `/plan` — Design the approach
2. `/code-review` — Review changes before finalizing
3. `/verify` — Verify everything works
