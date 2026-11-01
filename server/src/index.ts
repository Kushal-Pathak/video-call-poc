import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const PORT = 3000;

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("join-room", (roomId: string) => {
    const room = io.sockets.adapter.rooms.get(roomId);

    const participantCount = room?.size ?? 0;

    if (participantCount >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomId);

    console.log(`${socket.id} joined room ${roomId}`);

    socket.emit("room-joined", {
      roomId,
      participantCount: participantCount + 1,
    });

    if (participantCount === 1) {
      socket.to(roomId).emit("peer-joined");
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
