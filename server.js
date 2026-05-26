const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('🌍 WebRTC Node Connected:', socket.id);

    // Initial Handshake Signal
    socket.on('global_secure_ping', (data) => {
        socket.broadcast.emit('global_incoming_ping', data);
    });

    // WebRTC P2P Signaling (Zero Message Logging)
    socket.on('webrtc_signaling', (data) => {
        socket.broadcast.emit('webrtc_signaling', data);
    });

    socket.on('disconnect', () => console.log('❌ Node disconnected'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 WebRTC Signaling Engine Online on Port: ${PORT}`));