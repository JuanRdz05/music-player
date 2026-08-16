const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("music", {
	getSongs: () => {
		return ipcRenderer.invoke("get-songs");
	},
});

contextBridge.exposeInMainWorld("lyrics", {
	getLyrics: () => {
		return ipcRenderer.invoke("get-lyrics");
	},
});
