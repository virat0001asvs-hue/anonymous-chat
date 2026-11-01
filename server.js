const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
    cors: { origin: "*" } 
});

// ✅ Serve index.html safely
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ✅ Safe static assets (PWA / Manifest)
app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'manifest.json'), err => {
        if (err) res.status(404).end();
    });
});

app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'sw.js'), err => {
        if (err) res.status(404).end();
    });
});

// Room state tracker for Prime synchronization and Peer readiness
const activeRooms = new Map();

io.on('connection', (socket) => {
    console.log('🌍 WebRTC Node Connected:', socket.id);

    // Initial Room Registration & Prime Sync
    socket.on('global_secure_ping', (data) => {
        if (!data || !data.targetId) return;
        const roomId = data.targetId.trim();

        const existingRoomSockets = io.sockets.adapter.rooms.get(roomId);
        const hasActivePeers = existingRoomSockets && existingRoomSockets.size > 0;

        socket.join(roomId);
        socket.roomId = roomId;

        if (!activeRooms.has(roomId) || !hasActivePeers) {
            activeRooms.set(roomId, {
                prime: data.prime,
                readyPeers: new Set()
            });
        }

        const roomState = activeRooms.get(roomId);

        // Broadcast active prime so both peers always see the exact same Prime token
        io.emit('global_incoming_ping', {
            targetId: roomId,
            prime: roomState.prime
        });
    });

    // Room Join helper
    socket.on('join_room', (roomId) => {
        if (!roomId) return;
        socket.join(roomId);
        socket.roomId = roomId;
    });

    // Targeted WebRTC Signaling (Zero Cross-Talk)
    socket.on('webrtc_signaling', (data) => {
        if (!data || !data.roomId) return;
        const roomId = data.roomId.trim();

        if (!socket.roomId) {
            socket.join(roomId);
            socket.roomId = roomId;
        }

        if (data.type === 'peer_ready') {
            if (!activeRooms.has(roomId)) {
                activeRooms.set(roomId, {
                    prime: null,
                    readyPeers: new Set()
                });
            }
            const roomState = activeRooms.get(roomId);
            roomState.readyPeers.add(socket.id);

            // Jaise hi dono peers Prime confirm karke ready hon, handshake start karein
            if (roomState.readyPeers.size >= 2) {
                const readyList = Array.from(roomState.readyPeers);
                const initiatorId = readyList[0];

                io.to(roomId).emit('webrtc_signaling', {
                    type: 'both_peers_ready',
                    roomId: roomId,
                    initiatorId: initiatorId
                });
            }
            return;
        }

        // Send exclusively to other peers in the room
        socket.to(roomId).emit('webrtc_signaling', data);
    });

    socket.on('disconnect', () => {
        console.log('❌ Node disconnected:', socket.id);
        if (socket.roomId) {
            const roomId = socket.roomId;
            const roomState = activeRooms.get(roomId);
            if (roomState) {
                roomState.readyPeers.delete(socket.id);
                const remainingSockets = io.sockets.adapter.rooms.get(roomId);
                if (!remainingSockets || remainingSockets.size === 0) {
                    activeRooms.delete(roomId);
                }
            }

            socket.to(roomId).emit('webrtc_signaling', { 
                type: 'peer_disconnected', 
                roomId: roomId 
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 WebRTC Signaling Engine Online on Port: ${PORT}`));
