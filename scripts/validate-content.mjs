import {readdir, readFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import process from 'node:process';

import {parseExpressionAt} from 'acorn';
import ipaddr from 'ipaddr.js';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import {unified} from 'unified';
import {visit} from 'unist-util-visit';
import YAML from 'yaml';

const DEFAULT_ROOTS = [
  'docs',
  'blog',
  'i18n',
];

const ALLOWED_FRONT_MATTER = new Set([
  'id',
  'title',
  'description',
  'slug',
  'sidebar_label',
  'sidebar_position',
  'tags',
  'keywords',
  'hide_title',
  'hide_table_of_contents',
  'pagination_next',
  'pagination_prev',
  'draft',
  'date',
  'authors',
  'image',
]);

const FORBIDDEN_MDX_NODES = new Set([
  // MDX 1 node names.
  'import',
  'export',
  'jsx',
  // MDX 2/3 node names.
  'mdxFlowExpression',
  'mdxTextExpression',
]);

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ALLOWED_SCHEMES = new Set(['https:', 'mailto:']);
const ALLOWED_REACT_PLAYER_HOSTS = new Set([
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
]);

// Docusaurus documentation uses native disclosure widgets for FAQs. Keep this
// allowlist deliberately narrow: only attribute-free details/summary tags are
// accepted; every other raw HTML tag remains forbidden.
function isAllowedDisclosureHtml(value) {
  const withoutAllowedTags = value.replace(/<\/?(?:details|summary)\s*>/gi, '');
  return withoutAllowedTags === value
    ? false
    : !/[<>]/.test(withoutAllowedTags);
}

function addViolation(violations, file, node, code, detail) {
  violations.push({
    file,
    line: node?.position?.start?.line ?? 1,
    code,
    detail,
  });
}

function isNonPublicIp(hostname) {
  if (!ipaddr.isValid(hostname)) return false;

  const range = ipaddr.parse(hostname).range();
  return range !== 'unicast';
}

function validateUrl(raw, {file, node, context, violations}) {
  if (typeof raw !== 'string' || raw.length === 0) return;

  if (raw.startsWith('//')) {
    addViolation(violations, file, node, 'protocol_relative_url', raw);
    return;
  }

  // Relative links and anchors are handled by Docusaurus.
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('#')) {
    return;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    addViolation(violations, file, node, 'invalid_url', raw);
    return;
  }

  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    addViolation(violations, file, node, 'dangerous_url_scheme', raw);
  }
  if (url.username || url.password) {
    addViolation(violations, file, node, 'url_credentials', raw);
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || isNonPublicIp(hostname)) {
    addViolation(violations, file, node, 'non_public_ip_url', raw);
  }

  if (context === 'react-player' && !ALLOWED_REACT_PLAYER_HOSTS.has(hostname)) {
    addViolation(violations, file, node, 'unapproved_embed_host', raw);
  }
}

function validateObjectKeys(value, {file, node, violations}, path = '') {
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      addViolation(violations, file, node, 'forbidden_front_matter_key', `${path}${key}`);
    }
    validateObjectKeys(child, {file, node, violations}, `${path}${key}.`);
  }
}

function validateFrontMatter(node, file, violations) {
  let value;
  try {
    value = YAML.parse(node.value, {maxAliasCount: 0});
  } catch (error) {
    addViolation(violations, file, node, 'invalid_front_matter', error.message);
    return;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    addViolation(violations, file, node, 'invalid_front_matter', 'front matter must be an object');
    return;
  }

  validateObjectKeys(value, {file, node, violations});

  for (const key of Object.keys(value)) {
    if (!ALLOWED_FRONT_MATTER.has(key)) {
      addViolation(violations, file, node, 'unknown_front_matter_field', key);
    }
  }

  if (typeof value.title === 'string' && value.title.length > 200) {
    addViolation(violations, file, node, 'front_matter_title_too_long', String(value.title.length));
  }
  if (typeof value.description === 'string' && value.description.length > 500) {
    addViolation(violations, file, node, 'front_matter_description_too_long', String(value.description.length));
  }
  if (typeof value.slug === 'string' && !/^\/?[a-zA-Z0-9/_-]+$/.test(value.slug)) {
    addViolation(violations, file, node, 'unsafe_slug', value.slug);
  }

  for (const key of ['image']) {
    if (typeof value[key] === 'string') {
      validateUrl(value[key], {file, node, context: key, violations});
    }
  }
}

function getMdxAttribute(node, name) {
  const attribute = node.attributes?.find((item) => item.type === 'mdxJsxAttribute' && item.name === name);
  return typeof attribute?.value === 'string' ? attribute.value : undefined;
}

function validateReactPlayer(node, file, violations) {
  const allowedAttributes = new Set(['controls', 'url']);

  if (node.name !== 'ReactPlayer') {
    addViolation(violations, file, node, 'forbidden_mdx_component', node.name ?? '<fragment>');
    return;
  }

  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== 'mdxJsxAttribute' || !allowedAttributes.has(attribute.name)) {
      addViolation(violations, file, node, 'forbidden_mdx_attribute', attribute.name ?? attribute.type);
      continue;
    }
    if (attribute.value && typeof attribute.value !== 'string') {
      addViolation(violations, file, node, 'mdx_attribute_expression', attribute.name);
    }
  }

  const url = getMdxAttribute(node, 'url');
  if (!url) {
    addViolation(violations, file, node, 'missing_embed_url', 'ReactPlayer.url');
  } else {
    validateUrl(url, {file, node, context: 'react-player', violations});
  }
}

function maskAllowedMarkdownMdx(source, file, violations) {
  const lines = source.split('\n');
  let hasReactPlayerImport = false;

  const maskedLines = lines.map((line, index) => {
    const node = {position: {start: {line: index + 1}}};
    const trimmed = line.trim();

    if (/^import ReactPlayer from ["']react-player["'];?$/.test(trimmed)) {
      hasReactPlayerImport = true;
      return '';
    }

    if (/^(?:import|export)\b/.test(trimmed)) {
      addViolation(violations, file, node, 'forbidden_mdx_execution', trimmed.slice(0, 120));
      return line;
    }

    const playerMatch = trimmed.match(/^<ReactPlayer\s+controls\s+url=(["'])(.*?)\1\s*\/>$/);
    if (playerMatch) {
      if (!hasReactPlayerImport) {
        addViolation(violations, file, node, 'missing_react_player_import', 'ReactPlayer');
      }
      validateUrl(playerMatch[2], {file, node, context: 'react-player', violations});
      return '';
    }

    for (const match of line.matchAll(/\{([^{}]*)\}/g)) {
      const expression = match[1].trim();
      if (!expression) continue;

      // Safe's historical brand spelling is literal prose, not an MDX
      // expression. This exact token cannot execute code and is present in
      // both front matter and article copy imported from Notion.
      if (expression === 'Wallet' && line.slice(0, match.index).endsWith('Safe')) {
        continue;
      }

      try {
        const parsed = parseExpressionAt(expression, 0, {ecmaVersion: 'latest'});
        if (parsed.end === expression.length) {
          addViolation(violations, file, node, 'forbidden_mdx_expression', `{${expression.slice(0, 100)}}`);
        }
      } catch {
        // Non-JavaScript braces are ordinary Markdown text.
      }
    }

    return line;
  });

  return maskedLines.join('\n');
}

function validateTree(tree, file) {
  const violations = [];

  visit(tree, (node) => {
    if (node.type === 'yaml') {
      validateFrontMatter(node, file, violations);
      return;
    }

    if (node.type === 'html') {
      if (!isAllowedDisclosureHtml(node.value)) {
        addViolation(violations, file, node, 'raw_html', node.value.slice(0, 120));
      }
      return;
    }

    if (node.type === 'mdxjsEsm') {
      if (!/^import ReactPlayer from ["']react-player["'];?\s*$/.test(node.value)) {
        addViolation(violations, file, node, 'forbidden_mdx_execution', node.value.slice(0, 120));
      }
      return;
    }

    if (FORBIDDEN_MDX_NODES.has(node.type)) {
      addViolation(violations, file, node, 'forbidden_mdx_execution', node.type);
      return;
    }

    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      validateReactPlayer(node, file, violations);
      return;
    }

    if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
      validateUrl(node.url, {file, node, context: node.type, violations});
    }
  });

  return violations;
}

async function collectContentFiles(root) {
  const files = [];
  let entries;
  try {
    entries = await readdir(root, {withFileTypes: true});
  } catch (error) {
    if (error.code === 'ENOENT') return files;
    throw error;
  }

  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectContentFiles(path));
    } else if (['.md', '.mdx'].includes(extname(entry.name).toLowerCase())) {
      files.push(path);
    }
  }
  return files;
}

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml']);

const mdxProcessor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkMdx);

const requestedRoots = process.argv.slice(2).filter((argument) => argument !== '--');
const roots = requestedRoots.length > 0 ? requestedRoots : DEFAULT_ROOTS;
const files = (await Promise.all(roots.map((root) => collectContentFiles(resolve(root))))).flat();

if (files.length === 0) {
  console.error(`Content validation failed: no Markdown/MDX files found under ${roots.join(', ')}`);
  process.exit(1);
}

const violations = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  try {
    if (extname(file).toLowerCase() === '.mdx') {
      violations.push(...validateTree(mdxProcessor.parse(source), file));
    } else {
      const fileViolations = [];
      const maskedSource = maskAllowedMarkdownMdx(source, file, fileViolations);
      fileViolations.push(...validateTree(markdownProcessor.parse(maskedSource), file));
      violations.push(...fileViolations);
    }
  } catch (error) {
    violations.push({file, line: error.line ?? 1, code: 'parse_error', detail: error.message});
  }
}

if (violations.length > 0) {
  console.error(`Content validation failed with ${violations.length} violation(s):`);
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} ${violation.code}: ${violation.detail}`);
  }
  process.exit(1);
}

console.log(`Content validation passed for ${files.length} file(s).`);
