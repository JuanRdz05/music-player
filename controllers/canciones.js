const db = require("../database/conexion.js");

function obtenerTodasLasCanciones() {
	return db
		.prepare("SELECT * FROM songs WHERE eliminado = 0 order by id")
		.all();
}

function obtenerCancionPorId(id) {
	return db.prepare("SELECT * FROM songs WHERE id = ?").get(id);
}

// function agregarCancion({
// 	nombre,
// 	artista,
// 	archivo,
// 	imagen,
// 	thumbnail,
// 	duration,
// 	lyrics,
// 	lyricsTimed,
// }) {
// 	const stmt = db.prepare(`
// 		INSERT OR IGNORE INTO songs
// 			(nombre, artista, archivo, imagen, thumbnail, duration, lyrics, lyricsTimed)
// 		VALUES
// 			(@nombre, @artista, @archivo, @imagen, @thumbnail, @duration, @lyrics, @lyricsTimed)
// 	`);

// 	return stmt.run({
// 		nombre,
// 		artista,
// 		archivo,
// 		imagen,
// 		thumbnail,
// 		duration,
// 		lyrics,
// 		lyricsTimed,
// 	});
// }

function agregarCancion({
	nombre,
	artista,
	archivo,
	imagen,
	thumbnail,
	duration,
	lyrics,
	lyricsTimed,
}) {
	// Primero buscamos si la canción ya existe
	const cancionExistente = db
		.prepare("SELECT id, eliminado FROM songs WHERE archivo = ?")
		.get(archivo);

	// Si existe pero estaba eliminada, la restauramos
	if (cancionExistente && cancionExistente.eliminado === 1) {
		const stmt = db.prepare(`
			UPDATE songs
			SET
				nombre = @nombre,
				artista = @artista,
				imagen = @imagen,
				thumbnail = @thumbnail,
				duration = @duration,
				lyrics = @lyrics,
				lyricsTimed = @lyricsTimed,
				eliminado = 0
			WHERE id = @id
		`);

		const resultado = stmt.run({
			id: cancionExistente.id,
			nombre,
			artista,
			imagen,
			thumbnail,
			duration,
			lyrics,
			lyricsTimed,
		});

		return {
			...resultado,
			lastInsertRowid: cancionExistente.id,
		};
	}

	// Si existe y NO está eliminada, no hacemos nada
	if (cancionExistente) {
		return {
			changes: 0,
			lastInsertRowid: cancionExistente.id,
		};
	}

	// Si no existe, la insertamos normalmente
	const stmt = db.prepare(`
		INSERT INTO songs
			(nombre, artista, archivo, imagen, thumbnail, duration, lyrics, lyricsTimed)
		VALUES
			(@nombre, @artista, @archivo, @imagen, @thumbnail, @duration, @lyrics, @lyricsTimed)
	`);

	return stmt.run({
		nombre,
		artista,
		archivo,
		imagen,
		thumbnail,
		duration,
		lyrics,
		lyricsTimed,
	});
}

//Modificar una cancion
function actualizarCancion({
	id,
	nombre,
	artista,
	archivo,
	imagen,
	thumbnail,
	duration,
	lyrics,
	lyricsTimed,
}) {
	const stmt = db.prepare(`
		UPDATE songs
		SET 
			nombre = @nombre,
			artista = @artista,
			archivo = @archivo,
			imagen = @imagen,
			thumbnail = @thumbnail,
			duration = @duration,
			lyrics = @lyrics,
			lyricsTimed = @lyricsTimed
		WHERE id = @id
	`);

	return stmt.run({
		id,
		nombre,
		artista,
		archivo,
		imagen,
		thumbnail,
		duration,
		lyrics,
		lyricsTimed,
	});
}

//Eliminar una canción
function borrarCancionesLogico(ids) {
	const placeholders = ids.map(() => "?").join(",");
	const stmt = db.prepare(
		`UPDATE songs SET eliminado = 1 WHERE id IN (${placeholders})`,
	);
	return stmt.run(...ids);
}

module.exports = {
	obtenerTodasLasCanciones,
	obtenerCancionPorId,
	agregarCancion,
	actualizarCancion,
	borrarCancionesLogico,
};

//MODIFICAR TABLA DE CANCIONES

// try {
// } catch (error) {
// 	console.log("Error al mostrar la tabla de las canciones:", error);
// }
