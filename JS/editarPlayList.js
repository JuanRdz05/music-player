// JS/editarPlaylist.js

(function () {
	const { ipcRenderer, webUtils } = require("electron");
	const fs = require("fs");
	const path = require("path");
	const { pathToFileURL } = require("url");
	const formatTime = require("./JS/formatTime.js");

	// Misma lógica que home.js para resolver la portada guardada en disco
	const RUTA_DEFAULT = path.join(__dirname, "img", "default-playlist.png");
	const IMAGEN_DEFAULT = fs.existsSync(RUTA_DEFAULT)
		? pathToFileURL(RUTA_DEFAULT).href
		: "";

	function resolverImagenPlaylist(imagen) {
		if (!imagen) return IMAGEN_DEFAULT;
		if (
			imagen.startsWith("data:image") ||
			imagen.startsWith("http") ||
			imagen.startsWith("file:")
		) {
			return imagen;
		}
		const rutaAbsoluta = path.isAbsolute(imagen)
			? imagen
			: path.join(__dirname, imagen);

		try {
			if (fs.existsSync(rutaAbsoluta)) {
				return pathToFileURL(rutaAbsoluta).href;
			}
		} catch (e) {
			// ruta inválida, cae a la imagen por defecto
		}

		return IMAGEN_DEFAULT;
	}

	// ── Elementos del DOM ────────────────────────────────────────────────
	const overlay = document.getElementById("editPlaylistModalOverlay");
	const closeBtn = document.getElementById("closeEditPlaylistModalBtn");
	const titleEl = document.getElementById("editPlaylistTitle");
	const subtitleEl = document.getElementById("editPlaylistSubtitle");

	const step1 = document.getElementById("editPlaylistStep1");
	const step2 = document.getElementById("editPlaylistStep2");

	// Paso 1: datos de la playlist + quitar canciones
	const nameInput = document.getElementById("editPlaylistName");
	const imageInput = document.getElementById("editPlaylistImage");
	const imageDropZone = document.getElementById("editPlaylistImageDropZone");
	const imagePreviewWrapper = document.getElementById(
		"editPlaylistImagePreviewWrapper",
	);
	const saveInfoBtn = document.getElementById("saveEditPlaylistInfoBtn");

	const songListContainer = document.getElementById("editPlaylistSongList");
	const removeCountEl = document.getElementById("editPlaylistRemoveCount");
	const removeListContainer = document.getElementById("editPlaylistRemoveList");
	const confirmRemoveBtn = document.getElementById(
		"confirmRemoveFromPlaylistBtn",
	);
	const deletePlaylistBtn = document.getElementById("deletePlaylistBtn");
	const openAddStepBtn = document.getElementById("openAddSongToPlaylistBtn");

	// Paso 2: agregar canciones
	const backBtn = document.getElementById("backToEditPlaylistBtn");
	const addListContainer = document.getElementById("addToPlaylistList");
	const addSearchInput = document.getElementById("addToPlaylistSearch");
	const addCountEl = document.getElementById("editPlaylistAddCount");
	const addSelectedListContainer = document.getElementById(
		"editPlaylistAddSelectedList",
	);
	const confirmAddBtn = document.getElementById("confirmAddToPlaylistBtn");

	// ── Estado ───────────────────────────────────────────────────────────
	let playlistActualId = null;
	let cancionesEnPlaylist = [];
	let idsParaQuitar = new Set();

	let cancionesFueraDePlaylist = [];
	let idsParaAgregar = new Set();

	let rutaImagenNueva = null; // null = el usuario no cambió la portada

	// ── Paso 1: lista de canciones actuales de la playlist ─────────────────
	function renderPlaylistSongList() {
		songListContainer.innerHTML = "";

		if (cancionesEnPlaylist.length === 0) {
			songListContainer.innerHTML = `<p class="playlist-song-list-empty">Esta playlist todavía no tiene canciones.</p>`;
			return;
		}

		cancionesEnPlaylist.forEach((cancion) => {
			const item = document.createElement("div");
			item.classList.add("playlist-song-item");
			item.dataset.id = cancion.id;

			if (idsParaQuitar.has(cancion.id)) {
				item.classList.add("selected");
			}

			item.innerHTML = `
				<div class="playlist-song-thumb">
					<img src="${cancion.thumbnail}" alt="" />
				</div>
				<div class="playlist-song-info">
					<p class="playlist-song-name">${cancion.nombre}</p>
					<p class="playlist-song-artist">${cancion.artista || ""}</p>
				</div>
				<span class="playlist-song-duration">${formatTime(cancion.duration)}</span>
				<div class="playlist-song-check">
					<i class="fa-solid fa-check"></i>
				</div>
			`;

			item.addEventListener("click", () => {
				const id = cancion.id;
				if (idsParaQuitar.has(id)) {
					idsParaQuitar.delete(id);
					item.classList.remove("selected");
				} else {
					idsParaQuitar.add(id);
					item.classList.add("selected");
				}
				actualizarEstadoQuitar();
			});

			songListContainer.appendChild(item);
		});
	}

	function renderRemoveSelectedList() {
		removeListContainer.innerHTML = "";

		const seleccionadas = cancionesEnPlaylist.filter((c) =>
			idsParaQuitar.has(c.id),
		);

		if (seleccionadas.length === 0) {
			removeListContainer.innerHTML = `
				<div class="delete-selected-empty">
					<i class="fa-solid fa-check"></i>
					<p>Selecciona canciones para quitarlas</p>
					<span>Aquí aparecerán las canciones que elijas.</span>
				</div>
			`;
			return;
		}

		seleccionadas.forEach((cancion) => {
			const item = document.createElement("div");
			item.classList.add("delete-selected-item");
			item.dataset.id = cancion.id;

			item.innerHTML = `
				<div class="delete-selected-thumb">
					<img src="${cancion.thumbnail}" alt="" />
				</div>
				<div class="delete-selected-info">
					<p class="delete-selected-name">${cancion.nombre}</p>
					<p class="delete-selected-artist">${cancion.artista || ""}</p>
				</div>
				<button class="delete-selected-remove" type="button" title="Quitar de la selección">
					<i class="fa-solid fa-xmark"></i>
				</button>
			`;

			item
				.querySelector(".delete-selected-remove")
				.addEventListener("click", (event) => {
					event.stopPropagation();
					idsParaQuitar.delete(cancion.id);
					actualizarEstadoQuitar();
				});

			removeListContainer.appendChild(item);
		});
	}

	function actualizarEstadoQuitar() {
		const total = idsParaQuitar.size;
		confirmRemoveBtn.disabled = total === 0;
		removeCountEl.textContent =
			total === 0
				? "Ninguna canción seleccionada"
				: `${total} canción${total === 1 ? "" : "es"} seleccionada${total === 1 ? "" : "s"}`;

		renderPlaylistSongList();
		renderRemoveSelectedList();
	}

	// ── Paso 2: lista de canciones fuera de la playlist ─────────────────────
	function renderAddList(filtro = "") {
		addListContainer.innerHTML = "";
		const filtroNormalizado = filtro.trim().toLowerCase();

		const filtradas = cancionesFueraDePlaylist.filter((cancion) => {
			if (!filtroNormalizado) return true;
			return (
				cancion.nombre.toLowerCase().includes(filtroNormalizado) ||
				(cancion.artista || "").toLowerCase().includes(filtroNormalizado)
			);
		});

		if (filtradas.length === 0) {
			const vacio = document.createElement("p");
			vacio.classList.add("playlist-song-list-empty");
			vacio.textContent = cancionesFueraDePlaylist.length
				? "No se encontraron canciones."
				: "Ya agregaste todas las canciones de tu biblioteca.";
			addListContainer.appendChild(vacio);
			return;
		}

		filtradas.forEach((cancion) => {
			const item = document.createElement("div");
			item.classList.add("playlist-song-item");
			item.dataset.id = cancion.id;

			if (idsParaAgregar.has(cancion.id)) {
				item.classList.add("selected");
			}

			item.innerHTML = `
				<div class="playlist-song-thumb">
					<img src="${cancion.thumbnail}" alt="" />
				</div>
				<div class="playlist-song-info">
					<p class="playlist-song-name">${cancion.nombre}</p>
					<p class="playlist-song-artist">${cancion.artista || ""}</p>
				</div>
				<span class="playlist-song-duration">${formatTime(cancion.duration)}</span>
				<div class="playlist-song-check">
					<i class="fa-solid fa-check"></i>
				</div>
			`;

			item.addEventListener("click", () => {
				const id = cancion.id;
				if (idsParaAgregar.has(id)) {
					idsParaAgregar.delete(id);
					item.classList.remove("selected");
				} else {
					idsParaAgregar.add(id);
					item.classList.add("selected");
				}
				actualizarEstadoAgregar();
			});

			addListContainer.appendChild(item);
		});
	}

	function renderAddSelectedList() {
		addSelectedListContainer.innerHTML = "";

		const seleccionadas = cancionesFueraDePlaylist.filter((c) =>
			idsParaAgregar.has(c.id),
		);

		if (seleccionadas.length === 0) {
			addSelectedListContainer.innerHTML = `
				<div class="delete-selected-empty">
					<i class="fa-solid fa-check"></i>
					<p>Selecciona una o más canciones</p>
					<span>Aquí aparecerán las canciones que elijas.</span>
				</div>
			`;
			return;
		}

		seleccionadas.forEach((cancion) => {
			const item = document.createElement("div");
			item.classList.add("delete-selected-item");
			item.dataset.id = cancion.id;

			item.innerHTML = `
				<div class="delete-selected-thumb">
					<img src="${cancion.thumbnail}" alt="" />
				</div>
				<div class="delete-selected-info">
					<p class="delete-selected-name">${cancion.nombre}</p>
					<p class="delete-selected-artist">${cancion.artista || ""}</p>
				</div>
				<button class="delete-selected-remove" type="button" title="Quitar de la selección">
					<i class="fa-solid fa-xmark"></i>
				</button>
			`;

			item
				.querySelector(".delete-selected-remove")
				.addEventListener("click", (event) => {
					event.stopPropagation();
					idsParaAgregar.delete(cancion.id);
					actualizarEstadoAgregar();
				});

			addSelectedListContainer.appendChild(item);
		});
	}

	function actualizarEstadoAgregar() {
		const total = idsParaAgregar.size;
		confirmAddBtn.disabled = total === 0;
		addCountEl.textContent =
			total === 0
				? "Ninguna canción seleccionada"
				: `${total} canción${total === 1 ? "" : "es"} seleccionada${total === 1 ? "" : "s"}`;

		renderAddList(addSearchInput.value);
		renderAddSelectedList();
	}

	// ── Navegación entre pasos ─────────────────────────────────────────────
	async function irAPaso2() {
		step1.classList.add("hidden");
		step2.classList.remove("hidden");
		titleEl.textContent = "Agregar canciones";
		subtitleEl.textContent = "Busca y elige las canciones que quieras sumar";

		idsParaAgregar = new Set();
		addSearchInput.value = "";
		addListContainer.innerHTML = `<p class="playlist-song-list-empty">Cargando canciones...</p>`;

		try {
			cancionesFueraDePlaylist =
				(await ipcRenderer.invoke(
					"get-songs-not-in-playlist",
					playlistActualId,
				)) || [];
		} catch (error) {
			console.error("Error al cargar canciones para agregar:", error);
			cancionesFueraDePlaylist = [];
		}

		actualizarEstadoAgregar();
	}

	function volverAPaso1() {
		step2.classList.add("hidden");
		step1.classList.remove("hidden");
		titleEl.textContent = "Editar playlist";
		subtitleEl.textContent = "Modifica el nombre, la portada y las canciones";
	}

	// ── Abrir / cerrar el modal (punto de entrada desde home.js) ───────────
	async function abrirEditarPlaylist(playlistId) {
		playlistActualId = playlistId;

		// Reset general
		idsParaQuitar = new Set();
		idsParaAgregar = new Set();
		rutaImagenNueva = null;
		imageInput.value = "";

		volverAPaso1();
		songListContainer.innerHTML = `<p class="playlist-song-list-empty">Cargando canciones...</p>`;
		overlay.classList.add("active");

		try {
			const [playlist, cancionesPlaylist] = await Promise.all([
				ipcRenderer.invoke("get-playlist", playlistId),
				ipcRenderer.invoke("get-playlist-songs", playlistId),
			]);

			nameInput.value = playlist?.nombre || "";

			const imagenSrc = resolverImagenPlaylist(playlist?.imagen);
			imagePreviewWrapper.innerHTML = `
				<img src="${imagenSrc}" class="preview-img" alt="Portada" />
				<span class="drop-text">Portada actual</span>
			`;
			imageDropZone.classList.add("has-file");

			cancionesEnPlaylist = cancionesPlaylist || [];
		} catch (error) {
			console.error("Error al cargar la playlist para editar:", error);
			cancionesEnPlaylist = [];
		}

		actualizarEstadoQuitar();
	}

	function cerrarModal() {
		overlay.classList.remove("active");
	}

	// Exponemos la función para que home.js (o cualquier otra vista) pueda abrir el modal
	window.abrirEditarPlaylist = abrirEditarPlaylist;

	// ── Eventos ──────────────────────────────────────────────────────────
	if (closeBtn) closeBtn.addEventListener("click", cerrarModal);

	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) cerrarModal();
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && overlay.classList.contains("active")) {
			cerrarModal();
		}
	});

	openAddStepBtn.addEventListener("click", irAPaso2);
	backBtn.addEventListener("click", volverAPaso1);

	addSearchInput.addEventListener("input", () => {
		renderAddList(addSearchInput.value);
	});

	// Elegir una nueva portada (mismo método que playlist.js)
	imageInput.addEventListener("change", () => {
		const archivo = imageInput.files[0];
		if (!archivo) return;

		rutaImagenNueva = webUtils.getPathForFile(archivo);
		if (!rutaImagenNueva) {
			console.error("No se pudo obtener la ruta de la imagen.");
			return;
		}

		imagePreviewWrapper.innerHTML = `
			<img src="file://${rutaImagenNueva.replace(/\\/g, "/")}" class="preview-img" alt="Portada" />
			<span class="drop-text">${archivo.name}</span>
		`;
		imageDropZone.classList.add("has-file");
	});

	// Guardar nombre / portada
	saveInfoBtn.addEventListener("click", async () => {
		const nombre = nameInput.value.trim();
		if (!nombre) {
			await avisar({
				titulo: "Falta el nombre",
				mensaje: "Ponle un nombre a la playlist",
				tipo: "info",
			});
			return;
		}

		const textoOriginal = saveInfoBtn.innerHTML;
		saveInfoBtn.disabled = true;
		saveInfoBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;

		try {
			const resultado = await ipcRenderer.invoke("update-playlist", {
				id: playlistActualId,
				nombre,
				imagePath: rutaImagenNueva, // null si no se cambió
			});

			if (!resultado || !resultado.success) {
				await avisar({
					titulo: "No se pudo actualizar",
					mensaje:
						(resultado && resultado.error) ||
						"No se pudo actualizar la playlist",
					tipo: "peligro",
				});
				return;
			}

			rutaImagenNueva = null;

			if (typeof window.recargarPlaylists === "function") {
				window.recargarPlaylists();
			}
		} catch (error) {
			console.error("Error al actualizar la playlist:", error);
			await avisar({
				titulo: "Error",
				mensaje: "Ocurrió un error al guardar los cambios",
				tipo: "peligro",
			});
		} finally {
			saveInfoBtn.innerHTML = textoOriginal;
			// Se bloqueó arriba mientras guardaba; hay que volver a habilitarlo
			saveInfoBtn.disabled = false;
		}
	});

	// Quitar canciones de la playlist
	confirmRemoveBtn.addEventListener("click", async () => {
		const total = idsParaQuitar.size;
		if (total === 0) return;

		const confirmado = await confirmar({
			titulo: "Quitar de la playlist",
			mensaje: `¿Quitar ${total} canción${total === 1 ? "" : "es"} de esta playlist? (la canción seguirá en tu biblioteca)`,
			textoConfirmar: "Quitar",
			tipo: "peligro",
		});
		if (!confirmado) return;

		const idsArray = Array.from(idsParaQuitar);
		const textoOriginal = confirmRemoveBtn.innerHTML;
		confirmRemoveBtn.disabled = true;
		confirmRemoveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Quitando...`;

		try {
			const resultado = await ipcRenderer.invoke("remove-songs-from-playlist", {
				playlistId: playlistActualId,
				cancionIds: idsArray,
			});

			if (!resultado || !resultado.success) {
				await avisar({
					titulo: "No se pudieron quitar",
					mensaje:
						(resultado && resultado.error) ||
						"No se pudieron quitar las canciones",
					tipo: "peligro",
				});
				return;
			}

			idsParaQuitar = new Set();
			cancionesEnPlaylist = cancionesEnPlaylist.filter(
				(c) => !idsArray.includes(c.id),
			);

			if (typeof window.recargarPlaylists === "function") {
				window.recargarPlaylists();
			}
		} catch (error) {
			console.error("Error al quitar canciones de la playlist:", error);
			await avisar({
				titulo: "Error",
				mensaje: "Ocurrió un error al quitar las canciones",
				tipo: "peligro",
			});
		} finally {
			confirmRemoveBtn.innerHTML = textoOriginal;
			actualizarEstadoQuitar();
		}
	});

	// Eliminar la playlist completa (borrado lógico)
	deletePlaylistBtn.addEventListener("click", async () => {
		const nombreActual = nameInput.value.trim() || "esta playlist";
		const confirmado = await confirmar({
			titulo: "Eliminar playlist",
			mensaje: `¿Eliminar "${nombreActual}"? Las canciones que contiene no se borrarán de tu biblioteca.`,
			textoConfirmar: "Eliminar",
			tipo: "peligro",
		});
		if (!confirmado) return;

		const textoOriginal = deletePlaylistBtn.innerHTML;
		deletePlaylistBtn.disabled = true;
		deletePlaylistBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Eliminando...`;

		try {
			const resultado = await ipcRenderer.invoke(
				"delete-playlist",
				playlistActualId,
			);

			if (!resultado || !resultado.success) {
				await avisar({
					titulo: "No se pudo eliminar",
					mensaje:
						(resultado && resultado.error) || "No se pudo eliminar la playlist",
					tipo: "peligro",
				});
				return;
			}

			cerrarModal();

			if (typeof window.recargarPlaylists === "function") {
				window.recargarPlaylists();
			}
		} catch (error) {
			console.error("Error al eliminar la playlist:", error);
			await avisar({
				titulo: "Error",
				mensaje: "Ocurrió un error al eliminar la playlist",
				tipo: "peligro",
			});
		} finally {
			deletePlaylistBtn.innerHTML = textoOriginal;
			deletePlaylistBtn.disabled = false;
		}
	});

	// Agregar canciones a la playlist
	confirmAddBtn.addEventListener("click", async () => {
		const total = idsParaAgregar.size;
		if (total === 0) return;

		const idsArray = Array.from(idsParaAgregar);
		const textoOriginal = confirmAddBtn.innerHTML;
		confirmAddBtn.disabled = true;
		confirmAddBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Agregando...`;

		try {
			for (const cancionId of idsArray) {
				await ipcRenderer.invoke("add-song-to-playlist", {
					playlistId: playlistActualId,
					cancionId,
				});
			}

			// Actualizamos la lista de canciones de la playlist para el paso 1
			cancionesEnPlaylist =
				(await ipcRenderer.invoke("get-playlist-songs", playlistActualId)) ||
				[];

			if (typeof window.recargarPlaylists === "function") {
				window.recargarPlaylists();
			}

			volverAPaso1();
			actualizarEstadoQuitar();
		} catch (error) {
			console.error("Error al agregar canciones a la playlist:", error);
			await avisar({
				titulo: "Error",
				mensaje: "Ocurrió un error al agregar las canciones",
				tipo: "peligro",
			});
		} finally {
			confirmAddBtn.innerHTML = textoOriginal;
			actualizarEstadoAgregar();
		}
	});
})();
