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
				WHERE p.eliminado = 0
				GROUP BY p.id
				ORDER BY p.id DESC`,
		)
		.all();
}

// Devuelve una sola playlist (nombre + imagen), para precargar el modal de edición.
function obtenerPlaylistPorId(id) {
	return db
		.prepare("SELECT id, nombre, imagen FROM playlist WHERE id = ?")
		.get(id);
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

// Devuelve las canciones de la biblioteca que TODAVÍA NO están en la
// playlist indicada. Se usa en el paso 2 del modal de edición ("Agregar canción").
function obtenerCancionesFueraDePlaylist(playlistId) {
	return db
		.prepare(
			`SELECT s.*
				FROM songs s
				WHERE s.eliminado = 0
				  AND s.id NOT IN (
					SELECT cancion_id FROM playlist_canciones WHERE playlist_id = ?
				  )
				ORDER BY s.id ASC`,
		)
		.all(playlistId);
}

// Agrega una canción existente a una playlist existente.
// OR IGNORE porque playlist_canciones tiene UNIQUE(playlist_id, cancion_id).
function agregarCancionAPlaylist(playlistId, cancionId) {
	const stmt = db.prepare(
		"INSERT OR IGNORE INTO playlist_canciones (playlist_id, cancion_id) VALUES (?, ?)",
	);
	return stmt.run(playlistId, cancionId);
}

// Quita una o más canciones de una playlist (borra la fila de la tabla
// intermedia; la canción NO se toca en la tabla songs).
function quitarCancionesDePlaylist(playlistId, cancionIds) {
	const placeholders = cancionIds.map(() => "?").join(",");
	const stmt = db.prepare(
		`DELETE FROM playlist_canciones WHERE playlist_id = ? AND cancion_id IN (${placeholders})`,
	);
	return stmt.run(playlistId, ...cancionIds);
}

// Actualiza el nombre y, opcionalmente, la portada de una playlist.
// Si "imagen" viene como undefined, la portada actual NO se toca.
function actualizarPlaylist({ id, nombre, imagen }) {
	if (imagen === undefined) {
		const stmt = db.prepare("UPDATE playlist SET nombre = ? WHERE id = ?");
		return stmt.run(nombre, id);
	}

	const stmt = db.prepare(
		"UPDATE playlist SET nombre = ?, imagen = ? WHERE id = ?",
	);
	return stmt.run(nombre, imagen, id);
}

// Elimina una playlist de forma lógica (eliminado = 1). Las canciones que
// contenía NO se tocan; solo deja de listarse en obtenerPlaylists().
function borrarPlaylistLogico(id) {
	const stmt = db.prepare("UPDATE playlist SET eliminado = 1 WHERE id = ?");
	return stmt.run(id);
}

module.exports = {
	crearPlaylist,
	obtenerPlaylists,
	obtenerPlaylistPorId,
	obtenerCancionesDePlaylist,
	obtenerCancionesFueraDePlaylist,
	agregarCancionAPlaylist,
	quitarCancionesDePlaylist,
	actualizarPlaylist,
	borrarPlaylistLogico,
};
