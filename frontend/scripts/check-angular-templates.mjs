import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../src/app');

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : [path];
    }),
  );
  return nested.flat();
}

const components = [];
for (const path of await sourceFiles(appRoot)) {
  if (!path.endsWith('.ts') || path.endsWith('.spec.ts')) continue;
  const source = await readFile(path, 'utf8');
  if (!/@Component\s*\(/.test(source)) continue;
  const componentDirectory = dirname(path);
  if ([appRoot, join(appRoot, 'features'), join(appRoot, 'shared')].includes(componentDirectory)) {
    throw new Error(`Angular component must be in a dedicated folder: ${relative(appRoot, path)}`);
  }
  if (/\btemplate\s*:/.test(source)) {
    throw new Error(`Inline Angular template found in ${relative(appRoot, path)}`);
  }
  if (/\bstyles\s*:/.test(source)) {
    throw new Error(`Inline Angular styles found in ${relative(appRoot, path)}`);
  }
  const template = /\btemplateUrl\s*:\s*['"]([^'"]+\.html)['"]/.exec(source)?.[1];
  if (!template) {
    throw new Error(`Missing templateUrl in ${relative(appRoot, path)}`);
  }
  try {
    await readFile(resolve(componentDirectory, template), 'utf8');
  } catch {
    throw new Error(`Template file not found for ${relative(appRoot, path)}: ${template}`);
  }
  const styles = /\bstyleUrl\s*:\s*['"]([^'"]+\.scss)['"]/.exec(source)?.[1];
  if (styles) {
    try {
      await readFile(resolve(componentDirectory, styles), 'utf8');
    } catch {
      throw new Error(`Stylesheet not found for ${relative(appRoot, path)}: ${styles}`);
    }
  }
  components.push(path);
}

if (components.length === 0) throw new Error('No Angular components were checked.');
console.log(`Checked ${components.length} Angular components use external templates and styles.`);
