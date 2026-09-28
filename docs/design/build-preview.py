#!/usr/bin/env python3
"""Build a reviewable article layout from the published FreeToken content."""
from html import escape
from pathlib import Path
import json
import re
import subprocess

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
  <img src="freetoken-overview.svg" alt="FreeToken 论文逻辑总览：问题、预填、解码、带宽分工、图内执行、证据和适用边界">
</figure>'''
body = body.replace('</ul>', '</ul>\n' + overview, 1)

math_tex = [
    r'B_R = \max(B_H-B_P,0)',
    r'T_{\mathrm{fill}}(q) \approx \frac{q\cdot S}{B_P}',
    r'T_{\mathrm{cpu}}(m-q) \approx \frac{(m-q)\cdot S}{B_H-B_P}',
    r'q^* \approx \frac{m\cdot B_P}{B_H}',
]
rendered = subprocess.run(['node', str(HERE / 'render-math.mjs')], input=json.dumps(math_tex), text=True, capture_output=True, check=True)
math_images = json.loads(rendered.stdout)

def math_card(label, image, plain):
    return f'<div class="paper-equation" role="group" aria-label="{escape(label)}：{escape(plain)}"><span>{escape(label)}</span>{image}</div>'

equations = {
    'B_R = max(B_H − B_P, 0)': math_card('主机剩余带宽', math_images[0], 'B_R = max(B_H − B_P, 0)'),
    'T_fill(q) ≈ q·S / B_P': math_card('搬运分支耗时', math_images[1], 'T_fill(q) ≈ q·S / B_P'),
    'T_cpu(m − q) ≈ (m − q)·S / (B_H − B_P)': math_card('CPU 分支耗时', math_images[2], 'T_cpu(m − q) ≈ (m − q)·S / (B_H − B_P)'),
    'q* ≈ m · B_P / B_H': math_card('最优填充数量', math_images[3], 'q* ≈ m · B_P / B_H'),
}
for original, replacement in equations.items():
    body = body.replace(f'<ul>\n<li>{original}</li>\n</ul>', replacement)
body = body.replace('<ul>\n<li>T_fill(q) ≈ q·S / B_P</li>\n<li>T_cpu(m − q) ≈ (m − q)·S / (B_H − B_P)</li>\n</ul>', equations['T_fill(q) ≈ q·S / B_P'] + equations['T_cpu(m − q) ≈ (m − q)·S / (B_H − B_P)'])

figures = {
    '为什么需要它：本机跑大 MoE 卡在哪': ('Teaser.svg', 'Figure 1 展示不同模型的服务成本、能力和本机速度：这篇论文瞄准的是消费级硬件上的高能力 MoE。'),
    '证据一：端到端吞吐稳定，尾延迟才是分水岭（Figure 3，§5.2）': ('Exp1Main.svg', 'Figure 3 同时展示四类负载的解码吞吐和首 token 时间；阅读时先看跨负载稳定性，再看尾部停顿。'),
    '证据三：跨硬件与前沿规模（Figure 5，§5.3）': ('Exp3CrossHW.svg', 'Figure 5 比较不同消费级 GPU 上的编码代理吞吐，说明分工策略如何随机器带宽变化。'),
}
for heading, (file, caption) in figures.items():
    pattern = re.compile(r'(<h2 id="section-\d+">' + re.escape(heading) + r'</h2>)')
    figure = f'<figure class="paper-figure"><img src="https://arxiv.org/html/2608.16157v1/{file}" alt="{escape(caption)}" loading="lazy"><figcaption>{escape(caption)}</figcaption></figure>'
    body, count = pattern.subn(lambda m: m.group(1) + '\n' + figure, body, count=1)
    if count != 1:
        raise SystemExit(f'figure placement unavailable: {heading}')

highlights = [
    '整池专家远超显存',
    '「搬」才是问题',
    '这 4 个未命中该怎么分工',
    '同一套公式、不同机器给出不同分工',
    '把未命中按实测带宽比例切开',
    '传输可以连续在后台跑',
    '新请求从「编辑后仍然存活的最深检查点」恢复',
    '与路由相关的控制全部留在 GPU 上',
    '77–83 tok/s',
    '22–25 tok/s',
    '最差一轮在所有单元都低于 44 s',
    '共享 LRU 的 decode 期专家读取未命中率为 16% 与 39%',
]
for phrase in highlights:
    body = body.replace(phrase, f'<strong>{phrase}</strong>', 1)

body = re.sub(r'<p>(<img\b[^>]*>)</p>\s*<p><em>([^<]+)</em></p>', r'<figure class="paper-figure">\1<figcaption>\2</figcaption></figure>', body, flags=re.S)
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
