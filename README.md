<p align="center">
  <img src="web/public/logo.svg" width="88" alt="LingWeave Logo">
</p>

<h1 align="center">LingWeave（灵织）</h1>

<p align="center">
  把提示词、参考素材、模型配置和生成结果连接在同一张画布上的 AI 视觉创作工作台。
</p>

<p align="center">
  <a href="https://github.com/cqai-club/lingweave"><img src="https://img.shields.io/github/stars/cqai-club/lingweave?style=flat-square&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/cqai-club/lingweave/tags"><img src="https://img.shields.io/github/v/tag/cqai-club/lingweave?style=flat-square&label=version" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-f97316?style=flat-square" alt="AGPL-3.0 License"></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-7-646cff?style=flat-square&logo=vite&logoColor=white" alt="Vite 7"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react&logoColor=white" alt="React 19"></a>
</p>

<p align="center">
  <a href="docs/content/docs/overview/quick-start.mdx">快速开始</a> ·
  <a href="docs/content/docs/overview/features.mdx">功能介绍</a> ·
  <a href="docs/content/docs/canvas/canvas-node-manual.mdx">画布手册</a> ·
  <a href="docs/content/docs/overview/codex-app-plugin.mdx">Codex 插件</a> ·
  <a href="docs/index.md">文档索引</a>
</p>

## 项目介绍

LingWeave（灵织）是一款面向个人创作者的 AI 无限画布，适合进行图像探索、连续场景创作和多模态内容编排。你可以把提示词、图片、视频、音频和生成配置组织为节点，用连线表达引用关系，并从任意结果继续生成新的分支。部署时可选择通过 CQAI Account Service 统一接入 Logto 与 NewAPI，也可以继续使用浏览器本地的兼容接口。

项目以 Web 前端为主体，账号服务模式下由 CQAI Account Service 承担身份校验和 AI 请求代理；未启用时，AI 请求由浏览器访问用户配置的兼容接口。账号登录使用 CQ AI Club 的 Logto 服务，画布、素材和生成记录默认保存在当前浏览器本地。

> [!CAUTION]
> 项目仍处于开发阶段，不保证本地数据结构向后兼容，当前更适合个人使用或可信环境部署，不建议直接作为公网多人服务。

## 项目来源

LingWeave 最初基于 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas) 开发，经过大规模功能与架构调整后由本仓库独立维护。项目保留原始提交历史，并继续遵循 AGPL-3.0 开源协议。感谢原项目作者及所有贡献者。

## 核心功能

- **节点式无限画布**：管理多画布项目，支持文本、图片、视频、音频、生成配置和分组节点，以及连线、缩放、小地图、撤销重做和导入导出。
- **连续内容生成**：将提示词和参考素材连接到生成配置，支持图片、文本、视频和音频生成；结果可以继续作为下一次生成的输入。
- **账号与 AI 网关解耦**：使用 Logto 登录 CQ AI Club 账号；启用 Account Service 后由服务端按应用映射 NewAPI 账号和额度，浏览器不保存平台 API Key；未启用时仍可使用本地 OpenAI / Gemini 兼容渠道。
- **提示词资源库**：通过同步脚本汇总多个开源提示词仓库，封面可保存到本地静态目录或发布到 Cloudinary。
- **素材与数据管理**：提示词、参考图和生成结果可以加入“我的素材”；画布和素材默认保存在浏览器本地，并支持导入导出和可选 WebDAV 同步。
- **Codex 协作**：通过本地 Canvas Agent 和 Codex App 插件读取画布、创建节点、连接流程并触发生成，手动画布功能不依赖 Codex。

完整能力和当前限制见[功能介绍](docs/content/docs/overview/features.mdx)。

## 快速开始

### 本地开发

需要 Node.js 20.19 或更高版本。

```bash
git clone https://github.com/cqai-club/lingweave.git
cd lingweave/web
npm install
npm run dev
```

启动后访问 [http://localhost:3000](http://localhost:3000)。

如需启用 CQ AI Club 登录和账号服务模式，在 `web/.env.local` 设置以下变量：

```bash
VITE_LOGTO_APP_ID=你的Logto单页应用AppID
VITE_LOGTO_ENDPOINT=https://auth.cqaiclub.asia
VITE_LOGTO_API_RESOURCE=https://account.cqaiclub.asia
VITE_LOGTO_API_SCOPES=ai:invoke
VITE_ACCOUNT_SERVICE_URL=https://account.cqaiclub.asia
VITE_NEW_API_URL=https://relay.cqaiclub.asia
```

只设置 `VITE_LOGTO_APP_ID` 可以启用登录但不会启用 Account Service；浏览器前端不要配置 Logto App Secret、NewAPI 管理员 Token 或 `NEW_API_INTERNAL_TOKEN`。

登录后账户菜单会显示账号服务返回的剩余额度，并提供 NewAPI 控制台和钱包充值入口。`VITE_NEW_API_URL` 用于配置 NewAPI 控制台地址，默认是 `https://relay.cqaiclub.asia`；进入控制台和充值页时，可能仍需单独完成 NewAPI 登录。

OpenAI 渠道的文本调用协议可在“API 配置”中按渠道选择 `/v1/chat/completions` 或 `/v1/responses`；账号服务默认选择前者。

首次启动会优先下载当前版本 GitHub Release 中的提示词库资源包；资源包不可用时会自动从上游同步。如需主动更新本地提示词库，在 `web/` 目录执行：

```bash
npm run sync:prompts
```

再次同步会复用已下载的封面。提示词库本地目录不会提交到 Git，版本标签发布时会自动生成对应资源包；也可按开发文档将图片和索引发布到 Cloudinary。

### Docker 运行

`docker-compose.yml` 默认使用发布到 GitHub Container Registry 的镜像：

```bash
git clone https://github.com/cqai-club/lingweave.git
cd lingweave
docker compose up -d
```

运行后访问 [http://localhost:3000](http://localhost:3000)。源码构建和其他部署方式见 [Docker 部署](docs/content/docs/overview/docker.mdx) 与 [Render 部署](docs/content/docs/overview/render.mdx)。

### 首次使用

1. 账号服务模式下先登录 CQ AI Club，再在“配置”拉取并选择默认模型；本地回退模式下填写自己的 Base URL 和 API Key。
2. 进入“快速上手”或新建空白画布，添加文本节点并填写提示词。
3. 点击文本节点上的“生图”，确认生成配置后开始生成。
4. 将满意结果继续连接到下一组配置，或保存到“我的素材”。

账号服务模式下，浏览器只保存 Logto 会话和模型选择，AI 请求经 Account Service 转发到 NewAPI；本地回退模式下，AI API Key 会保存在浏览器本地。生产构建通过 `VITE_LOGTO_APP_ID` 决定是否显示登录入口，同时配置 `VITE_LOGTO_API_RESOURCE` 和 `VITE_ACCOUNT_SERVICE_URL` 后启用账号服务模式。

## 文档

- [快速开始](docs/content/docs/overview/quick-start.mdx)
- [功能介绍](docs/content/docs/overview/features.mdx)
- [画布节点操作手册](docs/content/docs/canvas/canvas-node-manual.mdx)
- [画布快捷键](docs/content/docs/canvas/canvas-shortcuts.mdx)
- [本地开发](docs/content/docs/development/local-development.mdx)
- [Codex App 插件](docs/content/docs/overview/codex-app-plugin.mdx)
- [本地 Codex 连接画布原理](docs/content/docs/overview/local-codex-canvas.mdx)
- [完整文档索引](docs/index.md)
