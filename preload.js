const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('springping', {

  // IPC 01 Save the username + photo after clicking Join
  initUser: (userData) => ipcRenderer.invoke('01:user:init', userData),

  // IPC 02 Ask main.js who is currently logged in
  getUser: () => ipcRenderer.invoke('02:user:get'),

  //TODO (new) IPC 03 — Get this computer's LAN IP address
  getLocalIP: () => ipcRenderer.invoke('03:ws:get-ip'),

  //TODO (new) IPC 04 — Start a WebSocket server (host mode)
  hostRoom: () => ipcRenderer.invoke('04:ws:host'),

  //TODO (new) IPC 05 — Connect to a host's WebSocket server
  joinRoom: (hostIP) => ipcRenderer.invoke('05:ws:join', hostIP),

  //TODO (new) IPC 06 — Send a chat message through WebSocket
  sendWsMessage: (message) => ipcRenderer.invoke('06:ws:send', message),




  
  // ==========================================================================
  // TODO (new) EVENT LISTENERS — main.js sends these events TO the renderer
  // We use ipcRenderer.on() to listen, and return a cleanup function

  //TODO (new) Fires when the server sends us the full list of online users
  onUserList: (callback) => {
    ipcRenderer.on('ws:user-list', (_event, users) => callback(users));
  },

  //TODO (new) Fires when a new user joins the room
  onUserJoined: (callback) => {
    ipcRenderer.on('ws:user-joined', (_event, user) => callback(user));
  },

  //TODO (new) Fires when a user leaves the room
  onUserLeft: (callback) => {
    ipcRenderer.on('ws:user-left', (_event, userId) => callback(userId));
  },

  //TODO (new) Fires when a chat message arrives
  onMessage: (callback) => {
    ipcRenderer.on('ws:message', (_event, message) => callback(message));
  },

  //TODO (new) Fires when we lose connection to the host
  onDisconnected: (callback) => {
    ipcRenderer.on('ws:disconnected', (_event) => callback());
  }

});
