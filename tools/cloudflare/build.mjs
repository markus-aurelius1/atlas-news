/** Clean Cloudflare build with explicit production metadata; optional BASE passes through unchanged. */
import { spawnSync } from 'node:child_process'

const siteUrl = process.env.SITE_URL
if (!siteUrl || new URL(siteUrl).protocol !== 'https:' || new URL(siteUrl).origin !== siteUrl.replace(/\/$/, '')) {
  throw new Error('Set SITE_URL to the confirmed HTTPS Cloudflare production origin before building')
}
// Production runs the editorial selection (validator v3); a plain `npm run build` keeps the source default for the local suites.
process.env.VITE_NEWS_VALIDATOR ??= 'v3'
for (const args of [['ci'], ['run', 'build']]) {
  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { stdio: 'inherit', env: process.env })
    : spawnSync('npm', args, { stdio: 'inherit', env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
