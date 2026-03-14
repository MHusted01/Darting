#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const threshold = Number(process.env.COMPACT_THRESHOLD ?? 50);
const reminderEvery = Number(process.env.COMPACT_REMINDER_EVERY ?? 25);
const stateFile =
  process.env.COMPACT_STATE_FILE ??
  path.join(os.tmpdir(), 'strategic-compact-state.json');

function readState() {
  try {
    const raw = fs.readFileSync(stateFile, 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed.count === 'number' ? parsed : { count: 0 };
  } catch {
    return { count: 0 };
  }
}

function writeState(nextState) {
  const dir = path.dirname(stateFile);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(nextState), 'utf8');
}

function shouldSuggest(count) {
  if (count < threshold) return false;
  if (count === threshold) return true;
  return (count - threshold) % reminderEvery === 0;
}

function buildMessage(count) {
  return [
    '[Strategic Compact] Consider running /compact at a task boundary.',
    `Tool calls this session: ${count} (threshold: ${threshold}, reminder: every ${reminderEvery}).`,
    'Compact after milestones (research -> plan, plan -> implement, debug -> next feature).',
  ].join('\n');
}

function main() {
  try {
    const state = readState();
    const nextState = { count: state.count + 1 };
    writeState(nextState);

    if (shouldSuggest(nextState.count)) {
      process.stdout.write(`${buildMessage(nextState.count)}\n`);
    }
  } catch {
    // Hooks should fail open: do not block user operations.
  }
}

main();
