import { createServer, IncomingMessage, Server, ServerResponse } from "http";
import { verify } from "jsonwebtoken"

interface iValidator {
  isArray: {}
  isObject: {}
  isPrimitive: {}
}

export interface iRoute {
  url: string
  method: "GET" | "POST" | "PATCH" | "DELETE"
  requireAuth: boolean
  callback: <T extends unknown>() => Promise<{ error: boolean, result: T }>
  validator?: iValidator
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

export class HTTPServer {
  public server: Server
  private routes: Map<string, iRoute> = new Map()
  private cookieName = new RegExp(`^${process.env.VAR_COOKIE_NAME}=`)
  constructor(private validate = false, private port: number) {
    this.server = createServer((request, response) => this.requestHandler(request, response))
  }
  private assignJsonFunction(response: ServerResponse): ({ error, status, result }: { error: boolean, status: number, result: any }) => void {
    return function ({ error, status, result }) {
      response.writeHead(status, {
        "access-control-allow-credentials": "true",
        "access-control-allow-origin": process.env.VAR_ORIGIN,
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
    request.on("end", async () => {
      if (!request.url || !request.method) return response.json({ error: true, status: 400, result: false });
      response.json = this.assignJsonFunction(response)
      const match = this.routes.get(`${request.method}:${request.url}`)
      if (!match) return response.json({ error: true, status: 400, result: false });
      return await this.endpointExecutor(request, response, match)
    })
  }
  private endpointExecutor(request: IncomingMessage, response: ServerResponse, route: iRoute): Promise<{ error: boolean, result: any }> {
    return new Promise(async (resolve, reject) => {
      if (route.requireAuth)
        return await route.callback()
    })
  }
  private tokenValidator(request: IncomingMessage) {
    if (!request.headers.cookie || !request.headers.cookie.length) return false
    const cookies = request.headers.cookie.split(";")
    for (let i = 0; i < cookies.length; i++) {
      if (this.cookieName.test(cookies[i])) {
        const valid = verify(cookies[i].trim().split("=")[1], process.env.VAR_TOKEN)
        if (!valid) return false
        request.user = valid
        return true
      }
    }
    return false
  }
}