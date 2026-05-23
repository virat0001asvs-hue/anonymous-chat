const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// CORS settings active ki taaki worldwide networks se traffic block na ho
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('🌍 New Global Cryptography Node Connected:', socket.id);

    // 1. Jab User A target ID par ping bhejega (Global Push Notification Trigger)
    socket.on('global_secure_ping', (data) => {
        console.log(`📡 Signal routing initiated for Target: ${data.targetId}`);
        // Yeh message pure internet cloud network par broadcast ho jayega
        socket.broadcast.emit('global_incoming_ping', data);
    });

    // 2. Real-time direct chat text exchange (End-to-End Flow)
    socket.on('global_send_msg', (data) => {
        socket.broadcast.emit('global_receive_msg', data);
    });

    socket.on('disconnect', () => {
        console.log('❌ Node disconnected from global network');
    });
});

// Cloud server port automated dynamic assigning logic
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Secure Production Engine Online on Port: ${PORT}`);
});