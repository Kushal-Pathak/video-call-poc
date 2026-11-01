import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
    <main className="home">
      <div className="home-card">
        <h1>Video Call</h1>

        <p className="home-subtitle">Start a new call or join an existing one.</p>

        <button className="btn-primary" onClick={createRoom}>
          Create Room
        </button>

        <div className="home-divider">or</div>

        <div className="home-join">
          <input
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && joinRoom()}
            placeholder="Enter room ID"
            aria-label="Room ID"
          />

          <button onClick={joinRoom}>Join Room</button>
        </div>
      </div>
    </main>
  );
}

export default Home;
