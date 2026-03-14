# ECC for Codex CLI

This supplements the root `AGENTS.md` with Codex-specific guidance.

## Model Recommendations

| Task Type | Recommended Model |
|-----------|------------------|
| Routine coding, tests, formatting | GPT 5.4 |
| Complex features, architecture | GPT 5.4 |
| Debugging, refactoring | GPT 5.4 |
| Security review | GPT 5.4 |

## Skills Discovery

Skills are auto-loaded from `.agents/skills/`. Each skill contains:
- `SKILL.md` — Detailed instructions and workflow
- `agents/openai.yaml` — Codex interface metadata

Available skills:
- tdd-workflow — Test-driven development with 80%+ coverage
- security-review — Comprehensive security checklist
- coding-standards — Universal coding standards
- frontend-patterns — React/Next.js patterns
- frontend-slides — Viewport-safe HTML presentations and PPTX-to-web conversion
- article-writing — Long-form writing from notes and voice references
- content-engine — Platform-native social content and repurposing
- market-research — Source-attributed market and competitor research
- investor-materials — Decks, memos, models, and one-pagers
- investor-outreach — Personalized investor outreach and follow-ups
- backend-patterns — API design, database, caching
- e2e-testing — Playwright E2E tests
- eval-harness — Eval-driven development
- strategic-compact — Context management
- api-design — REST API design patterns
- verification-loop — Build, test, lint, typecheck, security
- deep-research — Multi-source research with firecrawl and exa MCPs
- exa-search — Neural search via Exa MCP for web, code, and companies
- claude-api — Anthropic Claude API patterns and SDKs
- x-api — X/Twitter API integration for posting, threads, and analytics
- crosspost — Multi-platform content distribution
- fal-ai-media — AI image/video/audio generation via fal.ai
- dmux-workflows — Multi-agent orchestration with dmux

## MCP Servers

Treat the project-local `.codex/config.toml` as the default Codex baseline for ECC. The current ECC baseline enables GitHub, Context7, Exa, Memory, Playwright, and Sequential Thinking; add heavier extras in `~/.codex/config.toml` only when a task actually needs them.

## Multi-Agent Support

Codex now supports multi-agent workflows behind the experimental `features.multi_agent` flag.

- Enable it in `.codex/config.toml` with `[features] multi_agent = true`
- Define project-local roles under `[agents.<name>]`
- Point each role at a TOML layer under `.codex/agents/`
- Use `/agent` inside Codex CLI to inspect and steer child agents

Sample role configs in this repo:
- `.codex/agents/explorer.toml` — read-only evidence gathering
- `.codex/agents/reviewer.toml` — correctness/security review
- `.codex/agents/docs-researcher.toml` — API and release-note verification

## Key Differences from Claude Code

| Feature | Claude Code | Codex CLI |
|---------|------------|-----------|
| Hooks | 8+ event types | Not yet supported |
| Context file | CLAUDE.md + AGENTS.md | AGENTS.md only |
| Skills | Skills loaded via plugin | `.agents/skills/` directory |
| Commands | `/slash` commands | Instruction-based |
| Agents | Subagent Task tool | Multi-agent via `/agent` and `[agents.<name>]` roles |
| Security | Hook-based enforcement | Instruction + sandbox |
| MCP | Full support | Supported via `config.toml` and `codex mcp add` |

## Security Without Hooks

Since Codex lacks hooks, security enforcement is instruction-based:
1. Always validate inputs at system boundaries
2. Never hardcode secrets — use environment variables
3. Run `npm audit` / `pip audit` before committing
4. Review `git diff` before every push
5. Use `sandbox_mode = "workspace-write"` in config

---

## Project-Specific Conventions (Darting)

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
