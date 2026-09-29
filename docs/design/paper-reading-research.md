# 论文精读：内容深度与证据呈现调研

## 观察

| 原始资料 | 可借鉴的做法 | 在工作流中的落点 |
| --- | --- | --- |
| [Distill：How to Use t-SNE Effectively](https://distill.pub/2016/misread-tsne/) | 从一个可操作的误读问题切入，用多个简化实验逐步建立直觉，逐节说明结论的限制。 | 每个关键机制按“问题、例子、原理、证据、边界”写；解读者应指出可能的误读。 |
| [Jay Alammar：The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/) | 先给整体数据流，再逐层打开组件；概念首次出现即解释，图像紧邻相应步骤。 | 技术路线先有一张总图，再沿贯穿例子解释数据和状态流动。 |
| [Lilian Weng：LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/) | 长文以清晰目录和小节组织，每个概念同时提供形式化描述、实例和来源。 | 允许文章随论文复杂度增长，区分速览与深入机制，不用固定字数上限压缩重要内容。 |
| [Elicit](https://elicit.com/) | 产品以结构化表格组织证据，并强调可追溯到原始材料的句级引用。 | 获取论文模块建立“论点—原文位置—实验条件—数值”证据表；审稿模块逐项核对。 |
| [Scholarcy](https://www.scholarcy.com/) | 提供从一句话到研究者级概览的不同阅读层级，并突出关键发现、概念和贡献。 | 同一篇文章保留 30 秒速览、问题主线和可深入的设计/实验细节。 |
| [Explainpaper](https://www.explainpaper.com/) | 在困惑发生的位置给出上下文解释，并允许读者追问具体段落。 | 术语在首次出现处解释；Q/A 紧跟真正容易误解的步骤。 |
| [K-Dense Scientific Writer：Literature Review](https://github.com/K-Dense-AI/claude-scientific-writer/blob/main/.claude/skills/literature-review/SKILL.md) 与 [Peer Review](https://github.com/K-Dense-AI/claude-scientific-writer/blob/main/.claude/skills/peer-review/SKILL.md) | 分阶段抽取、核验来源，并把方法与局限纳入评审。 | 原文覆盖清单先于写作，审稿时检查遗漏、归因和可复核性。 |

## 工作流原则

1. **完整性按论文决定。** 获取论文时覆盖引言、挑战、方法、实现、实验、相关工作与讨论；文章不逐句复述，但必须解释每条支撑核心结论的因果链。
2. **深度采用分层结构。** 读者先得到问题与答案，再跟随一个贯穿例子理解机制，随后能核对公式、系统细节、实验设置和限制。
3. **一项贡献对应一项证据。** 每个贡献说明它解决的既有障碍、具体设计、与既有方法的差别、实验证据及证据范围。贡献与性能数字不互相代替。
4. **数值带条件。** 比较必须同时记录模型和精度、硬件、负载、基线、指标与原文图表；分清吞吐、平均延迟、尾部延迟和无法运行的配置。
5. **主动保留反例。** 除作者自述限制，还标明未测量的变量和从实验不能推出的普遍结论。未独立复现时，全文归因为“论文报告”。
6. **审稿检验理解而非篇幅。** 问题覆盖动机、洞察、贡献、计算路径、公式假设、实现、实验、反例与边界；只凭文章能否作答是一项实际门槛。

## FreeToken 原文覆盖基准

[FreeToken arXiv HTML v1](https://arxiv.org/html/2608.16157v1) 的 §2 提出三类障碍：预填权重搬运与上下文重算、解码缓存未命中与主机带宽、共享硬件的动态显存。§3 逐项给出整层双缓冲与语义状态锚点、共享 LRU 与带宽分工、运行时缓存重建及快速启动。§4 解释 CUDA Graph 内的动态缓存决策与 FTW 权重布局。§5 用四种工作负载、六台机器和多个基线检验吞吐、首 token 时间、消融与跨机器效果；§6 区分预测/缓存、近似计算和 CPU–GPU 混合执行等相关路线。示例文章应走完这条链，并对 Figure 1–5 的信息各有交代。

这些材料用于设计写作和评审方法。其他产品的功能描述来自产品官方页面；其效果数字不作为本工作流的性能证据。
