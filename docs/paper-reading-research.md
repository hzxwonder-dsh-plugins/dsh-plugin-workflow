# 论文解读的分层阅读设计

## 采用的结构

开头的“快速阅读”用四个短要点交代问题、核心做法、关键证据与适用边界；正文依次解释背景与术语、贯穿全文的具体例子、方法与必要公式、实验条件与证据、适用边界、Takeaway 与参考来源。简短 Q&A 放在读者可能产生疑问的章节旁。章节根据论文调整。

标题与目录支持跳读，正文仍可从头连贯阅读。图表与解释相邻，正文写出图表支持的结论和原文位置。文章模板由 `paper-explainer` skill 一起加载，避免运行时只看到模板文件名。

## 查阅依据与适用边界

- [How Users Read on the Web](https://www.nngroup.com/articles/how-users-read-on-the-web/)：支持清晰小标题、每段一个意思、要点前置和客观表达。这是网页阅读研究，不是本产品用户测试；不将其历史统计数值当作本产品效果预测。
- [How to Present Scientific Findings Online](https://www.nngroup.com/articles/scientific-findings-online/)：支持简洁准确标题、摘要、可跳读章节和有解释的图表。研究对象是领域专家，其跳过背景的偏好不能直接套用于初学者，因此背景保留为可导航章节。
- [Readwise Reader Ghostreader](https://docs.readwise.io/reader/guides/ghostreader/overview)：提供针对整篇文档或选中段落的解释、提问及自定义提示词；其[跨文档问答](https://docs.readwise.io/reader/guides/ghostreader/global)把答案定位到来源段落。工作流据此强调就近解释和可追溯引用，不照搬聊天式阅读界面。
- [OpenAI Skills](https://developers.openai.com/api/docs/guides/tools-skills)：`SKILL.md` 承载任务指令，`references/` 承载按需参考材料。插件运行时会把文章模板附入注册的 skill 内容，确保执行器实际获得模板。
- product-design-and-ux：评分与生成解释不是正确性的证明，需保留来源、输入边界、失败恢复和完成证据。
- ui-ux-pro-max：沿用宿主字体和主题、稳定控件、可见焦点与明确反馈。设计系统搜索中营销页面结构不适合工作流编辑器；高级配置渐进展开采用通用交互原则，未将不匹配的检索条目作为证据。

## 评审规则

三个独立子会话按依赖运行：提问者→回答者→审稿者。回答者只接收解读稿与问题，不授予文件或网络工具。审稿按事实与引用 40、概念机制 25、可回答性 20、阅读结构 15 分评分。85 分通过，最多三轮；关键事实或引用虚构、核心机制错误设总分上限。

提问本身可能透露知识，要求提问者不提供答案，审稿者检查泄露。该评审是模型驱动的质量控制，不替代真实初学者可用性测试和事实核验。
