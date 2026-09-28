#!/usr/bin/env python3
"""Build a reviewable article layout from the published FreeToken content."""
from html import escape
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
body = (HERE / 'freetoken-rendered.html').read_text()
body = re.sub(r'<(?:script|style)\b[^>]*>.*?</(?:script|style)>', '', body, flags=re.I | re.S)

metadata = re.search(r'<p>论文：(.*?)\n作者：(.*?)\n版本：(.*?)\n原文：(.*?)</p>', body, flags=re.S)
if not metadata:
    raise SystemExit('paper metadata unavailable')
paper, authors, version, links = metadata.groups()
info = f'''<section class="paper-source" aria-label="论文信息">
  <div class="paper-source__main"><span class="eyebrow">PAPER / 原文信息</span><h2>{escape(paper)}</h2></div>
  <dl><div><dt>作者</dt><dd>{escape(authors)}</dd></div><div><dt>版本</dt><dd>{escape(version)}</dd></div>
  <div><dt>阅读与项目</dt><dd>{links}</dd></div></dl>
</section>'''
body = body[:metadata.start()] + info + body[metadata.end():]

qa_pattern = re.compile(r'<p>常见疑问：([^\n<]+)\n(.*?)</p>', re.S)
body = qa_pattern.sub(lambda m: f'''<aside class="paper-qa" aria-label="问答">
  <div class="paper-qa__row"><span class="paper-qa__tag">Q：</span><strong>{m.group(1).strip()}</strong></div>
  <div class="paper-qa__row"><span class="paper-qa__tag paper-qa__tag--answer">A：</span><p>{m.group(2).strip()}</p></div>
</aside>''', body)
body = re.sub(r'<blockquote>\s*(<aside class="paper-qa".*?</aside>)\s*</blockquote>', r'\1', body, flags=re.S)

def split_paragraph(match):
    text = match.group(1)
    if '<' in text or len(text) < 180:
        return match.group(0)
    sentences = re.split(r'(?<=[。！？])', text)
    parts, current = [], ''
    for sentence in sentences:
        if current and len(current) + len(sentence) > 135:
            parts.append(current.strip())
            current = ''
        current += sentence
    if current.strip():
        parts.append(current.strip())
    return ''.join(f'<p>{part}</p>' for part in parts)

body = re.sub(r'<p>([^<>]+)</p>', split_paragraph, body, flags=re.S)
body = body.replace('<h2 id="section-1">快速阅读</h2>\n<ul>', '<h2 id="section-1">快速阅读</h2>\n<ul class="quick-read">', 1)
for label in ['问题', '做法', '关键证据', '边界']:
    body = body.replace(f'<li>{label}：', f'<li><strong>{label}</strong><span>', 1)
body = re.sub(r'(<ul class="quick-read">.*?</ul>)', lambda m: m.group(1).replace('</li>', '</span></li>'), body, count=1, flags=re.S)
overview = '''<figure class="paper-overview">
  <a href="freetoken-overview.svg" target="_blank" rel="noopener"><img src="freetoken-overview.svg" alt="FreeToken 论文逻辑总览：问题、预填、解码、带宽分工、图内执行、证据和适用边界"></a>
  <figcaption>论文逻辑总览 · 点击查看完整 SVG；<a href="freetoken-overview.excalidraw">下载可编辑 Excalidraw 源文件</a></figcaption>
</figure>'''
body = body.replace('</ul>', '</ul>\n' + overview, 1)

def math_card(label, mathml, plain):
    return f'<div class="paper-equation" role="group" aria-label="{escape(label)}：{escape(plain)}"><span>{escape(label)}</span><math display="block">{mathml}</math></div>'

equations = {
    'B_R = max(B_H − B_P, 0)': math_card('主机剩余带宽', '<msub><mi>B</mi><mi>R</mi></msub><mo>=</mo><mi>max</mi><mo>(</mo><msub><mi>B</mi><mi>H</mi></msub><mo>−</mo><msub><mi>B</mi><mi>P</mi></msub><mo>,</mo><mn>0</mn><mo>)</mo>', 'B_R = max(B_H − B_P, 0)'),
    'T_fill(q) ≈ q·S / B_P': math_card('搬运分支耗时', '<msub><mi>T</mi><mtext>fill</mtext></msub><mo>(</mo><mi>q</mi><mo>)</mo><mo>≈</mo><mfrac><mrow><mi>q</mi><mo>·</mo><mi>S</mi></mrow><msub><mi>B</mi><mi>P</mi></msub></mfrac>', 'T_fill(q) ≈ q·S / B_P'),
    'T_cpu(m − q) ≈ (m − q)·S / (B_H − B_P)': math_card('CPU 分支耗时', '<msub><mi>T</mi><mtext>cpu</mtext></msub><mo>(</mo><mi>m</mi><mo>−</mo><mi>q</mi><mo>)</mo><mo>≈</mo><mfrac><mrow><mo>(</mo><mi>m</mi><mo>−</mo><mi>q</mi><mo>)</mo><mo>·</mo><mi>S</mi></mrow><mrow><msub><mi>B</mi><mi>H</mi></msub><mo>−</mo><msub><mi>B</mi><mi>P</mi></msub></mrow></mfrac>', 'T_cpu(m − q) ≈ (m − q)·S / (B_H − B_P)'),
    'q* ≈ m · B_P / B_H': math_card('最优填充数量', '<msup><mi>q</mi><mo>*</mo></msup><mo>≈</mo><mfrac><mrow><mi>m</mi><mo>·</mo><msub><mi>B</mi><mi>P</mi></msub></mrow><msub><mi>B</mi><mi>H</mi></msub></mfrac>', 'q* ≈ m · B_P / B_H'),
}
for original, replacement in equations.items():
    body = body.replace(f'<ul>\n<li>{original}</li>\n</ul>', replacement)
body = body.replace('<ul>\n<li>T_fill(q) ≈ q·S / B_P</li>\n<li>T_cpu(m − q) ≈ (m − q)·S / (B_H − B_P)</li>\n</ul>', equations['T_fill(q) ≈ q·S / B_P'] + equations['T_cpu(m − q) ≈ (m − q)·S / (B_H − B_P)'])

body = re.sub(r'(<table>.*?</table>)', r'<div class="table-scroll">\1</div>', body, flags=re.S)
headings = re.findall(r'<h2 id="(section-\d+)">(.*?)</h2>', body)
toc = '\n'.join(f'<li><a href="#{anchor}">{title}</a></li>' for anchor, title in headings)

css = (HERE / 'preview.css').read_text()
page = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>FreeToken 论文精读 · 阅读样式预览</title><style>{css}</style></head><body>
<header class="site-header"><div class="site-header__inner"><a class="brand" href="#top"><span class="brand__mark">AI</span> AI Infra 学习札记</a>
<nav aria-label="主导航"><a href="#top">首页</a><a class="active" href="#top">文章</a><a href="#top">AscendC 学习</a><a href="#top">论文分享</a><a href="#top">实验场</a></nav></div></header>
<div class="page" id="top"><div class="breadcrumb">首页 <span>/</span> 论文分享 <span>/</span> 正文</div>
<div class="columns"><main class="article-card"><div class="article-topline">论文分享 <span>RESEARCH NOTE / 2026</span></div>
<h1>本机跑 284B MoE：FreeToken 怎样用「带宽比例」把闲置的 CPU 也算进来</h1>
<div class="byline"><span class="author-dot">h</span><span>hzxwonder</span><span class="byline__sep">·</span><time>2026-09-28</time><span class="byline__sep">·</span><span>约 8,300 字</span></div>
<div id="post-inner">{body}</div></main>
<aside class="sidebar"><div class="sidebar-card profile"><div class="profile__orb"></div><h2>AI Infra 学习札记</h2><p>把复杂系统讲清楚</p></div>
<div class="sidebar-card toc"><h2>文章目录</h2><ol>{toc}</ol></div></aside></div></div>
<footer>AI Infra 学习札记 · 论文精读样式预览</footer></body></html>'''
(HERE / 'freetoken-reading-preview.html').write_text(page)
print(HERE / 'freetoken-reading-preview.html')
