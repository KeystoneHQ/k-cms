# Keystone tutorial site

[中文](README.zh.md)

This project builds the Keystone tutorial site with Docusaurus 2. Editors maintain the tutorials in Notion. Each production build pulls the current content. English is the default language. Traditional Chinese uses the site locale `zh`.

## Content and navigation

| Tutorials | Notion root page variable | Local output | Site entry |
| --- | --- | --- | --- |
| English | `DOCU_NOTION_DOCS_ROOT_PAGE_EN` | `docs/` | `/docs` |
| Traditional Chinese | `DOCU_NOTION_DOCS_ROOT_PAGE_HANT` | `i18n/zh/docusaurus-plugin-content-docs/current/` | `/zh/docs` |

The home page and the docs entry redirect to the Keystone 3 Pro category for the active locale. The Tutorial sidebar in `sidebars.js` follows the generated directory tree. To change the hierarchy, edit the outline in the corresponding Notion root and pull again. The top navigation and footer links are configured in `docusaurus.config.js`.

Korean Tutorial and the blog links in the footer point to external sites. This project builds only English and Traditional Chinese. The Docusaurus blog plugin is still enabled. The Notion sync no longer pulls blog posts or Korean tutorials. The former GitHub Actions documentation archive workflows have been removed.

## Local development

Use Node.js 24.x and pnpm 11.24.0. From the repository root, run the following commands for initial setup.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Set the following values in `.env` or in the process environment. The pull script loads `.env` by default. It does not automatically load `.env.local`.

| Variable | Source and purpose |
| --- | --- |
| `DOCU_NOTION_INTEGRATION_TOKEN` | Token for the Notion integration. Grant it read access to both roots and the content they reference. Store the token in your local environment or deployment settings. |
| `DOCU_NOTION_DOCS_ROOT_PAGE_EN` | Page ID from the Notion link to the English tutorial root. |
| `DOCU_NOTION_DOCS_ROOT_PAGE_HANT` | Page ID from the Notion link to the Traditional Chinese tutorial root. |
| `AVAILABLE_STATUS` | Notion status filter for database articles. The example uses `Publish`. A preview that includes articles awaiting review can use `Publish,Ready For Review`. |

```sh
pnpm run pull
pnpm run validate:content
pnpm run start
```

Open `http://localhost:3000` for English. Use `pnpm run start --locale zh` for Chinese. The development server reads local files. After changing Notion content, run the pull and validation commands again. Git ignores the generated tutorial files, and a later pull can overwrite local edits.

## Production build and Vercel deployment

For Vercel, use `pnpm run build` as the build command and `build` as the output directory. Set the four variables above in each deployment environment that builds the site. The feedback widget in the tutorial footer writes ratings to Firestore. Its Firebase web app variables are listed in `src/plugins/firebase.ts`.

1. **Pull.** `pull.js` pulls English, then Traditional Chinese. If either command fails, the build stops.
2. **Validate.** `pnpm run validate:content` checks Markdown and MDX under `docs/`, `blog/`, and `i18n/`, including front matter, links, and embeds. Markdown permits attribute-free `<details>` and `<summary>` tags and the prescribed Vimeo player markup. Generated YouTube and Twitter components are outside the allowlist. If validation fails, use the reported file, line, and rule to correct the source in Notion.
3. **Generate.** `docusaurus build` compiles both locales into `build/`. Run `pnpm run serve` to preview this production output locally.
