import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

export function assignEnv() {
  let cwd = process.cwd()
  for (let i = 0; i < 9; i++) {
    const exist = resolve(cwd, ".env")
    if (existsSync(exist)) return readEnvFile(exist)
    else cwd = resolve(cwd, "..")
  }
}

function readEnvFile(path: string) {
  const data = readFileSync(path).toString()
  const rows = data.split("\n")
  const comment = new RegExp(/^#/)
  rows.forEach((row) => {
    if (comment.test(row)) return
    const [key, value] = row.split("=")
    if (!value) return
    process.env[key] = value
  })
}