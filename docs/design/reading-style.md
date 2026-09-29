# 论文精读阅读样式

## 体验目标

读者在半分钟内找到论文问题、方法、关键证据与适用边界，随后沿贯穿例子读完整篇论文的动机、洞察、贡献、机制、实现、评测与局限，并在原文位置核对结论。页面沿用顶部导航、左侧文章、右侧作者与目录的布局。正文与标题使用思源黑体（Noto Sans SC），系统已有苹方时可作为本地回退；以字重、留白和短段落构成层级。背景采用暖白纸色，正文为深蓝灰，链接为青绿色，章节提示使用少量暖铜色。

字体选择依据：[Google Fonts 的 Noto Sans SC 字体资料](https://github.com/google/fonts/blob/main/ofl/notosanssc/upstream_info.md)表明它是面向简体中文的 Noto CJK 子集，采用 [SIL OFL 授权](https://github.com/google/fonts/blob/main/ofl/notosanssc/OFL.txt)，适合跨设备呈现；[霞鹜文楷作者的说明](https://github.com/lxgw/LxgwWenKai#项目简介)提示文楷更适合中等长度文本或注释，因此长文正文选用字形更中性的无衬线字体。可读性仍取决于字号、行距、段落长度和读者习惯，字体本身不保证阅读意愿提升。中文行距的影响可参照[简体中文眼动研究](https://lbms03.cityu.edu.hk/oaps/lt2017-6580-hd897.pdf)。

结构依据：[NN/g 的网页扫读研究](https://www.nngroup.com/articles/how-users-read-on-the-web/)支持有意义的小标题、每段一个观点和要点前置；[Halo 文章模板文档](https://docs.halo.run/developer-guide/theme/template-variables/post)说明正文内容由主题模板注入，因此正文结构与主题样式分别处理；[MathJax 的 SVG 输出文档](https://docs.mathjax.org/en/v4.0/output/svg.html)说明公式可用矢量字形渲染，发布器再生成高分辨率图片以供浏览器和公众号展示；[Excalidraw 场景格式](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/codebase/json-schema.mdx)支持保留可编辑源文件。

## 页面层级

1. 标题与作者信息。
2. 论文信息卡：题名、作者、版本、原文与项目链接分别呈现。
3. 四项快速阅读：问题、做法、证据、边界。
4. 中心主题向两侧展开的思维导图：4–6 个编号分支交代问题与设计选择，底部连接证据和适用边界；正文展示 SVG，同时保存可编辑 Excalidraw 源文件。
5. 分层的深度正文：从真实场景进入，讲清既有路线、动机、洞察与各项贡献；沿一个例子逐层展开机制、关键实现、评测设置、结果、反例和局限。术语首次出现时解释；每段一个观点，条件多时改为列表或窄表格。
6. 就近 Q/A：`Q：` 和 `A：` 分别成行，回答紧贴对应疑问。
7. 公式：按论证需要保留核心式；行内变量和独立公式都由发布器校验 TeX 并转为双倍像素的清晰图片，CSS 按逻辑尺寸显示且无横向滚动，邻近文字解释符号、前提、推导和极端情形。
8. Takeaway 与论文出处；公众号版保留论文信息，不附外部引用链接和来源列表。

桌面正文 17px、行距 1.84；手机正文 16px、行距 1.84。右侧目录在窄屏移到正文之后。图片保留等比尺寸；文中讨论的每张原论文主图就近嵌入。表格在自身容器内横向滚动，公式区域随宽度缩放。链接与键盘焦点始终可辨。

## 工作流产物

文章输出同时包含 Markdown 正文和精简总览字段。发布器生成 `.excalidraw`、SVG 及公众号版 HTML；公众号版保存于本机工作流导出目录，工作流结果返回文件路径和文件 URL。其正文采用浅色网格纸背景；外部引用链接与末尾来源列表在生成时移除。公众号版提供“复制公众号排版”按钮，复制带行内样式的富文本及纯文本备用内容。文章页面不显示公众号入口。

## 预览文件

- [博客阅读预览](freetoken-reading-preview.html)
- [公众号排版预览](freetoken-wechat-preview.html)
- [总览图 SVG](freetoken-overview.svg)
- [总览图 Excalidraw 源文件](freetoken-overview.excalidraw)

这些文件使用 FreeToken 原论文的设计和实验内容，可供样式与叙事审阅。预览通过正式 Markdown、公式与总览图生成器构建；文章的具体写法见 [示例 Markdown](freetoken-reading-sample.md)。正式博客主题的字体、色调和组件样式以审阅后的方案为基础实施；页面栏目与布局保持上述结构。

内容深度与证据呈现的取舍参见 [论文精读调研](paper-reading-research.md)。
