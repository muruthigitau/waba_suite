import { io, Socket } from "socket.io-client";

class ChatSocket {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(port?: number) {
    const url = process.env.REACT_APP_FRAPPE_URL || "http://localhost:8000";
    const socketUrl = port ? `${url}:${port}` : url;

    this.socket = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    this.setupListeners();
    return this.socket;
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("Socket connected");
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    this.socket.on("latest_chat_updates", (data: any) => {
      this.emit("latest_chat_updates", data);
    });

    this.socket.on("message_status_update", (data: any) => {
      this.emit("message_status_update", data);
    });

    this.socket.on("new_room_creation", (data: any) => {
      this.emit("new_room_creation", data);
    });

    this.socket.on("private_room_creation", (data: any) => {
      this.emit("private_room_creation", data);
    });
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.socket) {
      this.socket.on(event, callback as any);
    }
  }

  off(event: string, callback?: Function) {
    if (callback && this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
      if (this.socket) {
        this.socket.off(event, callback as any);
      }
    } else if (this.socket) {
      this.socket.off(event);
      this.listeners.delete(event);
    }
  }

  private emit(event: string, data: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((callback) => callback(data));
    }
  }

  joinRoom(roomId: string) {
    if (this.socket) {
      this.socket.emit("join", roomId);
    }
  }

  leaveRoom(roomId: string) {
    if (this.socket) {
      this.socket.emit("leave", roomId);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const chatSocket = new ChatSocket();
export default chatSocket;
