import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'
import toIco from 'to-ico'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  const svgPath = resolve(__dirname, '../public/favicon.svg')
  const icoPath = resolve(__dirname, '../public/favicon.ico')
  const svg = await readFile(svgPath)
  const sizes = [16, 32, 48, 64]
  const pngs = await Promise.all(
    sizes.map((size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()),
  )
  const ico = await toIco(pngs)
  await writeFile(icoPath, ico)
  console.log(`Generated ${icoPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
