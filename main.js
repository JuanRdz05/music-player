const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");
const getMP3Duration = require("get-mp3-duration");

//Generador de miniaturas
const {
	generateAllThumbnails,
	getThumbnailPath,
	CONFIG,
} = require("./JS/image-reductor");

function createWindow() {
	let pathPreload = path.join(__dirname, "preload.js");
	const win = new BrowserWindow({
		width: 1920,
		height: 1080,
		fullscreen: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});

	win.maximize();

	win.loadFile("index.html");
	console.log("Iniciando aplicación");
	//Atajos de teclado
	globalShortcut.register("CommandOrControl+o", () => {
		if (win.isVisible()) win.hide();
		else win.show();
	});
	globalShortcut.register("CommandOrControl+q", () => {
		console.log("Saliendo de la aplicación");
		app.quit();
	});
}
//Crear un objeto por canción con sus propiedades
ipcMain.handle("get-songs", () => {
	const musicPath = path.join(__dirname, "music");
	const canciones = fs.readdirSync(musicPath);

	return canciones.map((cancion) => {
		const buffer = fs.readFileSync(path.join(musicPath, cancion));
		const duration = getMP3Duration(buffer);
		return {
			nombre: cancion,
			imagen: `img/${cancion.replace(".mp3", ".png")}`,
			duration: duration / 1000,
		};
	});
});

ipcMain.handle("get-thumbnail", async (event, imagePath) => {
	try {
		const thumbPath = await getThumbnailPath(imagePath);
		return thumbPath;
	} catch (error) {
		console.error("Error generando miniatura:", error);
		return null;
	}
});

//Cuando la app esté lista
app.whenReady().then(async () => {
	console.log("Generando miniaturas...");
	await generateAllThumbnails();
	console.log("Miniaturas listas");

	createWindow();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
