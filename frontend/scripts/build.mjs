import { cp, mkdir } from "node:fs/promises"

const dist = new URL("../dist/", import.meta.url)
await mkdir(dist, { recursive: true })
await cp(new URL("../public/", import.meta.url), dist, { recursive: true })
