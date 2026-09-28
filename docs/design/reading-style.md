# 论文精读阅读样式

## 体验目标

读者在半分钟内找到论文问题、方法、关键证据与适用边界，随后能够沿着贯穿例子理解机制，并在原文位置核对结论。页面沿用顶部导航、左侧文章、右侧作者与目录的布局。正文区域采用纸张底色、思源宋体正文、思源黑体界面、深蓝灰正文、青绿色链接与少量暖铜色层级提示。

设计依据：[NN/g 的网页扫读研究](https://www.nngroup.com/articles/how-users-read-on-the-web/)支持有意义的小标题、每段一个观点和要点前置；[Halo 文章模板文档](https://docs.halo.run/developer-guide/theme/template-variables/post)说明正文内容由主题模板注入，因此正文结构与主题样式分别处理；[MathJax 的 SVG 输出文档](https://docs.mathjax.org/en/v4.0/output/svg.html)说明公式可用矢量字形渲染，发布器再生成高分辨率图片以供浏览器和公众号展示；[Excalidraw 场景格式](https://github.com/excalidraw/excalidraw/blob/master/dev-docs/docs/codebase/json-schema.mdx)支持保留可编辑源文件。

## 页面层级

1. 标题与作者信息。
2. 论文信息卡：题名、作者、版本、原文与项目链接分别呈现。
3. 四项快速阅读：问题、做法、证据、边界。
4. 可编辑 Excalidraw 总览图，正文展示 SVG。
5. 机制与实验正文：每段一个观点，优先两到三句；条件多时改为列表或窄表格。
6. 就近 Q/A：`Q：` 和 `A：` 分别成行，回答紧贴对应疑问。
7. 独立公式区：TeX 由发布器校验并转为高分辨率公式图，宽度随容器缩放，公式附近解释符号及直觉。
8. Takeaway 与论文出处；公众号版保留论文信息，不附外部引用链接和来源列表。

正文 17px，行距 1.9；手机正文 16px，行距 1.84。右侧目录在窄屏移到正文之后。图片保留等比尺寸；文中讨论的每张原论文主图就近嵌入。表格在自身容器内横向滚动，公式区域随宽度缩放。链接与键盘焦点始终可辨。

## 工作流产物

文章输出同时包含 Markdown 正文和精简总览字段。发布器生成 `.excalidraw`、SVG 及公众号版 HTML；公众号版保存于本机工作流导出目录，工作流结果返回文件路径和文件 URL。其正文采用浅色网格纸背景；外部引用链接与末尾来源列表在生成时移除。公众号版提供“复制公众号排版”按钮，复制带行内样式的富文本及纯文本备用内容。文章页面不显示公众号入口。

## 预览文件

- [博客阅读预览](freetoken-reading-preview.html)
- [公众号排版预览](freetoken-wechat-preview.html)
- [总览图 SVG](freetoken-overview.svg)
- [总览图 Excalidraw 源文件](freetoken-overview.excalidraw)

这些文件使用 FreeToken 文章内容，可供样式审阅。正式博客主题的字体、色调和组件样式以此方案为基础实施；页面栏目与布局保持上述结构。
