import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEV_CERT_DIR = path.join(__dirname, '.devcert')
const DEV_CERT_PATH = path.join(DEV_CERT_DIR, 'localhost-cert.pem')
const DEV_KEY_PATH = path.join(DEV_CERT_DIR, 'localhost-key.pem')

function ensureLocalHttpsConfig() {
  if (process.env.NODE_ENV === 'production') {
    return undefined
  }

  if (String(process.env.VITE_LOCAL_HTTPS || '').trim().toLowerCase() !== 'true') {
    return undefined
  }

  if (!existsSync(DEV_CERT_PATH) || !existsSync(DEV_KEY_PATH)) {
    try {
      mkdirSync(DEV_CERT_DIR, { recursive: true })
      execFileSync('openssl', [
        'req',
        '-x509',
        '-out', DEV_CERT_PATH,
        '-keyout', DEV_KEY_PATH,
        '-newkey', 'rsa:2048',
        '-nodes',
        '-sha256',
        '-subj', '/CN=localhost',
        '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
        '-days', '3650',
      ], { stdio: 'ignore' })
    } catch {
      return undefined
    }
  }

  try {
    return {
      cert: readFileSync(DEV_CERT_PATH),
      key: readFileSync(DEV_KEY_PATH),
    }
  } catch {
    return undefined
  }
}

const https = ensureLocalHttpsConfig()

// https://vite.dev/config/
export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./test/setup.js",
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
    ...(https ? { https } : {}),
  },
})
