import { __unstable__loadDesignSystem } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _cache = new Map();
const _scanner = new Scanner({});

const jsKeywords = new Set([
  'const', 'let', 'var', 'function', 'import', 'export', 'if', 'else',
  'for', 'while', 'return', 'class', 'as', 'from', 'true', 'false',
  'undefined', 'null', 'switch', 'case', 'break', 'continue', 'try',
  'catch', 'finally', 'throw', 'new', 'this', 'typeof', 'instanceof',
  'void', 'delete', 'in', 'of',
]);

const htmlAttrs = new Set([
  'id', 'class', 'href', 'src', 'alt', 'type', 'name', 'key', 'ref',
  'rel', 'target', 'title', 'style', 'value', 'role', 'aria', 'data',
  'action', 'method', 'enctype', 'lang', 'dir', 'width', 'height',
  'size', 'max', 'min', 'step', 'placeholder', 'disabled', 'readonly',
  'required', 'autofocus', 'autocomplete', 'spellcheck',
]);

async function getDesignSystem(cssContent, base) {
  const key = cssContent + '|' + base;
  if (_cache.has(key)) return _cache.get(key);
  const ds = await __unstable__loadDesignSystem(cssContent, { base });
  _cache.set(key, ds);
  return ds;
}

function findFiles(dir, extension) {
  const files = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findFiles(fullPath, extension));
      } else if (entry.isFile() && extname(entry.name) === extension) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

function scanAstroFiles() {
  const srcDir = join(__dirname, 'src');
  if (!existsSync(srcDir)) return [];

  const astroFiles = findFiles(srcDir, '.astro');
  const allCandidates = new Set();

  for (const file of astroFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const candidates = _scanner.scanFiles([{ content, extension: 'html' }]);
      for (const c of candidates) {
        allCandidates.add(c);
      }
    } catch {}
  }

  return [...allCandidates];
}

function isRealClass(candidate) {
  return !candidate.startsWith('---') &&
    !candidate.startsWith('[') &&
    !candidate.startsWith('--') &&
    candidate !== '' &&
    !jsKeywords.has(candidate) &&
    !htmlAttrs.has(candidate) &&
    !/[{}()/]/.test(candidate);
}

export default function tailwindPlugin() {
  return {
    name: 'custom-tailwind',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.endsWith('.css') && !id.includes('&lang.css')) return;
      if (!code.includes('@import "tailwindcss"')) return;

      try {
        const cssPath = id.split('?')[0];
        if (!existsSync(cssPath)) return;

        const base = dirname(dirname(cssPath));
        const ds = await getDesignSystem(code, base);
        if (!ds) return;

        const rawCandidates = scanAstroFiles();
        const classCandidates = rawCandidates.filter(isRealClass);
        const validClasses = [];

        if (classCandidates.length > 0) {
          const order = ds.getClassOrder(classCandidates);
          for (const [cls, val] of order) {
            if (val !== null) validClasses.push(cls);
          }
        }

        if (validClasses.length === 0) return;

        const generated = ds.candidatesToCss(validClasses);
        const result = generated.filter(Boolean).join('\n');

        return {
          code: result,
          map: null,
        };
      } catch (e) {
        console.error('[custom-tailwind] Error:', e.message);
        return;
      }
    },
  };
}
