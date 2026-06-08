// AI coaching edge function — gate: AI_COACHING (off until Phase 11)
// When the gate is enabled, this function accepts aggregated player stats
// and returns 3 personalised coaching observations powered by Claude.

Deno.serve(async (_req) => {
  return new Response(
    JSON.stringify({ error: 'AI coaching is not yet available.' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  );
});
