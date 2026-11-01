import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

  const statusTone =
    status === "Connected"
      ? "is-ok"
      : status === "Room is full" || status === "Peer left"
        ? "is-warn"
        : "";

  return (
    <main className="room">
      <header className="room-header">
        <h1>Video Call</h1>

        <div className="room-meta">
          <span className="room-id">{roomId}</span>
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
        >
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <button
          className={isCameraOff ? "btn-active" : ""}
          onClick={toggleCamera}
        >
          {isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
        </button>

        <button className="btn-danger" onClick={leaveCall}>
          Leave Call
        </button>
      </div>
    </main>
  );
}

export default Room;
