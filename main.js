const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');                  //TODO (new) needed to find our LAN IP address
const { WebSocketServer, WebSocket } = require('ws');  //TODO (new) WebSocket library

let currentUser = null;
let mainWindow = null;

//TODO  (new) WebSocket state — we track the server, our own client, and all connected users
let wsServer  = null;   //TODO (new) only set on the HOST machine
let wsClient  = null;   //TODO (new) only set on JOINING machines
let wsClients = [];     //TODO (new) HOST keeps a list of every connected client socket
let connectedUsers = new Map();  //TODO (new) id → { id, name, photo, online }
const WS_PORT = 3069;  //TODO (new) the port SpringPing uses on the LAN


//! ================================================================================================
//! CREATE THE ELECTRON WINDOW

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,

    icon: path.join(__dirname, 'assets', 'logo.png'),
    backgroundColor: '#FFFFFF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}


//! ================================================================================================
//! IPC HANDLERS

// IPC 01 — user:init
ipcMain.handle('01:user:init', (_event, userData) => {
  currentUser = {
    id:    'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),  // (new) generate a unique ID
    name:  userData.name,
    photo: userData.photo
  };
  console.log('[IPC 01] User initialized:', currentUser.name, '→', currentUser.id);
  return { ok: true };
});

// IPC 02 — user:get
ipcMain.handle('02:user:get', () => {
  return currentUser;
});

//TODO (new) IPC 03 — ws:get-ip    - Returns this computer's LAN IP so the host can show it to classmates

ipcMain.handle('03:ws:get-ip', () => {
  return getLocalIP();
});

//TODO (new) IPC 04 — ws:host    - The HOST student calls this to start the WebSocket server on port 3069
ipcMain.handle('04:ws:host', () => {
  return startServer();
});

//TODO (new) IPC 05 — ws:join    -A JOINING student calls this with the host's IP to connect as a WebSocket client
ipcMain.handle('05:ws:join', (_event, hostIP) => {
  return connectToHost(hostIP);
});

//TODO (new) IPC 06 — ws:send    = Send a chat message (text or image) through the WebSocket connection

ipcMain.handle('06:ws:send', (_event, message) => {
  const packet = JSON.stringify({ type: 'message', data: message });

  // If we are the HOST, broadcast to everyone AND handle locally
  if (wsServer) {
    broadcastToAll(packet);
    // Also deliver to our own renderer so it shows up
    sendToRenderer('ws:message', message);
  }

  // If we are a CLIENT, send to the server and it will broadcast back to us
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(packet);
  }

  return { ok: true };
});


//TODO (new) HELPER — Get this machine's local IPv4 address
// Loops through every network interface and picks the first non-internal IPv4

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (loopback) and IPv6 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';  // fallback if no LAN found
}



//TODO (new) HELPER — Send an event from main.js to the renderer (chat.js)// ================================================================================================
// We use webContents.send() which the preload.js listens for with ipcRenderer.on()
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}


//TODO (new) HELPER — HOST broadcasts a raw JSON string to every connected client===============================================================================================
function broadcastToAll(rawJson) {
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(rawJson);
    }
  });
}


//TODO (new) HOST MODE — Start the WebSocket server============================================================================================

function startServer() {
  return new Promise((resolve, reject) => {
    try {
      wsServer = new WebSocketServer({ port: WS_PORT });

      wsServer.on('listening', () => {
        const ip = getLocalIP();
        console.log('[WS] Server started on', ip + ':' + WS_PORT);

        // The host adds THEMSELVES to the connected users list
        connectedUsers.set(currentUser.id, {
          id:     currentUser.id,
          name:   currentUser.name,
          photo:  currentUser.photo,
          online: true
        });

        resolve({ ok: true, ip: ip, port: WS_PORT });
      });

      // When a new client connects to our server
      wsServer.on('connection', (socket) => {
        console.log('[WS] New client connected');
        wsClients.push(socket);

        // When the server receives a message from a client
        socket.on('message', (raw) => {
          try {
            const packet = JSON.parse(raw.toString());
            handleServerPacket(socket, packet);
          } catch (e) {
            console.error('[WS] Bad message:', e.message);
          }
        });

        // When a client disconnects
        socket.on('close', () => {
          console.log('[WS] Client disconnected');
          // Remove the socket from our list
          wsClients = wsClients.filter(c => c !== socket);

          // Find which user this socket belonged to and mark them offline
          const userId = socket._springpingUserId;
          if (userId && connectedUsers.has(userId)) {
            connectedUsers.delete(userId);

            // Tell everyone (including our own renderer) that this user left
            const leavePacket = JSON.stringify({ type: 'user-left', userId: userId });
            broadcastToAll(leavePacket);
            sendToRenderer('ws:user-left', userId);
          }
        });
      });

      wsServer.on('error', (err) => {
        console.error('[WS] Server error:', err.message);
        reject({ ok: false, error: err.message });
      });

    } catch (err) {
      reject({ ok: false, error: err.message });
    }
  });
}

//TODO (new) HOST — Handle an incoming packet from a client===========================================================================

function handleServerPacket(socket, packet) {
  switch (packet.type) {

    // A new user is announcing themselves
    case 'join': {
      const user = packet.user;
      socket._springpingUserId = user.id;  // tag the socket so we know who disconnected later

      // Add to the connected users map
      connectedUsers.set(user.id, {
        id:     user.id,
        name:   user.name,
        photo:  user.photo,
        online: true
      });

      console.log('[WS] User joined:', user.name);

      // Send the FULL user list back to the new client so they know who's already here
      const userListPacket = JSON.stringify({
        type: 'user-list',
        users: Array.from(connectedUsers.values())
      });
      socket.send(userListPacket);

      // Tell ALL other clients (+ the host renderer) about the new user
      const joinPacket = JSON.stringify({ type: 'user-joined', user: user });
      broadcastToAll(joinPacket);
      sendToRenderer('ws:user-joined', user);
      break;
    }

    // A chat message ,relay it to everyone
    case 'message': {
      const msg = packet.data;
      // Broadcast to all clients (including the sender so they get confirmation)
      broadcastToAll(JSON.stringify(packet));
      // Also show it on the host's own renderer
      sendToRenderer('ws:message', msg);
      break;
    }
  }
}


//TODO (new) CLIENT MODE — Connect to a host's WebSocket server===================================================

function connectToHost(hostIP) {
  return new Promise((resolve, reject) => {
    try {
      const url = 'ws://' + hostIP + ':' + WS_PORT;
      console.log('[WS] Connecting to', url);

      wsClient = new WebSocket(url);

      wsClient.on('open', () => {
        console.log('[WS] Connected to host!');

        // Send our user info so the server knows who we are
        wsClient.send(JSON.stringify({
          type: 'join',
          user: {
            id:    currentUser.id,
            name:  currentUser.name,
            photo: currentUser.photo
          }
        }));

        resolve({ ok: true });
      });

      // When the client receives a message from the server
      wsClient.on('message', (raw) => {
        try {
          const packet = JSON.parse(raw.toString());
          handleClientPacket(packet);
        } catch (e) {
          console.error('[WS] Bad message:', e.message);
        }
      });

      wsClient.on('close', () => {
        console.log('[WS] Disconnected from host');
        sendToRenderer('ws:disconnected', null);
      });

      wsClient.on('error', (err) => {
        console.error('[WS] Connection error:', err.message);
        reject({ ok: false, error: err.message });
      });

    } catch (err) {
      reject({ ok: false, error: err.message });
    }
  });
}


//TODO (new) CLIENT — Handle an incoming packet from the server============================================================

function handleClientPacket(packet) {
  switch (packet.type) {

    // Server sent us the full list of everyone currently online
    case 'user-list':
      sendToRenderer('ws:user-list', packet.users);
      break;

    // A new user joined
    case 'user-joined':
      sendToRenderer('ws:user-joined', packet.user);
      break;

    // A user left
    case 'user-left':
      sendToRenderer('ws:user-left', packet.userId);
      break;

    // A chat message arrived
    case 'message':
      sendToRenderer('ws:message', packet.data);
      break;
  }
}


// ================================================================================================
// APP LIFECYCLE
// ================================================================================================
app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  //TODO (new) Clean up WebSocket connections before quitting
  if (wsClient) wsClient.close();
  if (wsServer) wsServer.close();

  if (process.platform !== 'darwin') app.quit();
});
