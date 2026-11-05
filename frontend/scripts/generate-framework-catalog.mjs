import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, '..');
if (process.getuid?.() === 0 && (await stat(frontendDirectory)).uid !== 0) {
  throw new Error(
    'Refusing to generate assets as root in a user-owned checkout. ' +
      'Run Node as the checkout owner; for Docker bind mounts use --user "$(id -u):$(id -g)".',
  );
}
const packagePath = path.resolve(scriptDirectory, '../node_modules/devicon/devicon.json');
const packageCssPath = path.resolve(scriptDirectory, '../node_modules/devicon/devicon.min.css');
const packageFontPath = path.resolve(
  scriptDirectory,
  '../node_modules/devicon/fonts/devicon.woff',
);
const phoneInputPath = path.resolve(scriptDirectory, '../node_modules/intl-tel-input/dist');
const outputPath = path.resolve(
  scriptDirectory,
  '../src/app/shared/framework-catalog-data.json',
);
const assetsPath = path.resolve(scriptDirectory, '../public/assets/devicon');
const phoneAssetsPath = path.join(assetsPath, 'intl-tel-input');
const entries = JSON.parse(await readFile(packagePath, 'utf8'));
const compactEntries = entries.map((entry) => ({
  name: entry.name,
  altnames: entry.altnames ?? [],
  fontVariants: entry.versions?.font ?? [],
}));

await mkdir(path.join(assetsPath, 'fonts'), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(compactEntries)}\n`);
const css = await readFile(packageCssPath, 'utf8');
const woffCss = css.replace(
  /@font-face\{[^}]*\}/,
  '@font-face{font-family:"devicon";src:url("fonts/devicon.woff") format("woff");font-weight:normal;font-style:normal;font-display:block}',
);
await writeFile(path.join(assetsPath, 'devicon.min.css'), woffCss);
await copyFile(packageFontPath, path.join(assetsPath, 'fonts/devicon.woff'));
await mkdir(path.join(phoneAssetsPath, 'css'), { recursive: true });
await mkdir(path.join(phoneAssetsPath, 'img'), { recursive: true });
await copyFile(
  path.join(phoneInputPath, 'css/intlTelInput.css'),
  path.join(phoneAssetsPath, 'css/intlTelInput.css'),
);
await copyFile(
  path.join(phoneInputPath, 'img/flags.webp'),
  path.join(phoneAssetsPath, 'img/flags.webp'),
);
await copyFile(
  path.join(phoneInputPath, 'img/flags@2x.webp'),
  path.join(phoneAssetsPath, 'img/flags@2x.webp'),
);
