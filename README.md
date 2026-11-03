# Video Call POC

A minimal two-person video calling application built with React, TypeScript, Node.js, Express, Socket.IO, and WebRTC.

## Live Demo

https://video-call-poc-qovo.onrender.com/

## Features

- Create a room with a unique room ID
- Join an existing room using the room ID
- Maximum two participants per room
- Peer-to-peer video and audio calling
- Mute / unmute microphone
- Turn camera on / off
- Leave call
- Detect when the other participant leaves
- STUN and TURN support for NAT/firewall traversal

## Architecture

```text
Browser A                    Browser B
   │                            │
   │       Socket.IO            │
   └──────────┐      ┌──────────┘
              ▼      ▼
          Node.js Server
          Express + Socket.IO
                │
          Signaling only
                │
       Offer / Answer / ICE
                │
Browser A  <==== WebRTC ====>  Browser B
                │
          Direct connection
                │
        TURN fallback if needed
```

The Node.js server is used only for signaling and room coordination. Audio and video are transmitted directly between peers using WebRTC whenever possible.

## Tech Stack

- React
- TypeScript
- Vite
- Node.js
- Express
- Socket.IO
- WebRTC
- STUN / TURN
- Render

## How It Works

1. A user creates or joins a room.
2. Socket.IO places both participants in the same room.
3. The first peer creates a WebRTC offer.
4. The second peer returns an answer.
5. ICE candidates are exchanged through the signaling server.
6. WebRTC establishes the media connection.
7. TURN is used as a fallback when a direct peer-to-peer connection is not possible.

## Run Locally

### Server

```bash
cd server
npm install
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Production Build

```bash
cd client
npm install
npm run build

cd ../server
npm install
npm run build
npm start
```

The Express server serves both the React application and Socket.IO in production.

## Limitations

- Supports only two participants per room
- Rooms are stored in memory and are not persisted
- No authentication or user accounts
- TURN usage depends on the configured TURN provider
- Designed as a proof of concept, not a production conferencing platform
