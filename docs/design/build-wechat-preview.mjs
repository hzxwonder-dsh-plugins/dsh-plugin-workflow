import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderWechatPage } from '../../lib/paper-render.js';

const folder = dirname(fileURLToPath(import.meta.url));
const page = await readFile(join(folder, 'freetoken-reading-preview.html'), 'utf8');
const title = page.match(/<main class="article-card">[\s\S]*?<h1>([^<]+)<\/h1>/)?.[1];
if (!title) throw new Error('PREVIEW_TITLE_UNAVAILABLE');
const start = page.indexOf('<div id="post-inner">') + '<div id="post-inner">'.length;
const end = page.indexOf('</main>', start);
if (start < 25 || end < start) throw new Error('PREVIEW_ARTICLE_UNAVAILABLE');
const body = page.slice(start, end).replace(/<\/div>\s*$/, '').replace('src="freetoken-overview.svg"', 'src="/lab/assets/paper-overviews/freetoken-preview.svg"');
const overviewSvg = await readFile(join(folder, 'freetoken-overview.svg'), 'utf8');
await writeFile(join(folder, 'freetoken-wechat-preview.html'), renderWechatPage({
  title,
  html: body,
  overviewSvg,
}));
