import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "node:path";

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const PORT = Number(process.env.PORT) || 3000;

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

const clientDistPath = path.resolve(__dirname, "../../client/dist");

app.use(express.static(clientDistPath));

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });

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

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        socket.to(roomId).emit("peer-left");
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

app.use((_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
