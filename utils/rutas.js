// utils/rutas.js
// Carpetas donde la app GUARDA datos del usuario (música, portadas, miniaturas).
// Viven en "userData" (junto a reproductor.db) porque la carpeta de la app
// empaquetada es de solo lectura.
//
// IMPORTANTE: solo se usa desde el proceso principal (main.js y los módulos
// que main.js carga). Debe requerirse DESPUÉS de app.setName(...).
const { app } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

const DATA_DIR = app.getPath("userData");

// Convierte una ruta guardada en la BD ("music/x.mp3") en una URL file://
// que el <audio> y los <img> del renderer pueden usar directamente.
// pathToFileURL escapa bien caracteres como espacios, # o %.
const aUrl = (rel) => {
	if (!rel) return null;
	const abs = path.isAbsolute(rel) ? rel : path.join(DATA_DIR, rel);
	return pathToFileURL(abs).href;
};

module.exports = {
	DATA_DIR,
	MUSIC_DIR: path.join(DATA_DIR, "music"),
	IMG_DIR: path.join(DATA_DIR, "img"),
	THUMBS_DIR: path.join(DATA_DIR, "img", "thumbnails"),
	PLAYLIST_IMG_DIR: path.join(DATA_DIR, "img", "playlists"),
	aUrl,
	resolverCancion: (c) => ({
		...c,
		archivo: aUrl(c.archivo),
		imagen: aUrl(c.imagen),
		thumbnail: aUrl(c.thumbnail),
	}),
	resolverPlaylist: (p) => p && { ...p, imagen: aUrl(p.imagen) },
};
