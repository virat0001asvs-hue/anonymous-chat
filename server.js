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

// Room-based isolated signaling
io.on('connection', (socket) => {
    console.log('🌍 WebRTC Node Connected:', socket.id);

    // Initial Room Registration / Ping
    socket.on('global_secure_ping', (data) => {
        if (!data || !data.targetId) return;
        
        socket.join(data.targetId);
        socket.roomId = data.targetId;
        
        // Broadcast ping to all peers searching for this target ID
        socket.broadcast.emit('global_incoming_ping', data);
    });

    // Client confirms readiness in the room
    socket.on('join_room', (roomId) => {
        if (!roomId) return;
        socket.join(roomId);
        socket.roomId = roomId;
    });

    // Targeted WebRTC Signaling (Zero Cross-Talk)
    socket.on('webrtc_signaling', (data) => {
        if (!data || !data.roomId) return;
        
        if (!socket.roomId) {
            socket.join(data.roomId);
            socket.roomId = data.roomId;
        }

        // Send exclusively to other peers in the room
        socket.to(data.roomId).emit('webrtc_signaling', data);
    });

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
