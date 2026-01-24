import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface RunLog {
  timestamp: string;      // ISO 8601 format
  kudosGiven: number;
  errors: number;
  rateLimited: boolean;
  dryRun: boolean;
  durationMs: number;
  dailyTotal?: number;    // Cumulative kudos for the day (up to and including this run)
  notes?: string;         // Optional manual annotation
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

export function appendRunLog(log: RunLog): number {
  let logs: RunLog[] = [];

  // Read existing logs if file exists
  if (existsSync(LOG_FILE)) {
    try {
      const content = readFileSync(LOG_FILE, 'utf-8');
      logs = JSON.parse(content);
      if (!Array.isArray(logs)) {
        console.warn('runs.json was not an array, starting fresh');
        logs = [];
      }
    } catch (error) {
      console.warn(`Failed to parse runs.json, starting fresh: ${error}`);
      logs = [];
    }
  }

  // Add run number to notes
  const runNumber = logs.length + 1;
  log.notes = `Run #${runNumber}`;

  // Append new log
  logs.push(log);

  // Calculate daily total for this run and set it on the log
  const dailyTotal = getDailyTotal(logs, logs.length - 1);
  log.dailyTotal = dailyTotal;

  // Write back to file
  try {
    writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2) + '\n');
  } catch (error) {
    console.error(`Failed to write runs.json: ${error}`);
  }

  console.log(`\nRun logged to runs.json (Daily total: ${dailyTotal} kudos)`);

  return dailyTotal;
}
