const { app } = require("electron");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(app.getPath("userData"), "reproductor.db");

const db = new Database(dbPath, { verbose: console.log });

// SQLite no valida FOREIGN KEY / ON DELETE CASCADE a menos que lo actives
db.pragma("foreign_keys = ON");

// =========================================================================
// Si quieres borrar todos los datos y reiniciar las tablas desde cero,
// quita las dos diagonales "//" de las siguientes 3 líneas, ejecuta tu app
// una vez para que se borre todo, y luego vuelve a comentarlas.
// =========================================================================
// db.exec("DROP TABLE IF EXISTS playlist_canciones;");
// db.exec("DROP TABLE IF EXISTS playlist;");
// db.exec("DROP TABLE IF EXISTS songs;");

// Creación de tablas con Borrado Lógico
db.exec(`
	CREATE TABLE IF NOT EXISTS songs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		nombre TEXT NOT NULL,
		artista TEXT NOT NULL,
		archivo TEXT NOT NULL UNIQUE,
		imagen TEXT,
		thumbnail TEXT,
		duration REAL NOT NULL,
		es_favorito BOOLEAN DEFAULT 0,
		lyrics TEXT,
		lyricsTimed TEXT,
		eliminado BOOLEAN DEFAULT 0 -- 1 significa que está "borrada"
	);

	CREATE TABLE IF NOT EXISTS playlist (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		nombre TEXT NOT NULL,
		imagen TEXT,
		eliminado BOOLEAN DEFAULT 0 -- 1 significa que está "borrada"
	);

	CREATE TABLE IF NOT EXISTS playlist_canciones (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		playlist_id INTEGER NOT NULL,
		cancion_id INTEGER NOT NULL,
		FOREIGN KEY (playlist_id) REFERENCES playlist(id) ON DELETE CASCADE,
		FOREIGN KEY (cancion_id) REFERENCES songs(id) ON DELETE CASCADE,
		UNIQUE(playlist_id, cancion_id)
	);
`);

console.log("Base de datos lista en:", dbPath);

// Moviendo el SELECT aquí abajo aseguramos que las tablas ya existan
const result = db.prepare("SELECT id, nombre, artista FROM songs").all();
console.log(result);

module.exports = db;
