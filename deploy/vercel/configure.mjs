import { readFileSync, writeFileSync } from 'node:fs'

const origin = new URL(process.env.SOBA_API_ORIGIN || '')
if (
  origin.protocol !== 'https:' || origin.username || origin.password ||
  origin.pathname !== '/' || origin.search || origin.hash ||
  origin.hostname.endsWith('.trycloudflare.com') ||
  origin.hostname === 'localhost'
) {
  throw new Error('SOBA_API_ORIGIN must be a stable public HTTPS origin')
}
const path = new URL('../../frontend/vercel.json', import.meta.url)
const config = JSON.parse(readFileSync(path, 'utf8'))
config.rewrites = [
  { source: '/v1/:path*', destination: `${origin.origin}/v1/:path*` },
  { source: '/health/:path*', destination: `${origin.origin}/health/:path*` },
  ...config.rewrites.filter(rule => !['/v1/:path*', '/health/:path*'].includes(rule.source)),
]
writeFileSync(path, JSON.stringify(config, null, 2) + '\n')
