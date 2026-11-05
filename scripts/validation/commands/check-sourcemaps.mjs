import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/* Runs after sourcemap inject, before upload */

const CHUNK_ID_MARKER = '//# chunkId=';
const distArg = process.argv[2] ?? 'dist';
const distDir = path.resolve(distArg);
const failures = [];
const fail = (message) => failures.push(message);
const relative = (file) => path.relative(process.cwd(), file) || file;

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() ? [full] : [];
  });

const parseAttributes = (tag) => {
  const attributes = {};
  const attributePattern =
    /\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of tag.replace(/^<script/i, '').matchAll(attributePattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
};

const findModuleEntrySrc = (html) => {
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    const attributes = parseAttributes(tag);
    if (attributes.type === 'module' && attributes.src) return attributes.src;
  }
  return null;
};

const resolveDistAsset = (src) => {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')) return null;
  const localPath = src.replace(/[?#].*$/, '').replace(/^\/+/, '');
  const resolved = path.resolve(distDir, localPath);
  return resolved.startsWith(`${distDir}${path.sep}`) ? resolved : null;
};

const isCssOnlyStub = (content) =>
  content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .trim() === '';

const checkedMaps = new Set();
let entryFile = null;

const checkSourceMap = (mapPath) => {
  if (checkedMaps.has(mapPath)) return;
  checkedMaps.add(mapPath);
  let map;
  try {
    map = JSON.parse(readFileSync(mapPath, 'utf8'));
  } catch (error) {
    fail(`source map ${relative(mapPath)} is not valid JSON: ${error.message}`);
    return;
  }
  if (!Array.isArray(map.sources) || map.sources.length === 0) {
    fail(`source map ${relative(mapPath)} has an empty "sources" list`);
  }
};

const checkEntry = () => {
  const indexPath = path.join(distDir, 'index.html');
  if (!existsSync(indexPath)) {
    fail(`index.html not found in ${relative(distDir)}`);
    return;
  }
  const src = findModuleEntrySrc(readFileSync(indexPath, 'utf8'));
  if (!src) {
    fail('index.html has no <script type="module" src> entry');
    return;
  }
  const entryPath = resolveDistAsset(src);
  if (!entryPath || !existsSync(entryPath)) {
    fail(`entry script "${src}" referenced by index.html was not found in ${relative(distDir)}`);
    return;
  }
  entryFile = entryPath;
  if (!existsSync(`${entryPath}.map`)) {
    fail(`entry script ${relative(entryPath)} has no source map ${relative(entryPath)}.map`);
    return;
  }
  checkSourceMap(`${entryPath}.map`);
};

const checkBundle = () => {
  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    fail(`build output directory not found: ${relative(distDir)}`);
    return 0;
  }
  const jsFiles = walk(distDir).filter((file) => file.endsWith('.js'));
  if (jsFiles.length === 0) {
    fail(`no JavaScript files found under ${relative(distDir)}`);
  }
  let stubCount = 0;
  for (const file of jsFiles) {
    const mapPath = `${file}.map`;
    const hasMap = existsSync(mapPath);
    if (!hasMap && file !== entryFile && isCssOnlyStub(readFileSync(file, 'utf8'))) {
      stubCount += 1;
      continue;
    }
    if (!readFileSync(file, 'utf8').includes(CHUNK_ID_MARKER)) {
      fail(
        `${relative(file)} is missing the PostHog chunk marker "${CHUNK_ID_MARKER}"; run sourcemap inject first`,
      );
    }
    if (!hasMap) {
      fail(`${relative(file)} has no sibling source map ${relative(mapPath)}`);
      continue;
    }
    checkSourceMap(mapPath);
  }
  if (stubCount > 0) {
    process.stdout.write(`check-sourcemaps: exempted ${stubCount} CSS-only JavaScript stub(s)\n`);
  }
  return jsFiles.length;
};

checkEntry();
const jsCount = checkBundle();

if (failures.length > 0) {
  for (const message of failures) {
    process.stderr.write(`check-sourcemaps: ${message}\n`);
  }
  process.exit(1);
}

process.stdout.write(
  `check-sourcemaps: verified ${jsCount} JavaScript file(s) and their source maps in ${relative(distDir)}\n`,
);
