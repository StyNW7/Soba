import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

if (!process.argv[2])
  throw new Error('Usage: node scripts/export-bears.mjs OUTPUT_DIRECTORY')
const output = resolve(process.argv[2])
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
})
try {
  const { SobaBear, bearCrops } = await server.ssrLoadModule(
    '/src/components/ui/SobaBear.tsx',
  )
  const sheet = await readFile('public/images/mascot/pose-sheet.png')
  await mkdir(output, { recursive: true })
  for (const pose of Object.keys(bearCrops)) {
    const svg = renderToStaticMarkup(createElement(SobaBear, { pose }))
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
      .replace(
        '/images/mascot/pose-sheet.png',
        `data:image/png;base64,${sheet.toString('base64')}`,
      )
    await writeFile(resolve(output, `${pose}.svg`), svg)
  }
  await writeFile(
    resolve(output, 'index.html'),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>SOBA bear crops</title><style>body{background:#faf7f0;color:#493322;font:16px system-ui;padding:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:24px}figure{margin:0;text-align:center}img{width:100%;height:170px;object-fit:contain}figcaption{padding:12px}</style><h1>SOBA bear crops</h1><main>${Object.keys(
      bearCrops,
    )
      .map(
        (pose) =>
          `<figure><img src="${pose}.svg" alt="${pose} bear"><figcaption>${pose}</figcaption></figure>`,
      )
      .join('')}</main></html>`,
  )
  console.log(
    `Exported ${Object.keys(bearCrops).length} standalone SVG crops to ${output}`,
  )
} finally {
  await server.close()
}
