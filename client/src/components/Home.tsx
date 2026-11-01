import { useState } from "react";
import { useNavigate } from "react-router-dom";

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;

function Home() {
  const [roomId, setRoomId] = useState("");
  const [customRoomId, setCustomRoomId] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customError, setCustomError] = useState("");
  const navigate = useNavigate();

  const createRoom = () => {
    const newRoomId = crypto.randomUUID().slice(0, 8);

    navigate(`/room/${newRoomId}`);
  };

  const createCustomRoom = () => {
    const trimmed = customRoomId.trim();

    if (!trimmed) {
      setCustomError("Enter a room ID.");
      return;
    }

    if (!ROOM_ID_PATTERN.test(trimmed)) {
      setCustomError(
        "Use 3 to 32 letters, numbers, hyphens or underscores.",
      );
      return;
    }

    navigate(`/room/${trimmed}`);
  };

  const joinRoom = () => {
    const trimmedRoomId = roomId.trim();

    if (!trimmedRoomId) {
      return;
    }

    navigate(`/room/${trimmedRoomId}`);
  };

  const pasteRoomId = async () => {
    try {
      const text = await navigator.clipboard.readText();

      const trimmed = text.trim();

      if (!trimmed) {
        return;
      }

      setRoomId(trimmed);
    } catch (error) {
      console.error("Failed to read clipboard", error);
    }
  };

  return (
    <main className="home">
      <div className="home-card">
        <h1>Video Call</h1>

        <p className="home-subtitle">Start a new call or join an existing one.</p>

        <button className="btn-primary" onClick={createRoom}>
          Create Room
        </button>

        <button
          type="button"
          className="home-link"
          onClick={() => setShowCustom((value) => !value)}
          aria-expanded={showCustom}
        >
          {showCustom ? "Hide custom room ID" : "Use a custom room ID"}
        </button>

        {showCustom && (
          <div className="home-custom">
            <div className="home-join">
              <input
                value={customRoomId}
                onChange={(event) => {
                  setCustomRoomId(event.target.value);
                  setCustomError("");
                }}
                onKeyDown={(event) =>
                  event.key === "Enter" && createCustomRoom()
                }
                placeholder="e.g. team-standup"
                aria-label="Custom room ID"
                aria-invalid={Boolean(customError)}
                autoFocus
              />

              <button onClick={createCustomRoom}>Create</button>
            </div>

            {customError && <p className="home-error">{customError}</p>}
          </div>
        )}

        <div className="home-divider">or</div>

        <div className="home-join">
          <div className="home-input">
            <input
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && joinRoom()}
              placeholder="Enter room ID"
              aria-label="Room ID"
            />

            <button
              type="button"
              className="home-paste"
              onClick={pasteRoomId}
              title="Paste room ID"
              aria-label="Paste room ID from clipboard"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M9 4h6M9 4a1 1 0 0 0-1 1v1h8V5a1 1 0 0 0-1-1M8 6H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <button onClick={joinRoom}>Join Room</button>
        </div>
      </div>
    </main>
  );
}

export default Home;
