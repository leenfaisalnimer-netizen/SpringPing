const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('springping', {

  // IPC 01 Save the username + photo after clicking Join
  initUser: (userData) => ipcRenderer.invoke('01:user:init', userData),

  // IPC 02 Ask main.js who is currently logged in
  getUser: () => ipcRenderer.invoke('02:user:get')

});
