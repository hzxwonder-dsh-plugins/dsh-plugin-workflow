# Desktop 工作流资源模块验收

2026-09-28，在官方 DeepSeek Harness Desktop `0.1.7-rc.2` 中加载工作流插件 `0.5.0`。编辑器显示 Skill 和文件模块；Skill 文件树包含 `SKILL.md`、`assets/`、`references/` 与 `scripts/`。通过界面创建两个资源模块并保存版本后，Host 在对应工作流版本目录生成 Skill 文件夹和文件内容。

DSH Omni 集成版中，从系统文件选择器导入 Markdown 文件，Skill 与文件分别连向生成步骤，并在 Prompt 指定位置插入路径。保存新版本后，原版本文件内容保持独立。

`npm test` 通过 74 项，`npm run check:host` 通过。资源运行测试确认模型步骤收到 Skill 路径及指令，并只收到文件模块的路径。
