import { useState, useEffect, useRef } from "react";
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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [status, setStatus] = useState("Connecting...");

  const [mediaError, setMediaError] = useState("");

  useEffect(() => {
    if (!roomId) {
      return;
    }

    let localStream: MediaStream | null = null;
    let peerConnection: RTCPeerConnection | null = null;
    let cancelled = false;

    const pendingCandidates: RTCIceCandidateInit[] = [];

    const createPeerConnection = () => {
      if (peerConnection) {
        return peerConnection;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.cloudflare.com:3478",
          },
        ],
      });

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream!);
        });
      }

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;

        if (remoteVideoRef.current && remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }

        socket.emit("ice-candidate", {
          roomId,
          candidate: event.candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        console.log("WebRTC connection state:", pc.connectionState);

        if (pc.connectionState === "connected") {
          setStatus("Connected");
        }
      };

      peerConnection = pc;

      return pc;
    };

    const addPendingCandidates = async (pc: RTCPeerConnection) => {
      while (pendingCandidates.length > 0) {
        const candidate = pendingCandidates.shift();

        if (candidate) {
          await pc.addIceCandidate(candidate);
        }
      }
    };

    const handleConnect = () => {
      socket.emit("join-room", roomId);
    };

    const handleRoomJoined = ({
      participantCount,
    }: {
      participantCount: number;
    }) => {
      if (participantCount === 2) {
        setStatus("Connecting to peer...");
        return;
      }

      setStatus("Waiting for another participant...");
    };

    const handlePeerJoined = async () => {
      try {
        setStatus("Connecting to peer...");

        const pc = createPeerConnection();

        const offer = await pc.createOffer();

        await pc.setLocalDescription(offer);

        socket.emit("offer", {
          roomId,
          offer: pc.localDescription,
        });
      } catch (error) {
        console.error("Failed to create offer", error);
      }
    };

    const handleOffer = async (offer: RTCSessionDescriptionInit) => {
      try {
        const pc = createPeerConnection();

        await pc.setRemoteDescription(offer);

        await addPendingCandidates(pc);

        const answer = await pc.createAnswer();

        await pc.setLocalDescription(answer);

        socket.emit("answer", {
          roomId,
          answer: pc.localDescription,
        });
      } catch (error) {
        console.error("Failed to handle offer", error);
      }
    };

    const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
      try {
        if (!peerConnection) {
          return;
        }

        await peerConnection.setRemoteDescription(answer);

        await addPendingCandidates(peerConnection);
      } catch (error) {
        console.error("Failed to handle answer", error);
      }
    };

    const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
      try {
        const pc = createPeerConnection();

        if (pc.remoteDescription) {
          await pc.addIceCandidate(candidate);
          return;
        }

        pendingCandidates.push(candidate);
      } catch (error) {
        console.error("Failed to add ICE candidate", error);
      }
    };

    const handleRoomFull = () => {
      setStatus("Room is full");
    };

    socket.on("connect", handleConnect);
    socket.on("room-joined", handleRoomJoined);
    socket.on("peer-joined", handlePeerJoined);

    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);

    socket.on("room-full", handleRoomFull);

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => {
            track.stop();
          });

          return;
        }

        localStream = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        socket.connect();
      } catch (error) {
        console.error("Failed to access media", error);

        setMediaError("Unable to access camera or microphone.");
      }
    };

    start();

    return () => {
      cancelled = true;

      peerConnection?.close();

      localStream?.getTracks().forEach((track) => {
        track.stop();
      });

      socket.off("connect", handleConnect);
      socket.off("room-joined", handleRoomJoined);
      socket.off("peer-joined", handlePeerJoined);

      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);

      socket.off("room-full", handleRoomFull);

      socket.disconnect();
    };
  }, [roomId]);

  return (
    <main>
      <h1>Video Call</h1>

      <p>Room ID: {roomId}</p>

      <p>Status: {status}</p>

      {mediaError && <p>{mediaError}</p>}

      <h2>You</h2>

      <video ref={localVideoRef} autoPlay muted playsInline />

      <h2>Remote participant</h2>

      <video ref={remoteVideoRef} autoPlay playsInline />
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
