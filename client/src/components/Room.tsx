import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { socket } from "../socket";

function Room() {
  const { roomId } = useParams();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const navigate = useNavigate();

  const localStreamRef = useRef<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const [isMuted, setIsMuted] = useState(false);

  const [isCameraOff, setIsCameraOff] = useState(false);

  const [status, setStatus] = useState("Connecting...");

  const [mediaError, setMediaError] = useState("");

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    let cancelled = false;

    const pendingCandidates: RTCIceCandidateInit[] = [];

    const createPeerConnection = () => {
      if (peerConnectionRef.current) {
        return peerConnectionRef.current;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.cloudflare.com:3478",
          },
        ],
      });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
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

      peerConnectionRef.current = pc;

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
        const pc = peerConnectionRef.current;

        if (!pc) {
          return;
        }

        await pc.setRemoteDescription(answer);

        await addPendingCandidates(pc);
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

    const handlePeerLeft = () => {
      setStatus("Peer left");

      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };

    socket.on("connect", handleConnect);
    socket.on("room-joined", handleRoomJoined);
    socket.on("peer-joined", handlePeerJoined);

    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);

    socket.on("peer-left", handlePeerLeft);

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

        localStreamRef.current = stream;

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

      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;

      localStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      localStreamRef.current = null;

      socket.off("connect", handleConnect);
      socket.off("room-joined", handleRoomJoined);
      socket.off("peer-joined", handlePeerJoined);

      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);

      socket.off("room-full", handleRoomFull);

      socket.off("peer-left", handlePeerLeft);

      socket.disconnect();
    };
  }, [roomId]);

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];

    if (!audioTrack) {
      return;
    }

    audioTrack.enabled = !audioTrack.enabled;

    setIsMuted(!audioTrack.enabled);
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];

    if (!videoTrack) {
      return;
    }

    videoTrack.enabled = !videoTrack.enabled;

    setIsCameraOff(!videoTrack.enabled);
  };

  const leaveCall = () => {
    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    peerConnectionRef.current?.close();

    socket.disconnect();

    navigate("/");
  };

  const copyRoomId = async () => {
    if (!roomId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(roomId);

      setCopied(true);

      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy room ID", error);
    }
  };

  const statusTone =
    status === "Connected"
      ? "is-ok"
      : status === "Room is full" || status === "Peer left"
        ? "is-warn"
        : "";

  return (
    <main className="room">
      <header className="room-header">
        <h1>
          <Link to="/" className="room-brand" title="Back to home">
            Video Call
          </Link>
        </h1>

        <div className="room-meta">
          <button
            type="button"
            className={`room-id ${copied ? "is-copied" : ""}`}
            onClick={copyRoomId}
            title="Copy room ID"
            aria-label={copied ? "Room ID copied" : "Copy room ID"}
          >
            <span>{roomId}</span>
            {copied ? (
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  d="M20 6 9 17l-5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <rect
                  x="9"
                  y="9"
                  width="11"
                  height="11"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M5 15V5a2 2 0 0 1 2-2h10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
            <span className="room-id-hint">{copied ? "Copied" : "Copy"}</span>
          </button>
          <span className={`room-status ${statusTone}`}>{status}</span>
        </div>
      </header>

      {mediaError && <p className="room-error">{mediaError}</p>}

      <section className="room-videos">
        <div className="video-tile">
          <video ref={localVideoRef} autoPlay muted playsInline />
          <span className="video-label">You</span>
        </div>

        <div className="video-tile">
          <video ref={remoteVideoRef} autoPlay playsInline />
          <span className="video-label">Remote participant</span>
        </div>
      </section>

      <div className="room-controls">
        <button
          className={isMuted ? "btn-active" : ""}
          onClick={toggleMute}
          aria-pressed={isMuted}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-6 0v.6M19 11a7 7 0 0 1-1.6 4.5M5 11a7 7 0 0 0 11.3 5.6M12 18v3M3 3l18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M12 15a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v7a3 3 0 0 0 3 3ZM19 11a7 7 0 0 1-14 0M12 18v3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span>{isMuted ? "Unmute" : "Mute"}</span>
        </button>

        <button
          className={isCameraOff ? "btn-active" : ""}
          onClick={toggleCamera}
          aria-pressed={isCameraOff}
          aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
        >
          {isCameraOff ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M16 16v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m4 0h4a2 2 0 0 1 2 2v2l6-3v10l-2-1M3 3l18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M16 9l6-3v12l-6-3M2 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span>{isCameraOff ? "Turn Camera On" : "Turn Camera Off"}</span>
        </button>

        <button
          className="btn-danger"
          onClick={leaveCall}
          aria-label="Leave call"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M3 12.5c5.5-5 12.5-5 18 0l-1.6 2.6a1.5 1.5 0 0 1-1.9.5l-2.6-1.3a1.5 1.5 0 0 1-.8-1.6l.2-1.4a10 10 0 0 0-4.6 0l.2 1.4a1.5 1.5 0 0 1-.8 1.6l-2.6 1.3a1.5 1.5 0 0 1-1.9-.5Z"
              fill="currentColor"
            />
          </svg>
          <span>Leave Call</span>
        </button>
      </div>
    </main>
  );
}

export default Room;
