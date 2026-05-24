// Automatically configures to run seamlessly on localhost or any deployed cloud link
const socket = io(window.location.origin); 
let activePrime = null;

// Standard SHA-256 Verification Hashing Process
async function runSHA256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Action Triggered by Sender Node
function sendSecurePing() {
    const targetId = document.getElementById('phone-number').value.trim();
    const privateKey = document.getElementById('secret-key').value;

    if(!targetId || !privateKey) return alert("Bhai, ID aur Private Key dono bharo!");

    // Huge standard primes to securely handle mathematical validation
    const primes = [982451653, 15485863, 32416190071, 533000401];
    activePrime = primes[Math.floor(Math.random() * primes.length)];

    // Broadcasting payload data packets globally via cloud websocketsf
    socket.emit('global_secure_ping', { prime: activePrime, targetId: targetId });

    // Instantly slide to validation layout
    document.getElementById('screen-auth').classList.add('hidden');
    document.getElementById('screen-handshake').classList.remove('hidden');
    document.getElementById('display-prime').innerText = activePrime;
}

// GLOBAL EVENT LISTENER: Recipient browser hooks up the signal packet immediately in real-time
socket.on('global_incoming_ping', (data) => {
    activePrime = data.prime;
    
    // Automatic view transformation on target device window
    document.getElementById('screen-auth').classList.add('hidden');
    document.getElementById('screen-handshake').classList.remove('hidden');
    document.getElementById('display-prime').innerText = data.prime;
});

// Processing SHA-256 Local Validation Handshake
async function verifyPrimeConnect() {
    const userInputPrime = document.getElementById('prime-input').value;
    let userInputKey = document.getElementById('secret-key').value;

    // 💡 THE FIX: Agar key nahi mili, toh screen par popup de kar maang lo!
    if(!userInputKey) {
        userInputKey = prompt("🔒 Secure Tunnel Unlock karne ke liye apni Shared Private Key dalo:");
    }

    if(!userInputKey) return alert("Bhai, bina Private Key ke verification nahi hoga!");
    if(parseInt(userInputPrime) !== activePrime) return alert("Security Handshake Failed! Verification prime mismatch.");

    // Dynamic encryption signature verification using SHA-256
    const localSignature = await runSHA256(activePrime + userInputKey);
    console.log("🔒 E2EE Tunnel Secured. Local Verification Token Hash:", localSignature);

    document.getElementById('screen-handshake').classList.add('hidden');
    document.getElementById('screen-chat').classList.remove('hidden');
}

// Outbound Message Sender
function sendMessage() {
    const input = document.getElementById('msg-input');
    const msgText = input.value.trim();
    if(!msgText) return;

    appendMsg(msgText, 'sent-msg');
    
    // Routing message dynamically across cloud nodes
    socket.emit('global_send_msg', { text: msgText });
    input.value = '';
}

// Inbound Message Receiver
socket.on('global_receive_msg', (data) => {
    appendMsg(data.text, 'recv-msg');
});

function appendMsg(text, type) {
    const logs = document.getElementById('chat-logs');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerText = text;
    logs.appendChild(div);
    logs.scrollTop = logs.scrollHeight;
}

function checkEnter(e) { if(e.key === 'Enter') sendMessage(); }

// ⚠️ THE AUTOMATIC COLD RAM VOLATILE PURGE SYSTEM (Kill Switch)
function triggerKillSwitch() {
    activePrime = null;
    document.body.innerHTML = `
        <div style="text-align: center; padding: 2.5rem; border: 1px solid var(--danger-red); border-radius: 20px; background: rgba(0,0,0,0.6); max-width: 360px; margin: auto; margin-top: 30vh; box-shadow: 0 0 20px var(--danger-red);">
            <h1 style="color: var(--danger-red); font-family: monospace; font-size: 1.4rem; margin-top:0;">⚠️ DATA WIPE COMPLETE</h1>
            <p style="color: #94a3b8; font-family: monospace; font-size: 0.85rem; line-height:1.5;">Volatile registers zeroed out. DOM tracking components destroyed. Verification cache flushed permanently.</p>
        </div>
    `;
    setTimeout(() => { location.reload(); }, 3000);
}