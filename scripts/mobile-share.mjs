#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRIDGE_DIR = path.join(ROOT, 'bridge');

function readValue(lines, key) {
  const line = lines.find((entry) => entry.startsWith(`${key}=`));
  if (!line) return '';
  let value = line.slice(key.length + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

function writeValue(lines, key, value) {
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startsWith(`${key}=`)) matches.push(index);
  }
  if (!matches.length) {
    lines.push(`${key}=${value}`);
    return;
  }
  lines[matches[0]] = `${key}=${value}`;
  for (const index of matches.slice(1).reverse()) lines.splice(index, 1);
}

function isStrongToken(value) {
  return value.length >= 32 && new Set(value).size >= 12 &&
    !/^(replace-with|change-?me|example|your-|test-|secret|password)/i.test(value);
}

function expandHome(value) {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

async function realDirectory(value) {
  const expanded = expandHome(value);
  if (expanded.includes(',') || /[\r\n]/.test(expanded)) {
    throw new Error('Choose a project folder without commas or line breaks.');
  }
  const resolved = await fs.realpath(expanded);
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory() || resolved === path.parse(resolved).root) {
    throw new Error('Choose an existing project folder, not a filesystem root.');
  }
  return resolved;
}

async function writePrivateFile(file, text) {
  const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temp, text, { mode: 0o600, flag: 'wx' });
    await fs.chmod(temp, 0o600);
    await fs.rename(temp, file);
    await fs.chmod(file, 0o600);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

export async function ensureBridgeEnv({ bridgeDir = BRIDGE_DIR, workdir = process.cwd(), tokenFactory = () => randomBytes(32).toString('base64url') } = {}) {
  const envPath = path.join(bridgeDir, '.env');
  const examplePath = path.join(bridgeDir, '.env.example');
  let contents;
  try {
    const stat = await fs.lstat(envPath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('bridge/.env must be a regular file.');
    contents = await fs.readFile(envPath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    contents = await fs.readFile(examplePath, 'utf8');
  }

  const lines = contents.split(/\r?\n/);
  const token = readValue(lines, 'AUTH_TOKEN');
  const authToken = isStrongToken(token) ? token : tokenFactory();
  if (!isStrongToken(authToken)) throw new Error('Could not generate a sufficiently strong pairing token.');
  writeValue(lines, 'AUTH_TOKEN', authToken);

  const workdirValue = readValue(lines, 'ALLOWED_WORKDIRS');
  let allowedWorkdirs;
  if (!workdirValue || workdirValue === '/path/to/your/projects') {
    const selected = await realDirectory(workdir);
    if (selected === await fs.realpath(os.homedir())) {
      throw new Error('The home folder is too broad. Run with --workdir /path/to/one/project.');
    }
    allowedWorkdirs = selected;
    writeValue(lines, 'ALLOWED_WORKDIRS', selected);
  } else {
    allowedWorkdirs = workdirValue;
    for (const folder of allowedWorkdirs.split(',')) {
      await realDirectory(folder.trim());
    }
  }

  const host = readValue(lines, 'HOST') || '127.0.0.1';
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
    throw new Error('For a public quick tunnel, HOST must stay on loopback (127.0.0.1).');
  }
  const rawPort = readValue(lines, 'PORT') || '8787';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');

  await writePrivateFile(envPath, `${lines.join('\n').replace(/\n*$/, '')}\n`);
  return { authToken, allowedWorkdirs, port, host: '127.0.0.1' };
}

function parseArgs(args) {
  const options = { local: false, workdir: process.env.OPENCODE_WORKDIR || process.cwd() };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--local') options.local = true;
    else if (args[index] === '--workdir' && args[index + 1]) options.workdir = args[++index];
    else if (args[index] === '--help' || args[index] === '-h') options.help = true;
    else throw new Error(`Unknown option: ${args[index]}`);
  }
  return options;
}

function printHelp() {
  console.log('OpenCode Mobile · quick connect\n\n  npm run mobile:share -- [--workdir <folder>] [--local]\n\n  Default: start the bridge and a temporary Cloudflare link.\n  --local: run only on this computer. Stop with Ctrl+C.');
}

function startSpinner(initialMessage) {
  if (!process.stdout.isTTY) {
    console.log(`  ${initialMessage}`);
    return { update() {}, stop() {} };
  }
  const frames = ['◐', '◓', '◑', '◒'];
  let frame = 0;
  let message = initialMessage;
  const render = () => {
    const icon = `\x1b[36m${frames[frame++ % frames.length]}\x1b[0m`;
    process.stdout.write(`\r\x1b[2K  ${icon} ${message}`);
  };
  render();
  const timer = setInterval(render, 90);
  timer.unref();
  return {
    update(nextMessage) { message = nextMessage; },
    stop() { clearInterval(timer); process.stdout.write('\r\x1b[2K'); },
  };
}

function parseLog(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function spawnBridge(config) {
  const tsx = path.join(BRIDGE_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const childEnv = {
    ...process.env,
    AUTH_TOKEN: config.authToken,
    ALLOWED_WORKDIRS: config.allowedWorkdirs,
    PORT: String(config.port),
    HOST: config.host,
  };
  const child = spawn(process.execPath, [tsx, 'src/index.ts'], {
    cwd: BRIDGE_DIR,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let connected = false;
  let started = false;
  for (const stream of [child.stdout, child.stderr]) {
    let pending = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() || '';
      for (const line of lines) {
        const event = parseLog(line);
        if (event?.msg === 'connected to OpenCode') connected = true;
        if (event?.msg === 'bridge listening') started = true;
      }
    });
  }
  return { child, get connected() { return connected; }, get started() { return started; } };
}

async function assertPortAvailable(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  }).catch((error) => {
    if (error?.code === 'EADDRINUSE') throw new Error(`Port ${port} is already in use. Stop the existing bridge, then retry.`);
    throw error;
  });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function waitForBridge(bridge, port) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (bridge.child.exitCode !== null) throw new Error('Bridge could not start. Check bridge/.env and confirm OpenCode is running.');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(700) });
      const body = response.ok ? await response.json() : null;
      if (body?.ok === true && bridge.started && bridge.connected) return;
    } catch {
      // The bridge is still starting; keep the terminal status quiet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (bridge.started && !bridge.connected) throw new Error('OpenCode did not connect. Start its service, then retry.');
  throw new Error('Bridge startup timed out. Check bridge/.env.');
}

async function startTunnel(port) {
  const child = spawn('cloudflared', ['tunnel', '--url', `http://127.0.0.1:${port}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const link = await new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error('Quick tunnel did not provide a URL in time.')), 45_000);
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) child.kill('SIGTERM');
      error ? reject(error) : resolve(value);
    };
    for (const stream of [child.stdout, child.stderr]) {
      let pending = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        pending += chunk;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() || '';
        for (const line of lines) {
          const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
          if (match) finish(null, match[0]);
        }
      });
    }
    child.once('error', () => finish(new Error('Could not start cloudflared. Install it, then retry.')));
    child.once('exit', (code) => {
      if (!settled) finish(new Error(code === 0 ? 'Quick tunnel stopped before becoming ready.' : 'Quick tunnel failed to start.'));
    });
  });
  return { child, link };
}

async function commandExists(command) {
  const paths = (process.env.PATH || '').split(path.delimiter);
  for (const directory of paths) {
    try {
      await fs.access(path.join(directory, command), constants.X_OK);
      return true;
    } catch {
      // Keep searching PATH without printing probe noise.
    }
  }
  return false;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`  ${error.message}\n  Use --help for options.`);
    process.exitCode = 2;
    return;
  }
  if (options.help) return printHelp();
  if (!options.local && !(await commandExists('cloudflared'))) {
    console.error('  cloudflared missing · install once: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n  Then run: npm run --silent mobile:share');
    process.exitCode = 1;
    return;
  }

  let config;
  try {
    config = await ensureBridgeEnv({ workdir: options.workdir });
    await fs.access(path.join(BRIDGE_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs'));
    await assertPortAvailable(config.port);
  } catch (error) {
    console.error(`  ${error.message || 'Bridge setup failed.'}`);
    process.exitCode = 1;
    return;
  }

  const spinner = startSpinner('Starting private connection…');
  const bridge = spawnBridge(config);
  let tunnel;
  let stopping = false;
  const cleanup = () => {
    if (stopping) return;
    stopping = true;
    tunnel?.child.kill('SIGTERM');
    bridge.child.kill('SIGTERM');
  };
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
  bridge.child.once('exit', (code) => {
    if (!stopping && code !== 0) {
      clearStatus();
      console.error('  Bridge stopped. Check the OpenCode service and bridge/.env.');
      cleanup();
      process.exitCode = 1;
    }
  });

  try {
    await waitForBridge(bridge, config.port);
    spinner.update(options.local ? 'Finalizing local connection…' : 'Opening secure link…');
    if (!options.local) tunnel = await startTunnel(config.port);
    if (bridge.child.exitCode !== null || (tunnel && tunnel.child.exitCode !== null)) {
      throw new Error('A connection process stopped before setup finished. Retry the command.');
    }
    spinner.stop();
    console.log('\n  OpenCode Mobile');
    console.log('  ─────────────────────────');
    console.log(`  ✓ Bridge ready${bridge.connected ? ' · OpenCode connected' : ''}`);
    console.log(`  ${options.local ? 'Local' : 'Temporary link'}  ${tunnel?.link || `http://127.0.0.1:${config.port}`}`);
    console.log(`  Pairing token  ${config.authToken}`);
    console.log('  Enter both in the app · Ctrl+C stops the bridge and link');
    if (tunnel) console.log('  Public temporary link · use only while testing');

    await new Promise((resolve) => {
      bridge.child.once('exit', resolve);
      tunnel?.child.once('exit', resolve);
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
    });
  } catch (error) {
    spinner.stop();
    console.error(`  ${error.message || 'Could not start the connection.'}`);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
