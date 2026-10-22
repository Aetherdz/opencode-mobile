import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ensureBridgeEnv } from './mobile-share.mjs';

const tempDirs = [];

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-share-'));
  tempDirs.push(root);
  const bridgeDir = path.join(root, 'bridge');
  const workdir = path.join(root, 'project');
  await fs.mkdir(bridgeDir);
  await fs.mkdir(workdir);
  return { bridgeDir, workdir, envPath: path.join(bridgeDir, '.env') };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

test('creates a private env, generates a strong token, and replaces the sample workdir', async () => {
  const { bridgeDir, workdir, envPath } = await fixture();
  await fs.writeFile(path.join(bridgeDir, '.env.example'), [
    'HOST=127.0.0.1',
    'PORT=8787',
    'AUTH_TOKEN=',
    'ALLOWED_WORKDIRS=/path/to/your/projects',
  ].join('\n'));

  const generatedToken = 'aBcDeFgHiJkL'.repeat(4);
  const config = await ensureBridgeEnv({ bridgeDir, workdir, tokenFactory: () => generatedToken });
  const text = await fs.readFile(envPath, 'utf8');
  const mode = (await fs.stat(envPath)).mode & 0o777;

  assert.equal(config.allowedWorkdirs, workdir);
  assert.equal(config.port, 8787);
  assert.equal(config.authToken, generatedToken);
  assert.ok(text.split(/\r?\n/).includes(`ALLOWED_WORKDIRS=${workdir}`));
  assert.equal(mode, 0o600);
});

test('preserves a valid token and existing workdir', async () => {
  const { bridgeDir, workdir, envPath } = await fixture();
  const token = 'aB3dE5gH7jK9mN2pQ4sT6vW8xY0zA1bC';
  await fs.writeFile(envPath, `HOST=127.0.0.1\nPORT=9010\nAUTH_TOKEN=${token}\nALLOWED_WORKDIRS=${workdir}\n`);

  const config = await ensureBridgeEnv({
    bridgeDir,
    workdir,
    tokenFactory: () => { throw new Error('must not rotate an existing token'); },
  });

  assert.equal(config.authToken, token);
  assert.equal(config.port, 9010);
});

test('rejects the home directory as an automatic workdir', async () => {
  const { bridgeDir } = await fixture();
  await fs.writeFile(path.join(bridgeDir, '.env.example'), 'AUTH_TOKEN=\nALLOWED_WORKDIRS=\n');
  await assert.rejects(
    ensureBridgeEnv({ bridgeDir, workdir: os.homedir() }),
    /home folder is too broad/i,
  );
});

test('refuses a symlinked env file instead of following it', async () => {
  const { bridgeDir, workdir, envPath } = await fixture();
  const outside = path.join(bridgeDir, 'outside.env');
  await fs.writeFile(outside, 'AUTH_TOKEN=unchanged\n');
  await fs.symlink(outside, envPath);
  await fs.writeFile(path.join(bridgeDir, '.env.example'), 'AUTH_TOKEN=\nALLOWED_WORKDIRS=\n');
  await assert.rejects(ensureBridgeEnv({ bridgeDir, workdir }), /regular file/i);
  assert.equal(await fs.readFile(outside, 'utf8'), 'AUTH_TOKEN=unchanged\n');
});
