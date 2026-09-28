import { readFileSync } from 'node:fs';
import { renderPaperMath } from '../../lib/paper-math.js';

const expressions = JSON.parse(readFileSync(0, 'utf8'));
const images = [];
for (const expression of expressions) images.push(await renderPaperMath(expression, true));
process.stdout.write(JSON.stringify(images));
