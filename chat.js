const myAvatar      = document.getElementById('myAvatar');
const myName        = document.getElementById('myName');
const userListEl    = document.getElementById('userList');
const searchInput   = document.getElementById('searchInput');

const chatHeader    = document.getElementById('chatHeader');
const peerAvatar    = document.getElementById('peerAvatar');
const peerAvatarWrap= document.getElementById('peerAvatarWrap');
const peerName      = document.getElementById('peerName');
const peerStatus    = document.getElementById('peerStatus');

const messagesEl    = document.getElementById('messages');
const emptyState    = document.getElementById('emptyState');
const composer      = document.getElementById('composer');
const msgInput      = document.getElementById('msgInput');
const sendBtn       = document.getElementById('sendBtn');
const imageBtn      = document.getElementById('imageBtn');
const imageInput    = document.getElementById('imageInput');

//TODO (new) Network status elements
const netLabel      = document.getElementById('netLabel');


//  MY OWN INFO
const me = {
  id: '',    //TODO (new) will be set from main.js (was hardcoded 'u_me' before)
  name: '',
  photo: ''
};

//!LIVE STATE
const users   = new Map();   // id → { id, name, photo, online }
const history = new Map();   // oderId → [ message, message, ... ]
let activeId  = null;

//TODO(new) REMOVED  DUMMY_USERS.forEach() DUMMY_HISTORY 


// TODO(new) BOOT — Initialize user info AND start the WebSocket connection

async function boot() {
  const cached = sessionStorage.getItem('sp_user');
  const user = cached ? JSON.parse(cached) : await window.springping.getUser();

  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  // (new) Get the full user object from main.js (includes the generated ID)
  const fullUser = await window.springping.getUser();

  me.id    = fullUser.id;    // (new) use the real unique ID from main.js
  me.name  = fullUser.name;
  me.photo = fullUser.photo;

  myAvatar.src = me.photo;
  myName.textContent = me.name;

  renderUserList();

  // (new) Set up WebSocket event listeners BEFORE connecting
  setupWsListeners();

  // (new) Read the mode from sessionStorage and start the right connection
  const mode   = sessionStorage.getItem('sp_mode') || 'host';
  const hostIP = sessionStorage.getItem('sp_host_ip') || '';

  if (mode === 'host') {
    // HOST MODE — start the WebSocket server
    try {
      const result = await window.springping.hostRoom();
      netLabel.textContent = 'Hosting · ' + result.ip + ':' + result.port;
      console.log('[BOOT] Server started:', result.ip);
    } catch (err) {
      console.error('[BOOT] Failed to start server:', err);
      netLabel.textContent = 'Failed to host';
    }
  } else {
    // JOIN MODE — connect to the host's server
    try {
      await window.springping.joinRoom(hostIP);
      netLabel.textContent = 'Connected · ' + hostIP;
      console.log('[BOOT] Connected to host:', hostIP);
    } catch (err) {
      console.error('[BOOT] Failed to connect:', err);
      netLabel.textContent = 'Connection failed';
    }
  }
}
boot();


//TODO (new) WEBSOCKET EVENT LISTENERS   ===== These fire when main.js sends events to the renderer via webContents.send()
function setupWsListeners() {

  // (new) Receive the full user list (when we first join a room)
  window.springping.onUserList((userList) => {
    console.log('[WS] Received user list:', userList.length, 'users');
    userList.forEach(u => {
      // Don't add ourselves to the sidebar list
      if (u.id === me.id) return;
      users.set(u.id, { id: u.id, name: u.name, photo: u.photo, online: true });
    });
    renderUserList();
  });

  // (new) A new user joined the room
  window.springping.onUserJoined((user) => {
    console.log('[WS] User joined:', user.name);
    // Don't add ourselves
    if (user.id === me.id) return;
    users.set(user.id, { id: user.id, name: user.name, photo: user.photo, online: true });
    renderUserList();
  });

  // (new) A user left the room
  window.springping.onUserLeft((userId) => {
    console.log('[WS] User left:', userId);
    const u = users.get(userId);
    if (u) {
      u.online = false;
      renderUserList();

      // If we were chatting with them, update the header
      if (activeId === userId) {
        peerAvatarWrap.classList.remove('online');
        peerStatus.textContent = 'Offline';
        peerStatus.classList.remove('online');
      }
    }
  });

  // (new) A chat message arrived from the WebSocket
  window.springping.onMessage((msg) => {
    console.log('[WS] Message from', msg.from, '→', msg.to);

    // Figure out which conversation this message belongs to
    // If I sent it, it goes under the receiver's ID; if someone else sent it, under sender's ID
    const otherId = (msg.from === me.id) ? msg.to : msg.from;

    // Store the message in history
    if (!history.has(otherId)) history.set(otherId, []);
    history.get(otherId).push(msg);

    // If this conversation is currently open, show the bubble
    if (activeId === otherId) {
      appendBubble(msg);
    }

    // Update the sidebar preview text
    renderUserList();
  });

  // (new) Lost connection to the host
  window.springping.onDisconnected(() => {
    console.log('[WS] Disconnected!');
    netLabel.textContent = 'Disconnected';
    // Mark all users as offline
    users.forEach(u => { u.online = false; });
    renderUserList();
  });
}


//! RENDER THE USER LIST
function renderUserList() {
  const query = searchInput.value.trim().toLowerCase();
  userListEl.innerHTML = '';

  let shown = 0;

  for (const u of users.values()) {
    // Filter by search text (if any).
    if (query && !u.name.toLowerCase().includes(query)) continue;

    // Figure out the preview text from the LAST message in this conversation.
    const convo = history.get(u.id) || [];
    const last  = convo[convo.length - 1];

    let preview = 'Say hi 👋';
    if (last) {
      // If the last message was mine, prefix with "You: " to make it clear.
      const prefix = last.from === me.id ? 'You: ' : '';
      preview = prefix + (last.kind === 'image' ? '📷 Photo' : last.content);
    }

    // Build one row element.
    const row = document.createElement('div');
    row.className = 'user-item' + (u.id === activeId ? ' active' : '');
    row.dataset.userId = u.id;
   row.innerHTML =
  '<div class="avatar-wrapper ' + (u.online ? 'online' : '') + '">' +
    '<div class="avatar">' +
      '<img src="' + u.photo + '" alt="">' +
    '</div>' +
    '<span class="dot"></span>' +
  '</div>' +
  '<div style="min-width:0; flex:1;">' +
    '<div class="user-name">' + escapeHtml(u.name) + '</div>' +
    '<div class="user-last">' + escapeHtml(preview) + '</div>' +
  '</div>';

    row.addEventListener('click', () => openChat(u.id));
    userListEl.appendChild(row);
    shown++;
  }

  // Empty state for the list (e.g. when search matches nothing).
  if (shown === 0) {
    // (new) Updated empty text to reflect real LAN behavior
    const msg = users.size === 0
      ? 'Waiting for classmates to join...'
      : 'No users match your search.';
    userListEl.innerHTML =
      '<div class="text-muted small text-center p-3">' + msg + '</div>';
  }
}

//! Re-render whenever the search text changes.
searchInput.addEventListener('input', renderUserList);


//! OPEN A CONVERSATION
function openChat(userId) {
  activeId = userId;
  const u = users.get(userId);
  if (!u) return;

  peerAvatar.src = u.photo;
  peerAvatarWrap.classList.toggle('online', !!u.online);
  peerName.textContent = u.name;
  peerStatus.textContent = u.online ? 'Online' : 'Offline';
  peerStatus.classList.toggle('online', !!u.online);

  chatHeader.style.display = 'flex';
  composer.style.display   = 'flex';
  emptyState.style.display = 'none';

  renderUserList();

  messagesEl.innerHTML = '';
  (history.get(userId) || []).forEach(appendBubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  msgInput.focus();
}


// !RENDER ONE MESSAGE BUBBLE
function appendBubble(msg) {
  const isMine = msg.from === me.id;
  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (isMine ? 'sent' : 'received');

  // Format the timestamp as "14:05"
  const time = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  });

  // Received bubbles show the sender's name in tiny text.
  let senderLabel = '';
  if (!isMine) {
    const sender = users.get(msg.from);
    const name = sender ? sender.name : 'Unknown';
    senderLabel = '<div class="sender">' + escapeHtml(name) + '</div>';
  }


  const body = (msg.kind === 'image')
    ? '<img class="msg-image" src="' + msg.content + '" alt="image">'
    : escapeHtml(msg.content);

  bubble.innerHTML = senderLabel + body + '<div class="meta">' + time + '</div>';
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}


//! SENDING A TEXT MESSAGE
function sendText() {
  const text = msgInput.value.trim();
  if (!text || !activeId) return;

  const message = {
    from: me.id,
    to:   activeId,
    kind: 'text',
    content: text,
    timestamp: Date.now()
  };

  // (new) Send the message through WebSocket instead of just storing locally
  window.springping.sendWsMessage(message);

  // (new) REMOVED — we no longer appendBubble() or push to history here
  // The ws:message event listener will handle that when the server echoes it back
  // For the HOST, main.js sends ws:message back to us immediately
  // For a CLIENT, the server broadcasts it back to us

  msgInput.value = '';
  // (new) REMOVED — renderUserList() is called by the ws:message listener instead
}

sendBtn.addEventListener('click', sendText);
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); sendText(); }
});


// !SENDING AN IMAGE
imageBtn.addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file || !activeId) return;
  if (!file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const message = {
      from: me.id,
      to:   activeId,
      kind: 'image',
      content: evt.target.result,
      timestamp: Date.now()
    };

    //TODO (new) Send the image message through WebSocket
    window.springping.sendWsMessage(message);

    //TODO (new) REMOVED — local appendBubble() and history.push()
    // The ws:message listener handles display when the server echoes it back
  };
  reader.readAsDataURL(file);

  imageInput.value = '';
});


//! SAFE HTML
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}
