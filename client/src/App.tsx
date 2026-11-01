import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";

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

  return (
    <main>
      <h1>Room</h1>

      <p>Room ID: {roomId}</p>

      <p>Video call will appear here.</p>
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
