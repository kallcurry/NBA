// Refresh before an APK release: node scripts/update-season-snapshot.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { SEASON, getSeasonSchedule } from '../public/js/espn-client.js';

const season = await getSeasonSchedule();
if (season.partial || season.games.length < 1000) {
  throw new Error(`Refusing incomplete snapshot: ${season.count} games, ${season.failedTeams} failed teams`);
}
const directory = new URL('../public/assets/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL(`season-${SEASON}.json`, directory), JSON.stringify(season));
console.log(`Saved ${season.season}: ${season.count} games (${season.fetchedAt})`);
