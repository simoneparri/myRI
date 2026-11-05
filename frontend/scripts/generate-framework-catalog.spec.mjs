import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chown, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const generator = fileURLToPath(new URL('./generate-framework-catalog.mjs', import.meta.url));

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'myri-assets-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'scripts'));
  await copyFile(generator, path.join(directory, 'scripts/generate-framework-catalog.mjs'));
  return directory;
}

function generate(directory) {
  return spawnSync(process.execPath, [path.join(directory, 'scripts/generate-framework-catalog.mjs')], {
    encoding: 'utf8',
  });
}

test('generates Devicon and phone assets as the current owner, including repeated runs', async (t) => {
  const directory = await fixture(t);
  const files = {
    'node_modules/devicon/devicon.json': JSON.stringify([
      { name: 'test', versions: { font: ['plain'] } },
    ]),
    'node_modules/devicon/devicon.min.css': '@font-face{src:url("old.ttf")}.test{color:black}',
    'node_modules/devicon/fonts/devicon.woff': 'test font',
    'node_modules/intl-tel-input/dist/css/intlTelInput.css': 'test phone css',
    'node_modules/intl-tel-input/dist/img/flags.webp': 'test flags',
    'node_modules/intl-tel-input/dist/img/flags@2x.webp': 'test flags 2x',
  };
  await mkdir(path.join(directory, 'src/app/shared'), { recursive: true });
  for (const [file, contents] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await writeFile(path.join(directory, file), contents);
  }
  for (let run = 0; run < 2; run += 1) {
    const result = generate(directory);
    assert.equal(result.status, 0, result.stderr);
    const outputs = {
      'src/app/shared/framework-catalog-data.json':
        '[{"name":"test","altnames":[],"fontVariants":["plain"]}]\n',
      'public/assets/devicon/devicon.min.css':
        '@font-face{font-family:"devicon";src:url("fonts/devicon.woff") format("woff");font-weight:normal;font-style:normal;font-display:block}.test{color:black}',
      'public/assets/devicon/fonts/devicon.woff': 'test font',
      'public/assets/devicon/intl-tel-input/css/intlTelInput.css': 'test phone css',
      'public/assets/devicon/intl-tel-input/img/flags.webp': 'test flags',
      'public/assets/devicon/intl-tel-input/img/flags@2x.webp': 'test flags 2x',
    };
    for (const [file, contents] of Object.entries(outputs)) {
      const output = path.join(directory, file);
      assert.equal(await readFile(output, 'utf8'), contents);
      if (process.getuid) assert.equal((await stat(output)).uid, process.getuid());
    }
  }
});

test('root cannot generate in a user-owned checkout, before any output is written', {
  skip: process.getuid?.() !== 0,
}, async (t) => {
  const directory = await fixture(t);
  await chown(directory, 65534, 65534);
  const result = generate(directory);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to generate assets as root/);
  assert.match(result.stderr, /--user/);
  await assert.rejects(stat(path.join(directory, 'public')), { code: 'ENOENT' });
  await assert.rejects(stat(path.join(directory, 'src')), { code: 'ENOENT' });
});
