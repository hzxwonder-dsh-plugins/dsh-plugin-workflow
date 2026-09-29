import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderPaperMarkdown } from '../../lib/paper-render.js';

const folder = dirname(fileURLToPath(import.meta.url));
const markdown = await readFile(join(folder, 'freetoken-reading-sample.md'), 'utf8');
const { html } = await renderPaperMarkdown(markdown);
const body = html.replace(
  /(<h2 id="section-\d+">快速阅读<\/h2><ul class="quick-read">[\s\S]*?<\/ul>)(?=\s*<h2 id=)/,
  '$1\n<figure class="paper-overview"><img src="freetoken-overview.svg" alt="FreeToken 论文全景导图：研究问题、核心答案、预填、解码、运行时机制、证据与边界"></figure>',
);
if (!body.includes('src="freetoken-overview.svg"')) throw new Error('PREVIEW_OVERVIEW_MISSING');
const headings = [...body.matchAll(/<h2 id="(section-\d+)">([^<]+)<\/h2>/g)];
const toc = headings.map(([, id, title]) => `<li><a href="#${id}">${title}</a></li>`).join('\n');
const css = await readFile(join(folder, 'preview.css'), 'utf8');
const count = [...markdown].length;
const title = markdown.match(/^# (.+)$/m)?.[1];
if (!title) throw new Error('PREVIEW_TITLE_MISSING');
const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>FreeToken 论文解读 · 阅读样式预览</title><style>${css}</style></head><body>
<header class="site-header"><div class="site-header__inner"><a class="brand" href="#top"><span class="brand__mark">AI</span> AI Infra 学习札记</a>
<nav aria-label="主导航"><a href="#top">首页</a><a class="active" href="#top">文章</a><a href="#top">AscendC 学习</a><a href="#top">论文分享</a><a href="#top">实验场</a></nav></div></header>
<div class="page" id="top"><div class="breadcrumb">首页 <span>/</span> 论文分享 <span>/</span> 正文</div>
<div class="columns"><main class="article-card"><div class="article-topline">论文分享 <span>RESEARCH NOTE / 2026</span></div>
<h1>${title}</h1>
<div class="byline"><span class="author-dot">h</span><span>hzxwonder</span><span class="byline__sep">·</span><time>2026-09-29</time><span class="byline__sep">·</span><span>约 ${Math.round(count / 100) * 100} 字</span></div>
<div id="post-inner">${body}</div></main>
<aside class="sidebar"><div class="sidebar-card profile"><div class="profile__orb"></div><h2>AI Infra 学习札记</h2><p>把复杂系统讲清楚</p></div>
<div class="sidebar-card toc"><h2>文章目录</h2><ol>${toc}</ol></div></aside></div></div>
<footer>AI Infra 学习札记 · 论文解读样式预览</footer></body></html>`;
await writeFile(join(folder, 'freetoken-reading-preview.html'), page);
console.log(join(folder, 'freetoken-reading-preview.html'));
