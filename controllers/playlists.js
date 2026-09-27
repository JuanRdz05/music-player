// controllers/playlists.js
const db = require("../database/conexion.js");

// Crea una playlist nueva junto con las canciones que la componen.
function crearPlaylist({ nombre, imagen, cancionIds }) {
	if (!nombre || !Array.isArray(cancionIds) || cancionIds.length === 0) {
		return { success: false, error: "Faltan datos para crear la playlist" };
	}

	const insertarPlaylist = db.prepare(
		"INSERT INTO playlist (nombre, imagen) VALUES (?, ?)",
	);
	// OR IGNORE por si llegara algún id repetido: playlist_canciones tiene
	// UNIQUE(playlist_id, cancion_id).
	const insertarCancion = db.prepare(
		"INSERT OR IGNORE INTO playlist_canciones (playlist_id, cancion_id) VALUES (?, ?)",
	);

	const insertarCanciones = db.transaction((idPlaylist, ids) => {
		ids.forEach((idCancion) => {
			insertarCancion.run(idPlaylist, idCancion);
		});
	});

	try {
		const resultado = insertarPlaylist.run(nombre, imagen ?? null);
		const idPlaylist = resultado.lastInsertRowid;

		insertarCanciones(idPlaylist, cancionIds);

		return { success: true, id: idPlaylist };
	} catch (error) {
		console.error("Error al crear playlist:", error);
		return { success: false, error: error.message };
	}
}

// Devuelve todas las playlists guardadas, con el total de canciones de cada una.
function obtenerPlaylists() {
	return db
		.prepare(
			`SELECT p.id, p.nombre, p.imagen, COUNT(s.id) AS totalCanciones
				FROM playlist p
				LEFT JOIN playlist_canciones pc ON pc.playlist_id = p.id
				LEFT JOIN songs s ON s.id = pc.cancion_id AND s.eliminado = 0
				GROUP BY p.id
				ORDER BY p.id DESC`,
		)
		.all();
}

// Devuelve las canciones de una playlist, en el orden en el que fueron
// agregadas, con toda la información que ya usa el reproductor (nombre,
// archivo, thumbnail, duración, etc.).
function obtenerCancionesDePlaylist(playlistId) {
	return db
		.prepare(
			`SELECT s.*
				FROM playlist_canciones pc
				JOIN songs s ON s.id = pc.cancion_id
				WHERE pc.playlist_id = ? AND s.eliminado = 0
				ORDER BY pc.id ASC`,
		)
		.all(playlistId);
}

module.exports = {
	crearPlaylist,
	obtenerPlaylists,
	obtenerCancionesDePlaylist,
};
