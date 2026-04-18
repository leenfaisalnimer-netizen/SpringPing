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


//  MY OWN INFO 
const me = {
  id: 'u_me',
  name: '',
  photo: ''
};


// AVATAR 
function makeAvatar(letter, bgColor) {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>" +
      "<circle cx='40' cy='40' r='40' fill='" + bgColor + "'/>" +
      "<text x='40' y='52' text-anchor='middle' fill='white' " +
            "font-size='34' font-family='Inter, Arial, sans-serif' " +
            "font-weight='600'>" + letter + "</text>" +
    "</svg>";
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}


// ### STEP 4: DUMMY USERS
const DUMMY_USERS = [
  { id: 'u_leen',     name: 'Leen',     photo: makeAvatar('L', '#EB4D56'), online: true  },
  { id: 'u_karam',    name: 'Karam',    photo: makeAvatar('K', '#EF6E76'), online: true  },
  { id: 'u_mohammad', name: 'Mohammad', photo: makeAvatar('M', '#F7AC9C'), online: false }
];


// DUMMY MESSAGE HISTORY 
const now = Date.now();
const MIN = 60 * 1000;     // 1 minute in ms
const HOUR = 60 * MIN;     // 1 hour in ms


const DUMMY_HISTORY = {

  'u_leen': [
    { from: 'u_leen', to: 'u_me',   kind: 'text', content: 'Hey! Are you joining the SpringPing demo today?', timestamp: now - 2 * HOUR },
  ],

  'u_karam': [
    { from: 'u_karam', to: 'u_me',    kind: 'text',  content: 'I am testing this app', timestamp: now - 1 * HOUR }
  ],

  'u_mohammad': [
    { from: 'u_mohammad', to: 'u_me', kind: 'text', content: 'I am testing this app',        timestamp: now - 1 * 24 * HOUR }
  ]
};


// LIVE STATE =====================================================================================
const users   = new Map();
const history = new Map();
let activeId  = null;

DUMMY_USERS.forEach(u => users.set(u.id, u));
Object.keys(DUMMY_HISTORY).forEach(id => history.set(id, DUMMY_HISTORY[id]));



async function boot() {
  const cached = sessionStorage.getItem('sp_user');
  const user = cached ? JSON.parse(cached) : await window.springping.getUser();

  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  me.name  = user.name;
  me.photo = user.photo;

  myAvatar.src = me.photo;
  myName.textContent = me.name;

  renderUserList();
}
boot();


// RENDER THE USER LIST 
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
    userListEl.innerHTML =
      '<div class="text-muted small text-center p-3">No users match your search.</div>';
  }
}

// Re-render whenever the search text changes.
searchInput.addEventListener('input', renderUserList);


// OPEN A CONVERSATION
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


// RENDER ONE MESSAGE BUBBLE 
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


// SENDING A TEXT MESSAGE 
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

  appendBubble(message);
  if (!history.has(activeId)) history.set(activeId, []);
  history.get(activeId).push(message);

  // next session broadcast this message over WebSockets.

  msgInput.value = '';
  renderUserList(); 
}

sendBtn.addEventListener('click', sendText);
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); sendText(); }
});


// SENDING AN IMAGE 
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
    appendBubble(message);
    if (!history.has(activeId)) history.set(activeId, []);
    history.get(activeId).push(message);

    // next session we will broadcast this image message over WebSockets

    renderUserList();
  };
  reader.readAsDataURL(file);

  imageInput.value = '';
});


// SAFE HTML 
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}
