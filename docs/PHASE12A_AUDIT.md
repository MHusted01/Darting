# Phase 12a — Product Logic Audit Report

Date: 2026-06-10 · Branch: `feat/logic-audit` · Scope: CLAUDE.md §12a (full correctness audit + the 5 pre-verified findings)

Verdicts: **PASS** (correct as-is) · **FIXED** (corrected in this branch, with tests) · **DEFERRED** (logged with reason, not fixed here)

---

## 1. Stats

| Item | Verdict | Detail |
|---|---|---|
| Finding 1 — `get_player_public_stats.avg_three_dart_avg` mixed all game types | **FIXED** | Top-level avg and the per-slug `per_game_kpis` averages now `FILTER (WHERE … game_slug = 'x01')` in migration `20260629000000_x01_only_three_dart_avgs.sql` (historical non-x01 `three_dart_avg` values can no longer surface). `games_played` and `win_rate` intentionally stay all-games. |
| Finding 2 — `getTrendData` All-Games trend mixed 3DA across slugs | **FIXED** | `resolveTrendSlug` defaults the trend to `x01` when no slug filter is active (`lib/stats.ts`); explicit slug filters unchanged. Trend chart label updated to "501/301 Sessions" in All-Games view. Tests: `lib/__tests__/stats-three-dart.test.ts`. |
| Finding 3 — friends-list `threeDartAvg` always null | **FIXED** | New `get_friends_three_dart_avgs` RPC (x01-only, completed, non-practice, realtime-deduped); `getFriends` fetches in parallel and merges via `mapFriendRow`. RPC failure is non-fatal (falls back to null/"—"). Tests: `lib/__tests__/friends.test.ts`. |
| Finding 4 — `get_club_leaderboard` mixed all game types | **FIXED** | Avg now x01-only. Also aligned with `get_player_public_stats` semantics: participation-based (counts sessions the member played, not just created), excludes `context='practice'`, realtime-deduped (creator copy only). Client contract (RPC name/args, null mapping) already guarded in `app/__tests__/lib/clubs.test.ts`. |
| Finding 5 — `threeDartAvg` stored for every game type | **FIXED** | `sessionThreeDartAvg` stores a numeric value for x01 and `null` otherwise (`hooks/usePlaySession.ts`). Historical non-x01 values remain in both DBs but no aggregate consumes them cross-game after Findings 1–4. Tests: `hooks/__tests__/usePlaySession.threeDartAvg.test.ts`. |
| `getOverallThreeDartAvg` (stats hero) | **PASS** | Already x01-filtered. Local DB holds only the player's own copy of realtime sessions, so no dedup needed locally. |
| `getAggregatedStats`, `getCheckoutStats`, `getPerGameKPIs` | **PASS** | x01 KPIs computed from x01-filtered rows; checkout stats forced to `slug: 'x01'`; per-game KPIs always slug-scoped. |
| `getPersonalBests` per-game `avgThreeDartAvg` | **PASS** (note) | Grouped by slug, so never mixed. Non-x01 rows will fade to null going forward (UI null-guards at `stats.tsx:492`). |
| Context filter behaviour | **PASS** | Default excludes `practice`, `'all'` includes everything, explicit context filters exactly — verified in `fetchPlayerSessionRows`/`getTrendData`. |
| `getPersonalBests`/`getOverallThreeDartAvg` lack a practice-context exclusion | **DEFERRED** | Latent only: nothing in the app ever creates `context='practice'` sessions today (drill screens are catalogue/instructions, not scored sessions). Add the filter when drill-scored sessions ship. |
| Heatmap excludes abandoned sessions (Phase 7 rules say include) | **DEFERRED** | `getSegmentAccuracy` reads the per-player `analytics` blob, which is only computed at session completion — abandoned sessions have no blob to aggregate. Including them requires computing analytics on abandon (a behavioural change beyond 12a's correctness scope). |
| All remaining `threeDartAvg` UI consumers | **PASS** | Grepped every consumer: all null-guard ("—" / conditional render) or are x01-derived (`buildX01Results`, suggestions x01 KPI). |

## 2. Game logic (`lib/games/*`)

| Module | Verdict | Detail |
|---|---|---|
| `x01.ts` | **PASS** | 39 existing tests; checkout (≤170 + double), bust, double-out covered. |
| `cricket.ts` | **PASS** + new tests | Re-checked vs standard rules: mark accumulation, close at 3, excess-marks-on-closing-dart scoring, no scoring once all opponents close, no triple bull, win = closed all + points ≥ all, all-closed → highest points. 24 new tests in `app/__tests__/lib/games/cricket.test.ts` — no bugs found. |
| `around-the-clock.ts` | **PASS** + new tests | Sequential 1–20 (+optional bull as 21), any multiplier counts, early stop on completion, immutability. 12 new tests in `around-the-clock.test.ts` — no bugs found. |
| `results.ts` | **PASS** + new tests | X01 3DA derivation, winner-first sort orders, cricket hit/mark counting, ATC target capping, score-game extraction. 7 new tests in `results.test.ts` — no bugs found. |
| `shanghai/baseball/halve-it/high-score/bobs-27/killer/bermuda-triangle` | **PASS** | Existing dedicated suites (12–28 tests each) cover instant-win, elimination, halving, inning, and phase rules. |
| Engine ↔ analytics consistency | **PASS** | `analytics.ts` checkout success (`remaining === 0` after ≤170 + double) matches `x01.ts` completion (`remaining ≤ 0 ∧ multiplier === 2` with bust guard); both verified by existing suites. |

## 3. Social

| Item | Verdict | Detail |
|---|---|---|
| Friendships flow (request/accept/decline/remove/search) | **PASS** | `lib/friends.ts` fully scoped by userId; 50+ existing tests across two suites. |
| Presence merge | **PASS** | `mergePresence` defaults to offline, immutable map. |
| Friend activity dedupe | **PASS** | `get_friends_activity` realtime dedup (creator copy only) shipped in `20260628`; keyset pagination fixed in `20260620000006/9`. |
| Mentions / reactions / moderation | **PASS** | Parse + notify, reaction enum + aggregation, admin delete policies all covered by existing suites (club-feed, reactions, mentions). |
| Friend profile "By Game" averages (`per_game_kpis`) | **FIXED** (partial) | Per-slug averages now x01-filtered in the RPC, so historical non-x01 `three_dart_avg` values no longer render as fake averages (UI handles the empty/x01-only object). Replacing the section with real per-game KPIs (MPR for cricket, etc.) is still deferred to the 12b+ stats work. |

## 4. DB / sync / RPCs / edge functions

| Item | Verdict | Detail |
|---|---|---|
| RLS policies | **PASS** | User-scoped session/player/turn policies unchanged this phase; new RPCs are `SECURITY DEFINER` scoped by `auth.jwt() ->> 'sub'` (friendship-bound), matching `get_friends_activity`. No table grants changed. |
| `get_player_public_stats` / `get_club_leaderboard` / `get_friends_three_dart_avgs` | **FIXED** | See §1. Migration `20260629000000_x01_only_three_dart_avgs.sql`; `CREATE OR REPLACE` → idempotent. |
| `advance_challenge_turn` + `validate-turn` | **PASS** | CAS turn-order check, stale-seq rejection, payload schema validation, JWT forwarding, status→HTTP mapping reviewed — no gaps found. |
| Local↔cloud sync mapping | **PASS** | `buildSessionPayload` (config/context/source_session_id), `buildPlayerPayloads` (analytics, dart_counts, checkout_stats, nullable three_dart_avg), idempotent upsert + delete-then-insert turns — 44 existing tests. |
| Migration idempotency | **PASS** | All function migrations use `CREATE OR REPLACE`; new migration follows the same pattern. |
| Weekly pg_cron reset (`20260621`, commented out) | **DEFERRED** | Pre-existing known gap; requires the pg_cron extension on the project. Tracked under 12d. |

## 5. Coaching

| Item | Verdict | Detail |
|---|---|---|
| Suggestion thresholds | **PASS** | bust >15%/25%, doubles <20%, checkout <20%/10%, 3DA <45/30, MPR <3.0 — sane vs amateur benchmarks; min 5 games enforced; 16 existing tests. |
| Drill mappings | **PASS** | Every suggestion maps to an existing drill in `constants/drills.ts` (practice-doubles, reduce-busts, cricket-consistency, atc-accuracy). |
| Suggestion inputs | **PASS** | x01 suggestions read x01-scoped KPIs (`stats.x01`), unaffected by cross-game pollution. |
| `ai-coaching` edge function | **PASS** (note) | Server-side key, gated by `AI_COACHING`, consumes aggregated stats only. Output is non-deterministic — no automated test; prompt re-validation lands with 12c. |

## 6. Cross-feature coherence

| Item | Verdict | Detail |
|---|---|---|
| Tournament match → stats → leaderboards → feeds | **PASS** | Matches link `game_session_id`, sessions tagged `context='tournament'`, results flow into the same `game_players` aggregates the leaderboard/feed RPCs read. |
| Realtime sessions counted exactly once per player | **PASS** | Each device syncs its own copy; every social RPC (including the two redefined + the new one) applies `gs.context <> 'realtime' OR gs.created_by = <player>`. |
| Club leaderboard vs player profile consistency | **FIXED** | Previously the leaderboard only counted creator sessions (joined multi-player sessions invisible) and lacked practice/realtime guards — now identical semantics to `get_player_public_stats`. Expect leaderboard numbers to shift after the migration (more games counted, x01-only averages). |

---

## Summary

- 5/5 pre-verified findings **fixed with tests** (cloud fixes via `supabase/migrations/20260629000000_x01_only_three_dart_avgs.sql`).
- 1 bonus fix: club leaderboard participation/practice/realtime semantics.
- 43 new game-rule tests (cricket, around-the-clock, results) — **no rule bugs found**.
- 4 deferred items, each with reason: practice-context filter (no producer exists), heatmap abandoned sessions (needs analytics-on-abandon), friend-profile per-game KPI surface (12b+), weekly pg_cron reset (12d).

**Post-deploy note**: apply the migration with `npx supabase db push`. Club leaderboards and friend-profile averages will visibly change (x01-only, participation-based) — this is the intended correction.
