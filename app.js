const socket = io(window.location.origin); 
let activePrime = null;
let isInitiator = false;

// The Pro WebRTC Variables
let peerConnection;
let dataChannel;
let localStream;
const iceConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function runSHA256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 1. Handshake Logic
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

async function verifyPrimeConnect() {
    const userInputPrime = document.getElementById('prime-input').value;
    let userInputKey = document.getElementById('secret-key')?.value || prompt("🔒 Enter Pre-Shared Private Key:");

    if(!userInputKey) return alert("Key required for P2P network!");
    if(parseInt(userInputPrime) !== activePrime) return alert("Security Handshake Failed!");

    document.getElementById('screen-handshake').classList.add('hidden');
    document.getElementById('screen-chat').classList.remove('hidden');
    
    initWebRTC();
}

// 2. The "Perfect Negotiation" Engine
function initWebRTC() {
    peerConnection = new RTCPeerConnection(iceConfiguration);

    // Track Incoming Video/Audio
    peerConnection.ontrack = (event) => {
        document.getElementById('video-container').classList.remove('hidden');
        document.getElementById('remote-video').srcObject = event.streams[0];
    };

    // Auto-Exchange ICE Paths
    peerConnection.onicecandidate = (event) => {
        if(event.candidate) socket.emit('webrtc_signaling', { type: 'ice', candidate: event.candidate });
    };

    // Advanced Renegotiation Logic
    peerConnection.onnegotiationneeded = async () => {
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('webrtc_signaling', { type: 'offer', offer: peerConnection.localDescription });
        } catch (err) { console.error("Negotiation Error:", err); }
    };

    // Setup Text/File Data Channel
    if(isInitiator) {
        dataChannel = peerConnection.createDataChannel('cryptoTunnel');
        setupDataChannel();
    } else {
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel();
        };
    }
}

// Auto-Signaling Listener
socket.on('webrtc_signaling', async (data) => {
    if(!peerConnection) return;
    try {
        if(data.type === 'offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('webrtc_signaling', { type: 'answer', answer: peerConnection.localDescription });
        } else if(data.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if(data.type === 'ice') {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    } catch(err) { console.error(err); }
});

// 3. 🚀 HIGH-END CALLING SYSTEM
async function startCall(videoEnabled) {
    try {
        const constraints = {
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: videoEnabled ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false
        };

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        document.getElementById('video-container').classList.remove('hidden');
        document.getElementById('local-video').srcObject = localStream;

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        appendMsg(`Outgoing ${videoEnabled ? 'Video' : 'Voice'} Call started...`, 'system-msg');
    } catch (error) {
        alert("Camera/Mic access denied by browser!");
    }
}

function endCall() {
    if(localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    document.getElementById('video-container').classList.add('hidden');
    appendMsg("Call ended.", 'system-msg');
}

// 4. DataChannel Chat & Files (With Image Click to Zoom)
function setupDataChannel() {
    dataChannel.onopen = () => appendMsg("🌐 Secure E2EE Tunnel Active!", 'system-msg');
    dataChannel.onmessage = (event) => handleIncomingData(event.data);
}

function sendMessage() {
    if(!dataChannel || dataChannel.readyState !== 'open') return;
    const input = document.getElementById('msg-input');
    const fileInput = document.getElementById('file-upload');
    const msgText = input.value.trim();

    if(fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            const base64Data = reader.result;
            dataChannel.send(JSON.stringify({ type: 'file-meta', fileType: file.type }));
            const chunkSize = 16384; 
            for (let i = 0; i < base64Data.length; i += chunkSize) {
                dataChannel.send(JSON.stringify({ type: 'file-chunk', data: base64Data.slice(i, i + chunkSize) }));
            }
            dataChannel.send(JSON.stringify({ type: 'file-end' }));
            displayMedia(base64Data, file.type, 'sent-msg');
        };
        reader.readAsDataURL(file);
        fileInput.value = ''; 
    }

    if(msgText) {
        appendMsg(msgText, 'sent-msg');
        dataChannel.send(JSON.stringify({ type: 'text', text: msgText }));
        input.value = '';
    }
}

let incomingBuffer = "";
let incomingMeta = null;

function handleIncomingData(rawData) {
    const parsed = JSON.parse(rawData);
    if(parsed.type === 'text') {
        appendMsg(parsed.text, 'recv-msg');
    } else if (parsed.type === 'file-meta') {
        incomingMeta = parsed;
        incomingBuffer = ""; 
    } else if (parsed.type === 'file-chunk') {
        incomingBuffer += parsed.data; 
    } else if (parsed.type === 'file-end') {
        displayMedia(incomingBuffer, incomingMeta.fileType, 'recv-msg');
    }
}

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
        div.innerHTML = `<img src="${base64Data}" class="media-content" onclick="openModal('${base64Data}')">`;
    } else if(mimeType.startsWith('video/')) {
        div.innerHTML = `<video src="${base64Data}" controls class="media-content"></video>`;
    }
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
}

function openModal(imageSrc) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    if(modal) { modal.classList.remove('hidden'); modalImg.src = imageSrc; }
}
function closeModal() { document.getElementById('image-modal').classList.add('hidden'); }
function checkEnter(e) { if(e.key === 'Enter') sendMessage(); }
function triggerKillSwitch() { setTimeout(() => { location.reload(); }, 500); }