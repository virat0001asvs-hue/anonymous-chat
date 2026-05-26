const socket = io(window.location.origin); 
let activePrime = null;
let isInitiator = false;

// WebRTC Core Variables
let peerConnection;
let dataChannel;
const iceConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function runSHA256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 1. Initial Handshake Ping
function sendSecurePing() {
    isInitiator = true;
    const targetId = document.getElementById('phone-number').value.trim();
    if(!targetId) return alert("Bhai, Target ID dalo!");

    activePrime = [982451653, 15485863, 32416190071][Math.floor(Math.random() * 3)];
    socket.emit('global_secure_ping', { prime: activePrime, targetId: targetId });

    document.getElementById('screen-auth').classList.add('hidden');
    document.getElementById('screen-handshake').classList.remove('hidden');
    document.getElementById('display-prime').innerText = activePrime;
}

socket.on('global_incoming_ping', (data) => {
    activePrime = data.prime;
    document.getElementById('screen-auth').classList.add('hidden');
    document.getElementById('screen-handshake').classList.remove('hidden');
    document.getElementById('display-prime').innerText = data.prime;
});

// 2. WebRTC Setup after Password Verification
async function verifyPrimeAndConnect() {
    const userInputPrime = document.getElementById('prime-input').value;
    let userInputKey = document.getElementById('secret-key')?.value || prompt("🔒 Enter Pre-Shared Private Key:");

    if(!userInputKey) return alert("Key required for P2P network!");
    if(parseInt(userInputPrime) !== activePrime) return alert("Security Handshake Failed!");

    document.getElementById('screen-handshake').classList.add('hidden');
    document.getElementById('screen-chat').classList.remove('hidden');
    
    // Initialize P2P Network
    initWebRTC();
}

// 3. WebRTC Engine & Signaling
function initWebRTC() {
    peerConnection = new RTCPeerConnection(iceConfiguration);

    // Send Network Paths (ICE) to peer via Server
    peerConnection.onicecandidate = (event) => {
        if(event.candidate) socket.emit('webrtc_signaling', { type: 'ice', candidate: event.candidate });
    };

    if(isInitiator) {
        dataChannel = peerConnection.createDataChannel('cryptoTunnel');
        setupDataChannel();
        peerConnection.createOffer().then(offer => {
            peerConnection.setLocalDescription(offer);
            socket.emit('webrtc_signaling', { type: 'offer', offer: offer });
        });
    } else {
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel();
        };
    }
}

// Global Signaling Catchers
socket.on('webrtc_signaling', async (data) => {
    if(!peerConnection) return;
    if(data.type === 'offer' && !isInitiator) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('webrtc_signaling', { type: 'answer', answer: answer });
    } else if(data.type === 'answer' && isInitiator) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if(data.type === 'ice') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

// 4. DataChannel Operations (Text + Media Chunking)
function setupDataChannel() {
    dataChannel.onopen = () => appendMsg("🌐 WebRTC P2P Direct Tunnel Linked!", 'system-msg');
    dataChannel.onmessage = (event) => handleIncomingData(event.data);
}

function sendMessage() {
    if(!dataChannel || dataChannel.readyState !== 'open') return alert("Waiting for P2P network connection...");

    const input = document.getElementById('msg-input');
    const fileInput = document.getElementById('file-upload');
    const msgText = input.value.trim();

    // File Processing (Chunking for large media)
    if(fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = () => {
            const base64Data = reader.result;
            // Send Metadata Header
            dataChannel.send(JSON.stringify({ type: 'file-meta', fileType: file.type }));
            
            // Send Data in 16KB Chunks so Browser memory doesn't crash
            const chunkSize = 16384; 
            for (let i = 0; i < base64Data.length; i += chunkSize) {
                dataChannel.send(JSON.stringify({ type: 'file-chunk', data: base64Data.slice(i, i + chunkSize) }));
            }
            // Send End Footer
            dataChannel.send(JSON.stringify({ type: 'file-end' }));
            
            displayMedia(base64Data, file.type, 'sent-msg');
        };
        reader.readAsDataURL(file);
        fileInput.value = ''; // Reset
    }

    // Text Processing
    if(msgText) {
        appendMsg(msgText, 'sent-msg');
        dataChannel.send(JSON.stringify({ type: 'text', text: msgText }));
        input.value = '';
    }
}

// Media Reconstruction Buffer
let incomingBuffer = "";
let incomingMeta = null;

function handleIncomingData(rawData) {
    const parsed = JSON.parse(rawData);
    
    if(parsed.type === 'text') {
        appendMsg(parsed.text, 'recv-msg');
    } else if (parsed.type === 'file-meta') {
        incomingMeta = parsed;
        incomingBuffer = ""; // Clear buffer
    } else if (parsed.type === 'file-chunk') {
        incomingBuffer += parsed.data; // Rebuild file
    } else if (parsed.type === 'file-end') {
        displayMedia(incomingBuffer, incomingMeta.fileType, 'recv-msg');
    }
}

// Dynamic UI Renderers
function appendMsg(text, type) {
    const logs = document.getElementById('chat-logs');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerText = text;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
}

function displayMedia(base64Data, mimeType, type) {
    const logs = document.getElementById('chat-logs');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    
    if(mimeType.startsWith('image/')) {
        div.innerHTML = `<img src="${base64Data}" class="media-content">`;
    } else if(mimeType.startsWith('video/')) {
        div.innerHTML = `<video src="${base64Data}" controls class="media-content"></video>`;
    }
    
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
}

function checkEnter(e) { if(e.key === 'Enter') sendMessage(); }
function triggerKillSwitch() { setTimeout(() => { location.reload(); }, 500); }