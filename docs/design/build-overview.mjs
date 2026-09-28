import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderPaperOverview } from '../../lib/paper-overview.js';

const folder = dirname(fileURLToPath(import.meta.url));
const source = JSON.parse(await readFile(join(folder, 'freetoken-overview.json'), 'utf8'));
const { svg, scene } = await renderPaperOverview(source);
await Promise.all([
  writeFile(join(folder, 'freetoken-overview.svg'), svg),
  writeFile(join(folder, 'freetoken-overview.excalidraw'), JSON.stringify(scene, null, 2) + '\n'),
]);
