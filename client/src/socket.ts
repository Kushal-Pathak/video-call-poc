import { io } from "socket.io-client";

const serverUrl = import.meta.env.DEV ? "http://localhost:3000" : undefined;

export const socket = io(serverUrl, {
  autoConnect: false,
});
