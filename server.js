const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
    cors: { origin: "*" } 
});

// 🛡️ Security: Protect backend source code from direct download
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'manifest.json')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.use('/icons', express.static(path.join(__dirname, 'icons')));

io.on('connection', (socket) => {
    console.log('🌍 WebRTC Node Connected:', socket.id);

    // Initial Handshake broadcast to find peer
    socket.on('global_secure_ping', (data) => {
        if (!data || !data.targetId) return;
        socket.broadcast.emit('global_incoming_ping', data);
    });

    // Explicit Room Join: Restrict strictly to 2 peers per tunnel
    socket.on('join_tunnel', (roomId) => {
        if (!roomId) return;

        const currentRoom = io.sockets.adapter.rooms.get(roomId);
        const numClients = currentRoom ? currentRoom.size : 0;

        if (numClients >= 2) {
            socket.emit('tunnel_error', 'Room is full (Max 2 peers permitted)');
            return;
        }

        socket.join(roomId);
        socket.roomId = roomId;

        console.log(`Node ${socket.id} joined room: ${roomId} (${numClients + 1}/2)`);

        // If 2 peers are now present, notify them to begin WebRTC handshake
        if (numClients === 1) {
            io.to(roomId).emit('peers_synchronized', { roomId });
        }
    });

    // Targeted WebRTC Signaling (Zero Leakage outside Room)
    socket.on('webrtc_signaling', (data) => {
        if (!data || !data.roomId) return;
        socket.to(data.roomId).emit('webrtc_signaling', data);
    });

    // Clean disconnect notification
    socket.on('disconnect', () => {
        console.log('❌ Node disconnected:', socket.id);
        if (socket.roomId) {
            socket.to(socket.roomId).emit('webrtc_signaling', { 
                type: 'peer_disconnected', 
                roomId: socket.roomId 
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 WebRTC Signaling Engine Online on Port: ${PORT}`));
