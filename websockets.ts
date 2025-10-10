import { Server as ServerHTTP } from "http";
import { verify } from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { iUserToken } from "./HTTPServer";

interface iMessage {
  message: string,
  files?: { url: string, desc: string }[]
}

interface ClientToServerEvents {
  join: (roomName: string) => void
  message: (payload: iMessage & { to: string }) => void
}

interface ServerToClientEvents {
  message: (message: iMessage) => void
  update: (message: iMessage) => void
}

interface InterServerEvents { }

interface SocketData {
  user: iUserToken
}

export class WebSockets {
  private whiteList: Set<string> = new Set([process.env.VAR_ORIGIN])
  private users: { fullname: string, shortName: string, online: boolean }[] = []
  private cookieName = new RegExp(`^${process.env.VAR_COOKIE_NAME}=`)
  readonly WebSocketServer: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
  constructor(httpServer: ServerHTTP) {
    this.WebSocketServer = new Server(httpServer, {
      cors: {
        credentials: true,
        origin: (origin, cb) => {
          if (origin && this.whiteList.has(origin)) return cb(null, origin);
          return cb(new Error("Not allowed origin"))
        }
      }
    })
    this.WebSocketServer.use((socket, next) => {
      const valid = this.tokenValidator(socket)
      if (!valid) return next(new Error("Unauthorized request"));
      return next()
    })
    this.WebSocketServer.on("connection", (socket) => {
      socket.join("public")
      socket.on("join", () => { })
      this.handleEvents(socket)
      socket.on("disconnect", () => { })
    })
  }
  private handleEvents(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    socket.on("join", (roomName: string) => socket.join(roomName))
    socket.on("message", (payload) => {
      this.sendMessageToRoom({ roomName: payload.to, payload: { files: payload.files, message: payload.message } })
    })
  }
  private tokenValidator(socket: Socket) {
    if (!socket.request.headers.cookie || !socket.request.headers.cookie.length) return false
    const cookies = socket.request.headers.cookie.split(";")
    if (!process.env.VAR_TOKEN) throw new Error("missing VAR_TOKEN")
    for (let i = 0; i < cookies.length; i++) {
      if (this.cookieName.test(cookies[i].trim())) {
        return verify(cookies[i].trim().split("=")[1], process.env.VAR_TOKEN, (err, data) => {
          if (err) return false
          socket.data.user = data as iUserToken
          return true
        })
      }
    }
    return false
  }
  sendMessageToRoom({ roomName, payload }: { roomName: string, payload: { message: string, files?: { url: string, desc: string }[] } }) {
    this.WebSocketServer.to(roomName).emit("message", payload)
  }
  sendUpdateEvent({ eventName, payload }: { eventName: "update", payload: any }) {
    this.WebSocketServer.to("public").emit(eventName, payload)
  }
}