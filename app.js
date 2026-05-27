const socket = io(window.location.origin); 
let activePrime = null, isInitiator = false;
let peerConnection, dataChannel, localStream, currentCallType = null; 

// Elite Google STUN Servers
const iceConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

function sendSecurePing() {
    isInitiator = true;
    const targetId = document.getElementById('phone-number').value.trim();
    if(!targetId) return alert("Target ID required!");

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
    let userInputKey = document.getElementById('secret-key')?.value || prompt("🔒 Enter Private Key:");

    if(!userInputKey || parseInt(userInputPrime) !== activePrime) return alert("Handshake Failed!");

    document.getElementById('screen-handshake').classList.add('hidden');
    document.getElementById('screen-chat').classList.remove('hidden');
    initWebRTC();
}

// 🧠 PERFECT NEGOTIATION ENGINE
function initWebRTC() {
    peerConnection = new RTCPeerConnection(iceConfiguration);

    // Render incoming video instantly when track arrives
    peerConnection.ontrack = (event) => {
        document.getElementById('remote-video').srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if(event.candidate) socket.emit('webrtc_signaling', { type: 'ice', candidate: event.candidate });
    };

    // The heart of auto-sync: Automatically sends offer if camera track is added
    peerConnection.onnegotiationneeded = async () => {
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('webrtc_signaling', { type: 'offer', offer: peerConnection.localDescription });
        } catch (err) { console.error(err); }
    };

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

// SIGNALING ROUTER
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
        // 📞 CALL LOGIC FIX
        else if(data.type === 'call_request') {
            currentCallType = data.callType;
            document.getElementById('call-title').innerText = `Incoming ${data.callType ? 'Video' : 'Voice'} Call...`;
            document.getElementById('incoming-call-modal').classList.remove('hidden');
        } else if(data.type === 'call_accepted') {
            appendMsg("Call Connected.", "system-msg");
            // If caller hasn't started media yet, start it now
            if(!localStream) await startMedia(currentCallType);
        } else if(data.type === 'call_rejected') {
            appendMsg("Call Declined.", "system-msg");
        } else if(data.type === 'call_ended') {
            stopMedia();
            appendMsg("Call Ended by peer.", "system-msg");
        }
    } catch(err) { console.error(err); }
});

// 🎥 HARDWARE & BATTERY OPTIMIZATION
async function requestCall(videoEnabled) {
    currentCallType = videoEnabled;
    appendMsg(`Calling ${videoEnabled ? 'Video' : 'Voice'}...`, "system-msg");
    socket.emit('webrtc_signaling', { type: 'call_request', callType: videoEnabled });
}

// The Fix: Turn on camera BEFORE telling the other person we accepted
async function acceptCall() {
    document.getElementById('incoming-call-modal').classList.add('hidden');
    const success = await startMedia(currentCallType);
    if(success) socket.emit('webrtc_signaling', { type: 'call_accepted' });
}

function rejectCall() {
    document.getElementById('incoming-call-modal').classList.add('hidden');
    socket.emit('webrtc_signaling', { type: 'call_rejected' });
}

async function startMedia(videoEnabled) {
    try {
        // Elite Battery Save: 24 FPS, 480p/720p scaling, hardware echo cancellation
        const constraints = {
            audio: { echoCancellation: true, noiseSuppression: true },
            video: videoEnabled ? { facingMode: 'user', width: { ideal: 720 }, frameRate: { ideal: 24 } } : false
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('video-container').classList.remove('hidden');
        document.getElementById('local-video').srcObject = localStream;

        // Adding tracks triggers `onnegotiationneeded` automatically!
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        return true;
    } catch (err) { 
        alert("Camera/Mic Permission Denied!"); 
        return false;
    }
}

function stopMedia() {
    if(localStream) localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    document.getElementById('video-container').classList.add('hidden');
}

function endCall() {
    stopMedia();
    socket.emit('webrtc_signaling', { type: 'call_ended' });
    appendMsg("Call Ended.", 'system-msg');
}

// 👆 ELITE GPU DRAG LOGIC FOR PIP VIDEO
const localVid = document.getElementById('local-video');
let isDragging = false, startX, startY, currentX = 0, currentY = 0;

function dragStart(e) {
    if(e.type === "touchstart") { startX = e.touches[0].clientX - currentX; startY = e.touches[0].clientY - currentY; } 
    else { startX = e.clientX - currentX; startY = e.clientY - currentY; }
    isDragging = true;
}
function dragEnd() { isDragging = false; }
function drag(e) {
    if(!isDragging) return;
    e.preventDefault();
    if(e.type === "touchmove") { currentX = e.touches[0].clientX - startX; currentY = e.touches[0].clientY - startY; } 
    else { currentX = e.clientX - startX; currentY = e.clientY - startY; }
    localVid.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
}
localVid.addEventListener('mousedown', dragStart); localVid.addEventListener('touchstart', dragStart, {passive: false});
window.addEventListener('mouseup', dragEnd); window.addEventListener('touchend', dragEnd);
window.addEventListener('mousemove', drag); window.addEventListener('touchmove', drag, {passive: false});


// 💬 DATA CHANNEL (Chat & Files)
function setupDataChannel() {
    dataChannel.onopen = () => console.log("Data Channel Open");
    dataChannel.onmessage = (event) => handleIncomingData(event.data);
}

function sendMessage() {
    if(!dataChannel || dataChannel.readyState !== 'open') return;
    const input = document.getElementById('msg-input');
    const fileInput = document.getElementById('file-upload');
    
    if(fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            const base64Data = reader.result;
            dataChannel.send(JSON.stringify({ type: 'file-meta', fileType: file.type }));
            for (let i = 0; i < base64Data.length; i += 16384) {
                dataChannel.send(JSON.stringify({ type: 'file-chunk', data: base64Data.slice(i, i + 16384) }));
            }
            dataChannel.send(JSON.stringify({ type: 'file-end' }));
            displayMedia(base64Data, file.type, 'sent-msg');
        };
        reader.readAsDataURL(file);
        fileInput.value = ''; 
    }

    if(input.value.trim()) {
        appendMsg(input.value.trim(), 'sent-msg');
        dataChannel.send(JSON.stringify({ type: 'text', text: input.value.trim() }));
        input.value = '';
    }
}

let incomingBuffer = "", incomingMeta = null;
function handleIncomingData(rawData) {
    const parsed = JSON.parse(rawData);
    if(parsed.type === 'text') appendMsg(parsed.text, 'recv-msg');
    else if (parsed.type === 'file-meta') { incomingMeta = parsed; incomingBuffer = ""; }
    else if (parsed.type === 'file-chunk') incomingBuffer += parsed.data; 
    else if (parsed.type === 'file-end') displayMedia(incomingBuffer, incomingMeta.fileType, 'recv-msg');
}

function appendMsg(text, type) {
    const logs = document.getElementById('chat-logs');
    logs.insertAdjacentHTML('beforeend', `<div class="message ${type}">${text}</div>`);
    logs.scrollTop = logs.scrollHeight;
}
function displayMedia(base64Data, mimeType, type) {
    const logs = document.getElementById('chat-logs');
    if(mimeType.startsWith('image/')) logs.insertAdjacentHTML('beforeend', `<div class="message ${type}"><img src="${base64Data}" class="media-content" onclick="openModal('${base64Data}')"></div>`);
    else if(mimeType.startsWith('video/')) logs.insertAdjacentHTML('beforeend', `<div class="message ${type}"><video src="${base64Data}" controls class="media-content"></video></div>`);
    logs.scrollTop = logs.scrollHeight;
}

function openModal(imageSrc) {
    document.getElementById('image-modal').classList.remove('hidden');
    document.getElementById('modal-img').src = imageSrc;
}
function closeModal() { document.getElementById('image-modal').classList.add('hidden'); }
function checkEnter(e) { if(e.key === 'Enter') sendMessage(); }
function triggerKillSwitch() { location.reload(); }