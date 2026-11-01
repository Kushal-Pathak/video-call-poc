import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";
import { socket } from "./socket";

function Home() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const createRoom = () => {
    const newRoomId = crypto.randomUUID().slice(0, 8);

    navigate(`/room/${newRoomId}`);
  };

  const joinRoom = () => {
    const trimmedRoomId = roomId.trim();

    if (!trimmedRoomId) {
      return;
    }

    navigate(`/room/${trimmedRoomId}`);
  };

  return (
    <main>
      <h1>Video Call POC</h1>

      <button onClick={createRoom}>Create Room</button>

      <hr />

      <input
        value={roomId}
        onChange={(event) => setRoomId(event.target.value)}
        placeholder="Enter room ID"
      />

      <button onClick={joinRoom}>Join Room</button>
    </main>
  );
}

function Room() {
  const { roomId } = useParams();

  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const handleConnect = () => {
      setStatus("Connected to server");

      socket.emit("join-room", roomId);
    };

    const handleRoomJoined = ({
      participantCount,
    }: {
      participantCount: number;
    }) => {
      if (participantCount === 2) {
        setStatus("Peer joined");
        return;
      }

      setStatus("Waiting for another participant...");
    };

    const handlePeerJoined = () => {
      setStatus("Peer joined");
    };

    const handleRoomFull = () => {
      setStatus("Room is full");
    };

    socket.on("connect", handleConnect);
    socket.on("room-joined", handleRoomJoined);
    socket.on("peer-joined", handlePeerJoined);
    socket.on("room-full", handleRoomFull);

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("room-joined", handleRoomJoined);
      socket.off("peer-joined", handlePeerJoined);
      socket.off("room-full", handleRoomFull);

      socket.disconnect();
    };
  }, [roomId]);

  return (
    <main>
      <h1>Video Call</h1>

      <p>Room ID: {roomId}</p>

      <p>Status: {status}</p>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
