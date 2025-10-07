import { createServer, IncomingMessage, Server, ServerResponse } from "http";
import { verify } from "jsonwebtoken"

interface iCommonValues {
  optional?: boolean
}

type iPrimitiveTypes = "number" | "string" | "boolean"

interface iPrimitiveTypesValue {
  number: {
    min: number,
    max?: number
  }
  string: {
    minLength: number
    maxLength?: number
  }
  boolean: {

  }
}

export interface iValidator extends iCommonValues {
  isArray?: {

  }
  isPrimitive?: {
    [T in iPrimitiveTypes]: iPrimitiveTypesValue[T]
  }
  isObject?: {
    [key: string]: iValidator
  }
}

export interface iHTTPServer {
  VAR_ORIGIN: string
  VAR_COOKIE_NAME: string
  VAR_TOKEN: string
}

export interface iUserToken { }

declare module "http" {
  interface IncomingMessage {
    user: iUserToken
  }
  interface ServerResponse {
    json: ({ error, status, result }: { error: boolean, status: number, result: any }) => void;
  }
}

export interface iRoute<Payload = any, Result = any> {
  url: string
  method: "GET" | "POST" | "PATCH" | "DELETE"
  requireAuth: boolean
  callback: (user: iUserToken, payload: Payload) => Promise<{ result: Result }>
  validator?: { [key: string]: iValidator }
}

export class HTTPServer {
  public server: Server
  private routes: Map<string, iRoute> = new Map()
  private cookieName = new RegExp(`^${process.env.VAR_COOKIE_NAME}=`)
  constructor() {
    if (!process.env.VAR_ORIGIN) throw Error("VAR_ORIGIN is missing")
    this.server = createServer((request, response) => this.requestHandler(request, response))
  }
  private assignJsonFunction(response: ServerResponse): ({ error, status, result }: { error: boolean, status: number, result: any }) => void {
    return function ({ error, status, result }) {
      response.writeHead(status, {
        "access-control-allow-credentials": "true",
        "access-control-allow-origin": "http://uibot.gtrktuva.local",
        "content-type": "application/json; charset=utf-8"
      })
      return response.end(JSON.stringify({ error, response: result }))
    }
  }
  private requestHandler(request: IncomingMessage, response: ServerResponse) {
    let body = Buffer.alloc(0)
    request.on("data", (chunk: Buffer) => {
      body = Buffer.concat([body, chunk])
      if (body.length > 1024 * 5) {
        response.json = this.assignJsonFunction(response)
        return response.json({ error: true, status: 413, result: false })
      }
    })
    request.on("end", () => {
      if (!request.url || !request.method) return response.json({ error: true, status: 400, result: false });
      response.json = this.assignJsonFunction(response)
      const match = this.routes.get(`${request.method}:${request.url}`)
      if (process.env.VAR_DEBUG && !match) console.log("Mismatch endpoint url", request.url)
      if (!match) return response.json({ error: true, status: 404, result: false });
      try {
        let payload: Record<any, any> | undefined = undefined
        if (match.method !== "GET") payload = JSON.parse(body.toString())
        if (process.env.VAR_DEBUG) console.log("Handled route", match, `with payload: ${payload}`)
        return this.endpointExecutor(request, response, match, payload)
      }
      catch (error) {
        return response.json({ error: true, status: 404, result: false })
      }
    })
  }
  private endpointExecutor(request: IncomingMessage, response: ServerResponse, route: iRoute, payload?: Record<any, any>): Promise<void> {
    return new Promise((resolve) => {
      if (route.requireAuth) {
        const valid = this.tokenValidator(request)
        if (!valid) {
          response.json({ error: true, status: 403, result: false });
          return resolve()
        }
      }
      if (route.validator && !payload) {
        response.json({ error: true, result: false, status: 400 })
        return resolve()
      }
      if (route.validator && payload) {
        const validPayload = this.payloadValidator(payload, route.validator)
      }
      route.callback(request.user, payload)
        .then(({ result }) => {
          if (process.env.VAR_DEBUG) console.log("Success execute", result)
          response.json({ error: false, result, status: 200 })
          return resolve()
        })
        .catch((error) => {
          if (process.env.VAR_DEBUG) console.log("Failed execute", error)
          response.json({ error: true, result: false, status: 400 })
          return resolve()
        })
    })
  }
  private tokenValidator(request: IncomingMessage) {
    if (!request.headers.cookie || !request.headers.cookie.length) return false
    const cookies = request.headers.cookie.split(";")
    if (!process.env.VAR_TOKEN) throw new Error("missing VAR_TOKEN")
    for (let i = 0; i < cookies.length; i++) {
      if (this.cookieName.test(cookies[i].trim())) {
        return verify(cookies[i].trim().split("=")[1], process.env.VAR_TOKEN, (err, data) => {
          if (err) return false
          request.user = data as iUserToken
          return true
        })
      }
    }
    return false
  }
  private payloadValidator(payload: Record<any, any>, scheme: { [key: string]: iValidator }): { error: boolean, message: string } {
    const types = Object.entries(scheme)
    const payloadKeys = Object.keys(payload)
    const sameKeys = payloadKeys.every(v => types.findIndex(k => k[0] === v) !== -1)
    console.log(sameKeys)
    const result: { error: boolean, message: string } = { message: "", error: false }
    for (let i = 0; i < types.length; i++) {
      const [key, type] = types[i]
      if (type.optional && (!payload[key] || (Array.isArray(payload[key] && !payload[key].length)))) continue
      if (type.isArray) {
        if (!Array.isArray(payload[key])) return { error: true, message: `Проверьте корректность введенных данных. Значение "${payload[key]}" имеет не валидные данные` }

      } else if (type.isObject) {
        if (!Array.isArray(payload[key])) return { error: true, message: `Проверьте корректность введенных данных. Значение "${payload[key]}" имеет не валидные данные` }
      } else if (type.isPrimitive) {

      }
    }
    return result
  }
  private normalizePort(val: string) {
    const port = parseInt(val, 10);
    if (Number.isNaN(port)) {
      return val;
    }
    if (port >= 0) {
      return port;
    }
    return false;
  }
  listen(port: string) {
    this.server.listen(this.normalizePort(port), () => {
      if (process.env.VAR_DEBUG) console.log(`HTTP server started listen port ${port}`)
    })
  }
  use(routes: iRoute[]) {
    routes.forEach((r) => {
      this.routes.set(`${r.method}:${r.url}`, r)
      if (process.env.VAR_DEBUG) console.log(`HTTP server apply route ${r}`)
    })
  }
}
