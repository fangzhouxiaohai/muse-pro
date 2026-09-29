// 把品牌 mark.svg 渲染为 1024 PNG，供 `tauri icon` 生成全套应用图标
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const svg = readFileSync(join(root, 'brand', 'lyra', 'mark.svg'), 'utf8')
const outDir = join(root, 'brand', 'lyra')
mkdirSync(outDir, { recursive: true })

const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } })
const png = resvg.render().asPng()
writeFileSync(join(outDir, 'mark-1024.png'), png)
console.log('rendered brand/lyra/mark-1024.png', png.length, 'bytes')
