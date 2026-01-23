/**
 * One-time migration script to backfill dailyTotal for existing log entries.
 * Run with: bun scripts/backfill-daily-totals.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface RunLog {
  timestamp: string;
  kudosGiven: number;
  errors: number;
  rateLimited: boolean;
  clubIds: string[];
  dryRun: boolean;
  durationMs?: number;
  dailyTotal?: number;
  notes?: string;
}

const LOG_FILE = join(process.cwd(), 'runs.json');

function getDailyTotal(logs: RunLog[], targetIndex: number): number {
  const targetLog = logs[targetIndex];
  const targetDate = new Date(targetLog.timestamp);

  // Use UTC to get the day boundary
  const dayStart = new Date(Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate(),
    0, 0, 0, 0
  ));
  const dayEnd = new Date(Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate() + 1,
    0, 0, 0, 0
  ));

  // Sum all non-dry-run logs on the same UTC day, up to and including targetIndex
  let total = 0;
  for (let i = 0; i <= targetIndex; i++) {
    const log = logs[i];
    const logDate = new Date(log.timestamp);
    if (logDate >= dayStart && logDate < dayEnd && !log.dryRun) {
      total += log.kudosGiven;
    }
  }
  return total;
}

// Read existing logs
const content = readFileSync(LOG_FILE, 'utf-8');
const logs: RunLog[] = JSON.parse(content);

console.log(`Processing ${logs.length} log entries...\n`);

// Calculate and set dailyTotal for each log
for (let i = 0; i < logs.length; i++) {
  const log = logs[i];
  const dailyTotal = getDailyTotal(logs, i);
  log.dailyTotal = dailyTotal;

  const date = new Date(log.timestamp).toISOString().split('T')[0];
  console.log(`${log.notes || `Run #${i + 1}`}: ${log.kudosGiven} kudos, dailyTotal = ${dailyTotal} (${date})`);
}

// Write back to file
writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2) + '\n');

console.log(`\nBackfill complete. Updated ${logs.length} entries in runs.json`);
