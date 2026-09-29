import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderPaperOverview } from '../lib/paper-overview.js';
import { insertPaperOverview, renderPaperMarkdown, renderWechatPage } from '../lib/paper-render.js';
import { renderPaperMath } from '../lib/paper-math.js';

const overview = {
  title: '一张图读懂论文逻辑',
  steps: [
    { label: '问题', title: '专家池大于显存', detail: '搬运形成瓶颈。' },
    { label: '预填', title: '双缓冲流水线', detail: '搬运与计算重叠。' },
    { label: '解码', title: '按带宽分工', detail: 'PCIe 与 CPU 并发。' },
    { label: '执行', title: '图内调度', detail: '控制留在设备上。' },
  ],
  evidence: '论文在六台机器上测试。',
  boundary: '机器带宽需要实测。',
};

test('paper renderer produces accessible math, adjacent Q/A and overview assets', async () => {
  const markdown = `# 论文精读\n\n## 论文信息\n\n- **题名：** Example Paper\n- **作者：** Example Author\n- **版本：** arXiv\n- **原文：** https://example.org/paper\n\n## 快速阅读\n\n- 问题：专家池超出显存。\n- 方法：带宽分工。\n\n${'一段清晰的简介。'.repeat(27)}\n\n## 方法\n\n未命中数量为 $m$，显卡填充 $q^\\star$ 个专家。\n\n$$\nq^* \\approx m \\frac{B_P}{B_H}\n$$\n\n> **Q：** 为什么要分工？\n>\n> **A：** 因为有两条执行路径。\n`;
  const withOverview = insertPaperOverview(markdown, '/lab/assets/paper-overviews/example-a1b2.svg');
  assert(withOverview.indexOf('论文逻辑总览图') < withOverview.indexOf('## 方法'));
  const rendered = await renderPaperMarkdown(withOverview);
  assert.equal(rendered.formulas, 3);
  assert.equal(rendered.headings, 3);
  assert.match(rendered.html, /data:image\/png;base64/);
  assert.match(rendered.html, /paper-inline-math/);
  assert.match(rendered.html, /style="display:inline-block/);
  assert.match(rendered.html, /class="paper-equation"[^>]*overflow:hidden/);
  assert.doesNotMatch(rendered.html, /\$q\^\\star\$/);
  assert.doesNotMatch(rendered.html, /<math/);
  assert.match(rendered.html, /paper-qa-question/);
  assert.match(rendered.html, /class="paper-source"/);
  assert.match(rendered.html, /class="quick-read"/);
  assert.match(rendered.html, /class="paper-overview"/);
  assert.match(rendered.html, /Q：/);
  assert(!rendered.html.includes('<p>' + '一段清晰的简介。'.repeat(27) + '</p>'));
  const diagram = await renderPaperOverview(overview);
  assert.match(diagram.svg, /<svg/);
  assert.match(diagram.svg, /<path/);
  assert.doesNotMatch(diagram.svg, /<text/);
  assert.equal(diagram.scene.type, 'excalidraw');
  assert(diagram.scene.elements.filter(element => element.type === 'line').length >= 6);
  assert.match(diagram.svg, /width="820" height="752"/);
  assert.equal(diagram.scene.elements.filter(element => element.type === 'rectangle').length, overview.steps.length + 3);
  const wechat = renderWechatPage({ title: '论文精读', html: rendered.html, overviewSvg: diagram.svg });
  assert.match(wechat, /复制公众号排版/);
  assert.match(wechat, /text\/html/);
  assert.match(wechat, /data:image\/svg\+xml;base64/);
  assert.match(wechat, /background-size:24px 24px/);
  assert.doesNotMatch(wechat, /overflow:auto;padding:16px 20px/);
  assert.doesNotMatch(wechat, /<a\b/);
});

test('paper argument map keeps the focus question, mechanisms, evidence and limits readable', async () => {
  const sample = JSON.parse(await readFile(new URL('../docs/design/freetoken-overview.json', import.meta.url), 'utf8'));
  const diagram = await renderPaperOverview(sample);
  assert.match(diagram.svg, /width="760" height="\d+"/);
  assert.match(diagram.svg, /<title id="overview-title">FreeToken/);
  assert.match(diagram.svg, /语义边界/);
  assert.match(diagram.svg, /CUDA Graph/);
  assert.match(diagram.svg, /六台机器/);
  assert.match(diagram.svg, /尚未验证/);
  assert.doesNotMatch(diagram.svg, /<text\b/);
  assert(Buffer.byteLength(diagram.svg) < 1024 * 1024);
  assert.equal(diagram.scene.elements.filter(element => element.type === 'rectangle').length, sample.branches.length + 4);
  assert(diagram.scene.elements.filter(element => element.type === 'rectangle').every(element => element.roughness >= 1));
  const strokes = diagram.scene.elements.filter(element => element.type === 'line');
  assert(strokes.length >= sample.branches.length * 4);
  assert(strokes.every(element => element.roughness > 0));
  assert(strokes.some(element => element.strokeWidth >= 4));
  assert.equal(diagram.scene.appState.currentItemFontFamily, 1);
  const visibleText = diagram.scene.elements.filter(element => element.type === 'text').map(element => element.text).join('');
  assert(diagram.scene.elements.filter(element => element.type === 'text').every(element => element.fontFamily === 1));
  assert(visibleText.includes('专家池远超显存'));
  assert(!visibleText.includes('PAPER MAP'));
  assert(!visibleText.includes('展开为以下机制'));
  assert(!visibleText.includes('论文给出的答案'));
  assert(!visibleText.includes('还不能推出什么'));
  await assert.rejects(renderPaperOverview({ ...sample, branches: sample.branches.slice(0, 2) }), /PAPER_OVERVIEW_INVALID/);
  await assert.rejects(renderPaperOverview({ ...sample, thesis: '简'.repeat(76) }), /PAPER_OVERVIEW_INVALID/);
});

test('display formulas retain body-sized image dimensions', async () => {
  const image = await renderPaperMath('q^\\star \\approx m\\frac{B_P}{B_H}', true);
  const [, width, height] = image.match(/width="(\d+)" height="(\d+)"/) ?? [];
  assert(Number(width) < 170);
  assert(Number(height) < 60);
  assert.match(image, new RegExp(`style="[^"]*width:${width}px;height:auto`));
  const png = Buffer.from(image.match(/base64,([^"]+)/)[1], 'base64');
  assert.equal(png.readUInt32BE(16), Number(width) * 2);
  assert.equal(png.readUInt32BE(20), Number(height) * 2);
  const inline = await renderPaperMath('B_{\\mathrm P}');
  const [, inlineWidth, inlineHeight] = inline.match(/width="(\d+)" height="(\d+)"/) ?? [];
  assert.match(inline, new RegExp(`style="[^"]*width:${inlineWidth}px;height:${inlineHeight}px`));
});

test('paper renderer rejects malformed math and unsafe HTML', async () => {
  await assert.rejects(renderPaperMarkdown('# Title\n\n' + '正文'.repeat(60) + '\n\n$$\n\\unknowncommand{a}\n$$'), /KaTeX/);
  await assert.rejects(renderPaperMarkdown('# Title\n\n' + '正文'.repeat(60) + '<script>alert(1)</script>'), /PAPER_MARKDOWN_INVALID/);
});

test('paper renderer requires an embedded image for every discussed source figure', async () => {
  const prose = '# 阅读\n\n## 证据\n\n原论文 Figure 3 展示不同负载的吞吐。'.padEnd(120, '方法与实验。');
  await assert.rejects(renderPaperMarkdown(prose), /PAPER_FIGURE_MISSING:3/);
  const withImage = prose.replace('原论文 Figure 3', '![原论文 Figure 3](https://arxiv.org/html/example/figure3.svg)\n\n原论文 Figure 3');
  assert.match((await renderPaperMarkdown(withImage)).html, /figure3\.svg/);
});
