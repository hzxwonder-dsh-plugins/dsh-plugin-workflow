import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as fontkit from 'fontkit';
import rough from './vendor/rough.esm.mjs';

const WIDTH = 760;
const INK = '#292723';
const MUTED = '#5b5751';
const LINE = INK;
const PAPER = '#fbf8f2';
const PALETTES = [
  { fill: '#e1edf3' },
  { fill: '#fae8ce' },
  { fill: '#fae8ce' },
  { fill: '#e1edf3' },
];

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function check(value, max) {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max || /[<>\n\r]/.test(value)) throw new Error('PAPER_OVERVIEW_INVALID');
  return value.trim();
}

export function validatePaperArgumentMap(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.branches) || input.branches.length < 3 || input.branches.length > 4) throw new Error('PAPER_OVERVIEW_INVALID');
  return {
    title: check(input.title, 36),
    question: check(input.question, 52),
    thesis: check(input.thesis, 75),
    branches: input.branches.map(branch => ({
      role: check(branch.role, 12),
      title: check(branch.title, 20),
      problem: check(branch.problem, 52),
      insight: check(branch.insight, 52),
      method: check(branch.method, 68),
      source: check(branch.source, 26),
    })),
    evidence: {
      finding: check(input.evidence?.finding, 100),
      context: check(input.evidence?.context, 85),
      source: check(input.evidence?.source, 26),
    },
    boundary: {
      scope: check(input.boundary?.scope, 75),
      unknown: check(input.boundary?.unknown, 75),
    },
  };
}

function wrap(value, limit) {
  const chars = [...value];
  const lines = [];
  const weight = char => /[\u0000-\u007f]/.test(char) ? 0.54 : 1;
  while (chars.length) {
    let count = 0;
    let used = 0;
    while (count < chars.length && used + weight(chars[count]) <= limit) used += weight(chars[count++]);
    if (!count) count = 1;
    if (count < chars.length && /[A-Za-z0-9]/.test(chars[count - 1]) && /[A-Za-z0-9]/.test(chars[count])) {
      let boundary = count - 1;
      while (boundary > 0 && /[A-Za-z0-9-]/.test(chars[boundary - 1])) boundary--;
      if (boundary > count / 2) count = boundary;
    }
    while (count < chars.length && /[。！？；，、,.!?;:：]/.test(chars[count])) count++;
    lines.push(chars.splice(0, count).join('').trim());
  }
  return lines;
}

function element(type, x, y, width, height, seed, strokeColor = LINE) {
  return { id: `${type}-${seed}`, type, x, y, width, height, angle: 0, strokeColor,
    backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1.7, strokeStyle: 'solid', roughness: 1.1,
    opacity: 100, groupIds: [], frameId: null, index: `a${String(seed).padStart(4, '0')}`,
    roundness: null, seed, version: 1, versionNonce: seed * 7919, isDeleted: false,
    boundElements: [], updated: 1, link: null, locked: false };
}

function sceneText(x, baseline, width, value, size, color, seed) {
  return { ...element('text', x, baseline - size, width, size * 1.35, seed, color), text: value,
    fontSize: size, fontFamily: 1, textAlign: 'left', verticalAlign: 'middle', containerId: null,
    originalText: value, autoResize: false, lineHeight: 1.25 };
}

function sceneCard(x, y, width, height, fill, seed, accent) {
  return { ...element('rectangle', x, y, width, height, seed, accent), backgroundColor: fill, strokeWidth: 2, roundness: null };
}

function sceneLine(x1, y1, x2, y2, seed, color = LINE, strokeWidth = 1.7, roughness = 1.1) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return { ...element('line', x, y, Math.abs(x2 - x1), Math.abs(y2 - y1), seed, color), strokeWidth, roughness,
    points: [[x1 - x, y1 - y], [x2 - x, y2 - y]], lastCommittedPoint: null };
}

function glyphText(font, x, baseline, value, size, color, maxWidth) {
  const run = font.layout(value);
  const advance = run.positions.reduce((sum, position) => sum + position.xAdvance, 0);
  const scale = Math.min(size / font.unitsPerEm, maxWidth / Math.max(1, advance));
  let offset = 0;
  const paths = run.glyphs.map((glyph, index) => {
    const position = run.positions[index];
    const path = glyph.path.toSVG();
    const segment = path ? `<path d="${path}" transform="translate(${offset + position.xOffset} ${position.yOffset})"/>` : '';
    offset += position.xAdvance;
    return segment;
  }).join('');
  return `<g fill="${color}" transform="translate(${x} ${baseline}) scale(${scale} -${scale})">${paths}</g>`;
}

function roughCard(generator, x, y, width, height, fill, stroke, seed) {
  const radius = 2;
  const path = `M${x + radius} ${y} H${x + width - radius} Q${x + width} ${y} ${x + width} ${y + radius} V${y + height - radius} Q${x + width} ${y + height} ${x + width - radius} ${y + height} H${x + radius} Q${x} ${y + height} ${x} ${y + height - radius} V${y + radius} Q${x} ${y} ${x + radius} ${y} Z`;
  const drawable = generator.path(path, { stroke, strokeWidth: 2, fill, fillStyle: 'solid', roughness: .85, bowing: .45, seed });
  return generator.toPaths(drawable).map(p => `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
}

function roughLine(generator, x1, y1, x2, y2, color, strokeWidth, roughness, seed) {
  const drawable = generator.line(x1, y1, x2, y2, { stroke: color, strokeWidth, roughness, bowing: .4, seed });
  return generator.toPaths(drawable).map(p => `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
}

export async function renderPaperArgumentMap(input) {
  const map = validatePaperArgumentMap(input);
  const generator = rough.generator();
  const fallbackFont = fontkit.create(await readFile(new URL('../assets/fonts/NotoSansSC-VF.ttf', import.meta.url))).getVariation({ wght: 400 });
  let font = fallbackFont;
  const handdrawnFontPath = process.env.DSH_WORKFLOW_HANDDRAWN_FONT || join(homedir(), '.dsh-workflow', 'fonts', 'Xiaolai-Regular.ttf');
  try { font = fontkit.create(await readFile(handdrawnFontPath)); } catch { font = fallbackFont; }
  const elements = [];
  const contents = [];
  let seed = 1;
  const drawText = (x, baseline, value, size, color, maxWidth) => {
    const textFont = [...value].every(char => font.hasGlyphForCodePoint(char.codePointAt(0))) ? font : fallbackFont;
    contents.push(glyphText(textFont, x, baseline, value, size, color, maxWidth));
    elements.push(sceneText(x, baseline, maxWidth, value, size, color, seed++));
  };
  const drawLines = (x, baseline, value, size, color, maxWidth, chars, lineGap = 23) => {
    const lines = wrap(value, chars);
    lines.forEach((line, index) => drawText(x, baseline + index * lineGap, line, size, color, maxWidth));
    return lines.length;
  };
  const drawCard = (x, y, width, height, fill, stroke) => {
    contents.push(roughCard(generator, x, y, width, height, fill, stroke, seed));
    elements.push(sceneCard(x, y, width, height, fill, seed++, stroke));
  };
  const drawLine = (x1, y1, x2, y2, color = LINE, strokeWidth = 2, roughness = .9) => {
    contents.push(roughLine(generator, x1, y1, x2, y2, color, strokeWidth, roughness, seed));
    elements.push(sceneLine(x1, y1, x2, y2, seed++, color, strokeWidth, roughness));
  };
  const drawArrow = (x, from, to) => {
    drawLine(x, from, x, to - 6);
    drawLine(x - 7, to - 17, x, to - 6);
    drawLine(x + 7, to - 17, x, to - 6);
  };

  const titleLines = drawLines(32, 52, map.title, 26, INK, 696, 25, 33);
  const questionY = 88 + (titleLines - 1) * 33;
  const questionHeight = 68 + wrap(map.question, 29).length * 27;
  drawCard(32, questionY, 696, questionHeight, '#fffdfa', INK);
  drawText(52, questionY + 28, '问题', 15, MUTED, 655);
  drawLines(52, questionY + 66, map.question, 22, INK, 650, 29, 27);
  const answerY = questionY + questionHeight + 50;
  const answerHeight = 68 + wrap(map.thesis, 32).length * 26;
  drawArrow(380, questionY + questionHeight + 3, answerY - 3);
  drawCard(32, answerY, 696, answerHeight, '#fffdfa', INK);
  drawText(52, answerY + 28, '答案', 15, INK, 655);
  drawLines(52, answerY + 64, map.thesis, 20, INK, 653, 32, 26);

  const branchX = 56;
  const branchWidth = 672;
  let bottom = answerY + answerHeight;
  map.branches.forEach((branch, index) => {
    const palette = PALETTES[index];
    const rows = [
      ['障碍', branch.problem],
      ['洞察', branch.insight],
      ['做法', branch.method],
    ].map(([label, value]) => ({ label, value, lines: wrap(value, 30) }));
    const y = bottom + 54;
    const height = 116 + rows.reduce((sum, row) => sum + Math.max(43, row.lines.length * 24 + 14), 0) + 20;
    drawArrow(380, bottom + 4, y - 3);
    drawCard(branchX, y, branchWidth, height, '#fffdfa', INK);
    drawCard(branchX + 18, y + 17, 414, 74, palette.fill, INK);
    drawText(branchX + 36, y + 43, `${index + 1}  ${branch.role}`, 15, INK, 374);
    drawText(branchX + 36, y + 76, branch.title, 22, INK, 374);
    drawLines(565, y + 40, branch.source, 13, MUTED, 136, 14, 16);
    let rowY = y + 128;
    rows.forEach(row => {
      drawText(branchX + 24, rowY, row.label, 15, MUTED, 60);
      row.lines.forEach((line, lineIndex) => drawText(branchX + 100, rowY + lineIndex * 24, line, 17, INK, 514));
      rowY += Math.max(43, row.lines.length * 24 + 14);
    });
    bottom = y + height;
  });

  const y = bottom + 54;
  drawArrow(380, bottom + 4, y - 3);
  const evidenceLines = wrap(map.evidence.finding, 33);
  const contextLines = wrap(map.evidence.context, 35);
  const evidenceHeight = 84 + evidenceLines.length * 24 + contextLines.length * 22;
  drawCard(32, y, 696, evidenceHeight, '#fffdfa', INK);
  drawText(52, y + 32, '实验证据', 17, INK, 500);
  drawLines(566, y + 28, map.evidence.source, 13, MUTED, 135, 14, 16);
  drawLines(52, y + 68, map.evidence.finding, 18, INK, 650, 33, 24);
  drawLines(52, y + 68 + evidenceLines.length * 24, map.evidence.context, 15, MUTED, 650, 35, 22);
  const boundaryY = y + evidenceHeight + 54;
  drawArrow(380, y + evidenceHeight + 4, boundaryY - 3);
  const scopeLines = wrap(map.boundary.scope, 34);
  const unknownLines = wrap(map.boundary.unknown, 34);
  const boundaryHeight = 84 + scopeLines.length * 23 + unknownLines.length * 22;
  drawCard(32, boundaryY, 696, boundaryHeight, '#fffdfa', INK);
  drawText(52, boundaryY + 32, '适用边界', 17, INK, 650);
  drawLines(52, boundaryY + 68, map.boundary.scope, 17, INK, 650, 34, 23);
  drawLines(52, boundaryY + 68 + scopeLines.length * 23, map.boundary.unknown, 15, MUTED, 650, 34, 22);
  const height = Math.ceil(boundaryY + boundaryHeight + 30);
  const description = [map.question, map.thesis, ...map.branches.map(branch => `${branch.role}：${branch.problem}；${branch.insight}；${branch.method}（${branch.source}）`),
    `证据：${map.evidence.finding}。${map.evidence.context}（${map.evidence.source}）`, `边界：${map.boundary.scope}。${map.boundary.unknown}`].join('；');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="overview-title overview-desc"><title id="overview-title">${escape(map.title)}</title><desc id="overview-desc">${escape(description)}</desc><rect width="${WIDTH}" height="${height}" fill="${PAPER}"/>${contents.join('')}</svg>`;
  return { svg, scene: { type: 'excalidraw', version: 2, source: 'https://excalidraw.com', elements,
    appState: { gridSize: null, viewBackgroundColor: PAPER, currentItemFontFamily: 1, currentItemRoughness: 1.1 }, files: {} } };
}
