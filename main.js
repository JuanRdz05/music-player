const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

function createWindow() {
	let pathPreload = path.join(__dirname, "preload.js");
	const win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			preload: pathPreload,
		},
	});

	win.loadFile("index.html");
}

ipcMain.handle("get-songs", () => {
	const musicPath = path.join(__dirname, "music");
	console.log("Ruta de la carpeta de musica:", musicPath);
	return fs.readdirSync(musicPath);
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
