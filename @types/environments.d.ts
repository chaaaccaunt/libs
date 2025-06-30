import type { iDefaultEnvs } from "@/bin"
import type { iHTTPServer } from "@/libs"

declare global {
  declare namespace NodeJS {
    interface ProcessEnv extends iDefaultEnvs, iHTTPServer {
    }
  }
}