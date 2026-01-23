import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface RunLog {
  timestamp: string;      // ISO 8601 format
  kudosGiven: number;
  errors: number;
  rateLimited: boolean;
  clubIds: string[];
  dryRun: boolean;
  durationMs: number;
  notes?: string;         // Optional manual annotation
}

const LOG_FILE = join(process.cwd(), 'runs.json');

export function appendRunLog(log: RunLog): void {
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

  // Append new log
  logs.push(log);

  // Write back to file
  try {
    writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2) + '\n');
    console.log(`\nRun logged to runs.json`);
  } catch (error) {
    console.error(`Failed to write runs.json: ${error}`);
  }
}
