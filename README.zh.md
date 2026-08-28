# Keystone CMS 教程和博客网站

本项目是一个基于 [Keystone](https://keyst.one/) 的 CMS 教程和博客发布网站，内容在 [Notion](https://www.notion.so/) 中管理。网站使用 [Docusaurus](https://docusaurus.io/) 构建，并部署在 [Vercel](https://vercel.com/) 上。

## 特性

- 使用 Notion 进行内容管理
- 使用 Docusaurus 进行静态网站生成
- 支持多语言（参考 [使用方法](https://docusaurus.io/docs/cli#docusaurus-write-translations-sitedir)）
- 在 Vercel 上轻松部署
- 在 `archive-docs` 分支上定期备份文档

## 预览环境

- [Node.js](https://nodejs.org/) 24.x
- [pnpm](https://pnpm.io/) 包管理器

## 开始使用

1. clone 仓库：

```bash
git clone https://github.com/accountlabs-static/k-cms.git
cd k-cms
```

2. 安装依赖：

```bash
pnpm install
```

3. 设置环境变量：

```bash
# 复制 .env.example 文件到 .env 并填写必要的值
cp .env.example .env
# 然后使用你喜欢的文本编辑器编辑 .env 文件
```

4. 从 Notion 拉取内容：

```bash
pnpm run pull
```

5. 启动开发服务器：

```bash
pnpm run start
```

在浏览器中访问 http://localhost:3000。

## 已知限制

- 只支持 Notion 内容中的标准 Markdown 格式。
- 支持特定的嵌入，例如 YouTube 和 Twitter。其他嵌入可能无法正确渲染。
- 图片应直接从你的本地设备上传到 Notion。粘贴来自外部来源的图片链接可能会导致错误。
- 不支持在 Notion 中为子页面（位于子目录内的文章）自定义 slug。

[English version](README.md)
