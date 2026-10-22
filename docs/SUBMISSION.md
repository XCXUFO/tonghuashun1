# AgentLens 提交索引

| 交付要求 | 已交付 |
| --- | --- |
| 可实际操作的 Web | https://agentlens-quality-platform.xcxufo0120.workers.dev/ ，公开演示，无需登录 |
| 源码和 README | https://github.com/XCXUFO/tonghuashun1 ，含启动、变量、目标用户、AI 角色、数据与边界 |
| 60–180 秒视频 | 本机附件 AgentLens_主链路实际操作演示.mp4 ，约 90.63 秒、中文字幕、无旁白 |
| AI 使用与验证 | [AI_USAGE.md](AI_USAGE.md)、[EVIDENCE.md](EVIDENCE.md)，原始返回在私密证据包 |
| 测试说明 | [TESTING.md](TESTING.md)，35 项离线测试、类型检查和生产构建；主链路与接口异常均有记录 |
| 核心设计 | [DESIGN.md](DESIGN.md) |
| 本人最终确认 | [CANDIDATE_CHECKLIST.md](CANDIDATE_CHECKLIST.md)，未代替本人勾选 |

## 附件位置

本机 `outputs/agent-quality-platform/` 包含视频、源码 ZIP、提交材料 ZIP、证据和上线记录。请在题目提交系统上传 MP4 与所需附件；本仓库未托管视频，不能把文件名当公开下载链接。

公开 GitHub 包含方法、匿名构造样本和结果摘要。完整模型原始返回/调用元数据未明确获准公开，供应商数据再分发范围也未确认，因此留在本机私密证据包，不进入公开仓库或静态网站资源。

## 已核实状态与边界

用户确认后保存公开策略；匿名无 Cookie/凭证请求首页和配置均为 200，公开 DeepSeek 接口成功。新版真实 Prompt 实验已在生产页面操作、导出；修订另存、复核保存与画像事实漂移均有实际画面。

扶摇线上有成功记录，本轮录像现场成功，但同期匿名 HTTP 调用存在 530，连通不稳定。iFinD 本地成功、线上 530。失败明确显示无可用证据，根因未确认。当前是单人工作台，非生产多租户服务；未实现共享数据库、自动日志采集和后台定时任务。

候选人本人尚需亲自走一遍并确认取舍，不能把 AI 操作的验收记录改署为本人验证。
