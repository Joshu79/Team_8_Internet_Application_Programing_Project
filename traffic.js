// Run from the project root in PowerShell:
// $env:API = 'http://localhost:5000'; $env:N = '60'; node traffic.js
// The first API_KEYS entry in server/.env is used unless KEY is set.
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Load only the server's local configuration; never print or write its keys.
const serverRequire = createRequire(new URL('./server/index.js', import.meta.url));
serverRequire('dotenv').config({
  path: fileURLToPath(new URL('./server/.env', import.meta.url)),
});

const mix = [
  { method: 'GET', path: '/v1?probe=not-logged', key: 'none' },
  { method: 'GET', path: '/stats', key: 'valid' },
  { method: 'GET', path: '/v1/no-such-route', key: 'valid' },
  { method: 'GET', path: '/v1/no-such-route', key: 'wrong' },
  { method: 'GET', path: '/stats', key: 'none' },
];

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTraffic() {
  const API = (process.env.API || 'http://localhost:5000').replace(/\/$/, '');
  const KEY = process.env.KEY || process.env.API_KEYS?.split(',').map((key) => key.trim()).find(Boolean);
  const N = Number(process.env.N || 60);

  if (!KEY) throw new Error('Add API_KEYS to server/.env or set KEY for this process.');

  const counts = {};

  for (let i = 0; i < N; i += 1) {
    const request = mix[Math.floor(Math.random() * mix.length)];
    const headers = {};
    if (request.key === 'valid') headers['X-API-Key'] = KEY;
    if (request.key === 'wrong') headers['X-API-Key'] = 'intentionally-wrong-key';

    try {
      const response = await fetch(`${API}${request.path}`, {
        method: request.method,
        headers,
      });
      counts[response.status] = (counts[response.status] || 0) + 1;
    } catch {
      counts.failed = (counts.failed || 0) + 1;
    }

    await pause(50);
  }

  console.log('Status codes received:', counts);
  return counts;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runTraffic().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

export { runTraffic };
