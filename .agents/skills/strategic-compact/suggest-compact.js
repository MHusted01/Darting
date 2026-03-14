#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_THRESHOLD = 50;
const DEFAULT_REMINDER_EVERY = 25;
const DEBUG_HOOKS = /^(1|true)$/i.test(process.env.DEBUG_HOOKS ?? '');

function parsePositiveInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

const threshold = parsePositiveInt('COMPACT_THRESHOLD', DEFAULT_THRESHOLD);
const reminderEvery = parsePositiveInt('COMPACT_REMINDER_EVERY', DEFAULT_REMINDER_EVERY);
const sessionId = process.env.COMPACT_SESSION_ID ?? `${process.pid}-${Date.now()}`;
const stateFile =
  process.env.COMPACT_STATE_FILE ??
  path.join(os.tmpdir(), `strategic-compact-state-${sessionId}.json`);
const lockFile = `${stateFile}.lock`;

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withStateLock(fn) {
  const dir = path.dirname(stateFile);
  fs.mkdirSync(dir, { recursive: true });

  const startedAt = Date.now();
  const lockTimeoutMs = 1000;
  const retryDelayMs = 25;
  let lockFd;

  while (true) {
    try {
      lockFd = fs.openSync(lockFile, 'wx');
      break;
    } catch (err) {
      if (err && err.code === 'EEXIST') {
        if (Date.now() - startedAt >= lockTimeoutMs) {
          throw new Error(`Timed out acquiring lock for ${lockFile}`);
        }

        sleep(retryDelayMs);
        continue;
      }

      throw err;
    }
  }

  try {
    return fn();
  } finally {
    if (typeof lockFd === 'number') {
      fs.closeSync(lockFd);
    }

    try {
      fs.unlinkSync(lockFile);
    } catch (err) {
      if (!err || err.code !== 'ENOENT') {
        if (DEBUG_HOOKS) {
          const message = err instanceof Error ? (err.stack || err.message) : String(err);
          process.stderr.write(`[strategic-compact] failed to remove lock file (${lockFile}): ${message}\n`);
        }
      }
    }
  }
}

function readState() {
  try {
    const raw = fs.readFileSync(stateFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Number.isInteger(parsed.count) && parsed.count >= 0 ? parsed : { count: 0 };
  } catch {
    return { count: 0 };
  }
}

function writeState(nextState) {
  const dir = path.dirname(stateFile);
  fs.mkdirSync(dir, { recursive: true });
  const tempFile = `${stateFile}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(nextState), 'utf8');
  fs.renameSync(tempFile, stateFile);
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
    const nextState = withStateLock(() => {
      const state = readState();
      const currentCount = Number.isInteger(state.count) && state.count >= 0 ? state.count : 0;
      const updatedState = { count: currentCount + 1 };
      writeState(updatedState);
      return updatedState;
    });

    if (shouldSuggest(nextState.count)) {
      process.stdout.write(`${buildMessage(nextState.count)}\n`);
    }
  } catch (err) {
    if (DEBUG_HOOKS) {
      const message = err instanceof Error ? (err.stack || err.message) : String(err);
      process.stderr.write(`[strategic-compact] suggest-compact failed: ${message}\n`);
    }

    // Hooks should fail open: do not block user operations.
  }
}

main();
