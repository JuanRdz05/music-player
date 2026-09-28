const {
	app,
	BrowserWindow,
	ipcMain,
	globalShortcut,
	dialog,
} = require("electron");

app.setName("electron-app");

const path = require("path");

// Rutas de datos del usuario (userData). Debe ir DESPUÉS de app.setName.
const R = require("./utils/rutas");

const URL = "https://lrclib.net/api/get";

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

//Obtener todas las canciones desde la base de datos
ipcMain.handle("get-songs", () => {
	const { obtenerTodasLasCanciones } = require("./controllers/canciones.js");
	return obtenerTodasLasCanciones().map(R.resolverCancion);
});

// ipcMain.handle("get-song", () => {
// 	return db.prepare("SELECT * FROM songs WHERE eliminado = 0").all();
// });

ipcMain.handle("delete-songs", (event, ids) => {
	const { borrarCancionesLogico } = require("./controllers/canciones.js");
	try {
		const resultado = borrarCancionesLogico(ids);
		return { success: true, changes: resultado.changes };
	} catch (error) {
		console.error("Error en DB al hacer borrado lógico:", error);
		return { success: false, error: error.message };
	}
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

ipcMain.handle("get-lyrics", async (event, { nombre, artista, duration }) => {
	try {
		const params = new URLSearchParams({
			track_name: nombre,
			artist_name: artista,
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
			plainLyrics: data.plainLyrics,
		};
	} catch (error) {
		console.error("Error obteniendo letra desde LRCLIB:", error);
		return { found: false, error: error.message };
	}
});

// Agregar una nueva canción: copia archivos y la inserta en la base de datos
ipcMain.handle(
	"add-song",
	async (
		event,
		{ nombre, artista, audioPath, imagePath, duration, lyrics, lyricsTimed },
	) => {
		const fs = require("fs");
		const { agregarCancion } = require("./controllers/canciones.js");

		try {
			// Carpetas de destino (dentro de la carpeta de datos del usuario)
			const musicDir = R.MUSIC_DIR;
			const imgDir = R.IMG_DIR;

			if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir, { recursive: true });
			if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

			// Copiar audio
			const audioExt = path.extname(audioPath);
			const audioBaseName = `${nombre}${audioExt}`;
			const audioDest = path.join(musicDir, audioBaseName);
			fs.copyFileSync(audioPath, audioDest);
			const archivoRelativo = `music/${audioBaseName}`;

			// Copiar imagen (si se proporcionó)
			let imagenRelativa = null;
			let thumbnailRelativa = null;

			if (imagePath) {
				const imgExt = path.extname(imagePath);
				const imgBaseName = `${nombre}${imgExt}`;
				const imgDest = path.join(imgDir, imgBaseName);
				fs.copyFileSync(imagePath, imgDest);
				imagenRelativa = `img/${imgBaseName}`;

				// Generar miniatura
				try {
					await getThumbnailPath(imgDest); // ruta absoluta
					thumbnailRelativa = `img/thumbnails/${imgBaseName}`; // relativa, para la BD
				} catch (thumbErr) {
					console.warn("No se pudo generar miniatura:", thumbErr.message);
					thumbnailRelativa = imagenRelativa;
				}
			}

			const resultado = agregarCancion({
				nombre,
				artista,
				archivo: archivoRelativo,
				imagen: imagenRelativa,
				thumbnail: thumbnailRelativa,
				duration,
				lyrics: lyrics ?? null,
				lyricsTimed: lyricsTimed ?? null,
			});

			if (resultado.changes === 0) {
				return {
					success: false,
					error: "La canción ya existe en la biblioteca",
				};
			}

			return { success: true, id: resultado.lastInsertRowid };
		} catch (err) {
			console.error("Error al agregar canción:", err);
			return { success: false, error: err.message };
		}
	},
);

// Obtener todas las playlists guardadas (con su portada y total de canciones)
ipcMain.handle("get-playlists", () => {
	const { obtenerPlaylists } = require("./controllers/playlists.js");
	return obtenerPlaylists().map(R.resolverPlaylist);
});

// Obtener una sola playlist (nombre + imagen), para precargar el modal de edición
ipcMain.handle("get-playlist", (event, playlistId) => {
	const { obtenerPlaylistPorId } = require("./controllers/playlists.js");
	return R.resolverPlaylist(obtenerPlaylistPorId(playlistId));
});

// Obtener las canciones de una playlist específica, en orden
ipcMain.handle("get-playlist-songs", (event, playlistId) => {
	const { obtenerCancionesDePlaylist } = require("./controllers/playlists.js");
	return obtenerCancionesDePlaylist(playlistId).map(R.resolverCancion);
});

// Obtener las canciones que TODAVÍA NO están en una playlist (paso "Agregar canción")
ipcMain.handle("get-songs-not-in-playlist", (event, playlistId) => {
	const {
		obtenerCancionesFueraDePlaylist,
	} = require("./controllers/playlists.js");
	return obtenerCancionesFueraDePlaylist(playlistId).map(R.resolverCancion);
});

// Agregar una canción existente a una playlist existente
ipcMain.handle("add-song-to-playlist", (event, { playlistId, cancionId }) => {
	const { agregarCancionAPlaylist } = require("./controllers/playlists.js");
	try {
		agregarCancionAPlaylist(playlistId, cancionId);
		return { success: true };
	} catch (error) {
		console.error("Error al agregar canción a la playlist:", error);
		return { success: false, error: error.message };
	}
});

// Quitar una o más canciones de una playlist (no las borra de la biblioteca)
ipcMain.handle(
	"remove-songs-from-playlist",
	(event, { playlistId, cancionIds }) => {
		const { quitarCancionesDePlaylist } = require("./controllers/playlists.js");
		try {
			const resultado = quitarCancionesDePlaylist(playlistId, cancionIds);
			return { success: true, changes: resultado.changes };
		} catch (error) {
			console.error("Error al quitar canciones de la playlist:", error);
			return { success: false, error: error.message };
		}
	},
);

// Crear una nueva playlist: copia la portada (si hay) y guarda el registro
ipcMain.handle(
	"create-playlist",
	async (event, { nombre, imagePath, cancionIds }) => {
		const fs = require("fs");
		const { crearPlaylist } = require("./controllers/playlists.js");

		try {
			let imagenRelativa = null;

			if (imagePath) {
				const playlistImgDir = R.PLAYLIST_IMG_DIR;
				if (!fs.existsSync(playlistImgDir)) {
					fs.mkdirSync(playlistImgDir, { recursive: true });
				}

				// Prefijo con timestamp: como "playlist.nombre" no es único
				// en la base de datos, dos playlists con el mismo nombre no
				// deben pisarse la portada.
				const imgExt = path.extname(imagePath);
				const imgBaseName = `${Date.now()}-${nombre}${imgExt}`;
				const imgDest = path.join(playlistImgDir, imgBaseName);
				fs.copyFileSync(imagePath, imgDest);
				imagenRelativa = `img/playlists/${imgBaseName}`;
			}

			return crearPlaylist({ nombre, imagen: imagenRelativa, cancionIds });
		} catch (err) {
			console.error("Error al crear playlist:", err);
			return { success: false, error: err.message };
		}
	},
);

// Actualizar nombre y/o portada de una playlist existente
ipcMain.handle("update-playlist", async (event, { id, nombre, imagePath }) => {
	const fs = require("fs");
	const { actualizarPlaylist } = require("./controllers/playlists.js");

	try {
		// undefined = no se tocó la portada, se conserva la actual
		let imagenRelativa;

		if (imagePath) {
			const playlistImgDir = R.PLAYLIST_IMG_DIR;
			if (!fs.existsSync(playlistImgDir)) {
				fs.mkdirSync(playlistImgDir, { recursive: true });
			}

			const imgExt = path.extname(imagePath);
			const imgBaseName = `${Date.now()}-${nombre}${imgExt}`;
			const imgDest = path.join(playlistImgDir, imgBaseName);
			fs.copyFileSync(imagePath, imgDest);
			imagenRelativa = `img/playlists/${imgBaseName}`;
		}

		actualizarPlaylist({ id, nombre, imagen: imagenRelativa });
		return { success: true };
	} catch (err) {
		console.error("Error al actualizar playlist:", err);
		return { success: false, error: err.message };
	}
});

// Eliminar (borrado lógico) una playlist completa
ipcMain.handle("delete-playlist", (event, playlistId) => {
	const { borrarPlaylistLogico } = require("./controllers/playlists.js");
	try {
		const resultado = borrarPlaylistLogico(playlistId);
		return { success: true, changes: resultado.changes };
	} catch (error) {
		console.error("Error al eliminar la playlist:", error);
		return { success: false, error: error.message };
	}
});

// Obtener las canciones favoritas (más recientes primero)
ipcMain.handle("get-favorites", () => {
	const { obtenerFavoritos } = require("./controllers/favoritos.js");
	return obtenerFavoritos().map(R.resolverCancion);
});

// Obtener solo los ids de las canciones favoritas (para pintar las estrellas)
ipcMain.handle("get-favorite-ids", () => {
	const { obtenerIdsFavoritos } = require("./controllers/favoritos.js");
	return obtenerIdsFavoritos();
});

// Marcar / desmarcar una canción como favorita
ipcMain.handle("toggle-favorite", (event, cancionId) => {
	const { alternarFavorito } = require("./controllers/favoritos.js");
	try {
		const esFavorito = alternarFavorito(cancionId);
		return { success: true, esFavorito };
	} catch (error) {
		console.error("Error al alternar favorito:", error);
		return { success: false, error: error.message };
	}
});

app.whenReady().then(async () => {
	try {
		console.log("Generando miniaturas...");
		await generateAllThumbnails();
		console.log("Miniaturas listas");
	} catch (error) {
		console.error("Error generando miniaturas:", error);
	}

	try {
		require("./database/conexion.js");
		console.log("--Base de datos lista--");
	} catch (error) {
		console.error("Error inicializando la base de datos:", error);

		dialog.showErrorBox(
			"Error al iniciar la base de datos",
			`No se pudo preparar la base de datos de la aplicación.\n\n${error.message}`,
		);

		app.quit();
		return;
	}

	createWindow();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
