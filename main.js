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
	const metadataPath = path.join(__dirname, "metadata", "songs.json");

	const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

	return metadata.map((cancion, index) => {
		const archivoPath = path.join(musicPath, cancion.archivo);

		const buffer = fs.readFileSync(archivoPath);
		const duration = getMP3Duration(buffer);

		return {
			id: index,
			nombre: cancion.nombre,
			artista: cancion.artista,
			album: cancion.album,

			archivo: `music/${cancion.archivo}`,

			imagen: `img/${cancion.archivo.replace(".mp3", ".png")}`,

			thumbnail: `img/thumbnails/${cancion.archivo.replace(".mp3", ".png")}`,

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

const URL = "https://lrclib.net/api/get";

ipcMain.handle(
	"get-lyrics",
	async (event, { nombre, artista, album, duration }) => {
		try {
			const params = new URLSearchParams({
				track_name: nombre,
				artist_name: artista,
				album_name: album,
				duration: Math.round(duration),
			});

			const response = await fetch(`${URL}?${params.toString()}`, {
				headers: {
					"User-Agent": "ReproductorMusica/1.0.0",
				},
			});

			if (response.status === 404) {
				return { found: false };
			}
			if (!response.ok) {
				throw new Error(`LRCLIB respondió con estado ${response.status}`);
			}

			const data = await response.json();

			return {
				found: true,
				instrumental: data.instrumental,
				syncedLyrics: data.syncedLyrics,
			};
		} catch (error) {
			console.error("Error obteniendo letra desde LRCLIB:", error);
			return { found: false, error: error.message };
		}
	},
);

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
