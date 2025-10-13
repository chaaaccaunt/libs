import { Server as ServerHTTP } from "http";
import { verify } from "jsonwebtoken";
import { ExtendedError, Server, Socket } from "socket.io";
import { iUserToken } from "./HTTPServer";
import { UUID } from "crypto";

interface iMessage {
  message: string,
  files?: { url: string, desc: string }[]
}

export interface iUserInfo {
  fullname: string,
  shortName: string,
  online: boolean,
  uid: UUID
}

interface ClientToServerEvents {
  joinRoom: (roomName: string) => void
  leaveRoom: (roomName: string) => void
  message: (payload: iMessage & { to: string }) => void
  online: () => void
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
  private users: iUserInfo[] = []
  private cookieName = new RegExp(`^${process.env.VAR_COOKIE_NAME}=`)
  readonly WebSocketServer: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
  constructor(httpServer: ServerHTTP) {
    if (!process.env.VAR_TOKEN) throw new Error("missing VAR_TOKEN")
    this.WebSocketServer = new Server(httpServer, {
      cors: {
        credentials: true,
        origin: (origin, cb) => {
          if (origin && this.whiteList.has(origin)) return cb(null, origin);
          return cb(new Error("Not allowed origin"))
        }
      },
      path: "/connections"
    })
    this.WebSocketServer.use((socket, next) => this.tokenValidator(socket, next))
    this.WebSocketServer.on("connection", (socket) => this.handleEvents(socket))
  }
  private handleEvents(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    socket.join("public")
    socket.on("online", () => {
      const exist = this.users.findIndex((u) => u.uid === socket.data.user.uid)
      if (exist !== -1) this.users[exist].online = true
    })
    socket.on("joinRoom", (roomName: string) => socket.join(roomName))
    socket.on("leaveRoom", (roomName: string) => socket.leave(roomName))
    socket.on("message", (payload) => {
      this.sendMessageToRoom({ roomName: payload.to, payload: { files: payload.files, message: payload.message } })
    })
    socket.on("disconnect", () => {
      const exist = this.users.findIndex((u) => u.uid === socket.data.user.uid)
      if (exist !== -1) this.users[exist].online = false
    })
  }
  private tokenValidator(socket: Socket, next: (err?: ExtendedError) => void) {
    if (!socket.request.headers.cookie || !socket.request.headers.cookie.length) return false
    const cookies = socket.request.headers.cookie.split(";")
    for (let i = 0; i < cookies.length; i++) {
      if (this.cookieName.test(cookies[i].trim())) {
        return verify(cookies[i].trim().split("=")[1], process.env.VAR_TOKEN, (err, data) => {
          if (err) return next(new Error("Internal server error"))
          socket.data.user = data as iUserToken
          return next()
        })
      }
    }
    return next(new Error("Unauthorized request"))
  }
  setUsers(users: iUserInfo[]) {
    this.users = users
  }
  sendMessageToRoom({ roomName, payload }: { roomName: string, payload: { message: string, files?: { url: string, desc: string }[] } }) {
    this.WebSocketServer.to(roomName).emit("message", payload)
  }
  sendUpdateEvent({ eventName, payload }: { eventName: "update", payload: any }) {
    this.WebSocketServer.to("public").emit(eventName, payload)
  }
}