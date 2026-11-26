# Keystone 教程站

[English](README.md)

本项目用 Docusaurus 2 构建 Keystone 教程站。教程在 Notion 中维护，每次生产构建都会重新拉取。英文是默认语言，繁体中文使用站点语言代码 `zh`。

## 内容与导航

| 教程 | Notion 根页面变量 | 拉取到本地 | 站点入口 |
| --- | --- | --- | --- |
| 英文 | `DOCU_NOTION_DOCS_ROOT_PAGE_EN` | `docs/` | `/docs` |
| 繁体中文 | `DOCU_NOTION_DOCS_ROOT_PAGE_HANT` | `i18n/zh/docusaurus-plugin-content-docs/current/` | `/zh/docs` |

首页和文档入口会跳转到当前语言的 Keystone 3 Pro 分类页。Tutorial 侧边栏由 `sidebars.js` 按生成的文档目录自动生成。要调整教程层级，在对应语言的 Notion 目录中修改，然后重新拉取。顶部导航和页脚链接由 `docusaurus.config.js` 配置。

导航中的 Korean Tutorial 和页脚的博客均指向外站。本站只构建英文和繁体中文。Docusaurus 的博客插件仍然启用，Notion 同步已移除博客和韩语拉取。原先用于文档归档的 GitHub Actions 工作流已移除。

## 本地开发

在仓库根目录使用 Node.js 24.x 和 pnpm 11.24.0。首次配置时运行：

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

在 `.env` 或当前进程环境中设置以下变量。拉取脚本默认读取 `.env`；仅填写 `.env.local` 不会被该脚本自动加载。

| 变量 | 值的来源与用途 |
| --- | --- |
| `DOCU_NOTION_INTEGRATION_TOKEN` | Notion 集成的访问令牌。为集成授予两个根页面及其引用内容的读取权限。令牌保存在本地环境或部署平台中。 |
| `DOCU_NOTION_DOCS_ROOT_PAGE_EN` | 从英文教程根页面的 Notion 链接复制页面 ID。 |
| `DOCU_NOTION_DOCS_ROOT_PAGE_HANT` | 从繁体中文教程根页面的 Notion 链接复制页面 ID。 |
| `AVAILABLE_STATUS` | 按数据库文章的 Notion 状态筛选。示例使用 `Publish`。若预览环境还需包含待审核文章，可填 `Publish,Ready For Review`。 |

```sh
pnpm run pull
pnpm run validate:content
pnpm run start
```

打开 `http://localhost:3000` 预览英文；预览中文使用 `pnpm run start --locale zh`。开发服务器读取本地内容。Notion 内容变更后需要重新拉取并校验。Git 忽略生成的教程正文，直接编辑本地副本可能在下次拉取时丢失。

## 生产构建与 Vercel 部署

Vercel 的构建命令应设为 `pnpm run build`，输出目录为 `build`。在需要构建的部署环境中设置上表四个变量。

1. **拉取。** `pull.js` 先拉取英文，成功后再拉取繁体中文。任一拉取命令失败，构建即停止。
2. **校验。** `pnpm run validate:content` 检查 `docs/`、`blog/`、`i18n/` 中的 Markdown 和 MDX，包括 front matter、链接与嵌入内容。普通 Markdown 中允许无属性的 `<details>`、`<summary>` 和符合指定格式的 Vimeo 播放器。YouTube 和 Twitter 转换生成的组件不在允许列表内。校验失败时，根据输出的文件、行号和规则修改 Notion 原文。
3. **生成。** `docusaurus build` 编译两种语言并写入 `build/`。运行 `pnpm run serve` 可在本地预览这份生产产物。
