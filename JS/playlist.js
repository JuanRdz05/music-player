// JS/playlist.js
//
// Todo el archivo va envuelto en un IIFE para no declarar variables en el
// scope global: los <script> de este proyecto no son módulos y comparten
// el mismo scope global entre ellos, así que un "const" repetido en dos
// archivos (por ejemplo "formatTime") rompería al otro script con un
// SyntaxError. Con el IIFE evitamos ese problema.
(function () {
	// Igual que en renderer.js: con nodeIntegration activado no hace falta
	// pasar por window.music/window.playlists (el preload de este proyecto
	// no se está cargando actualmente, ver nota al final del archivo),
	// así que hablamos con el proceso principal directamente por IPC.
	//
	// webUtils.getPathForFile(): en Electron moderno File.path ya no existe;
	// esta es la forma oficial de obtener la ruta real de un archivo
	// elegido con <input type="file">. Es el MISMO método que usa
	// modal-agregar-cancion.js para las portadas de las canciones.
	const { ipcRenderer, webUtils } = require("electron");
	const formatTime = require("./JS/formatTime.js");

	// Botón del sidebar que abre el modal
	const openAddPlaylistBtn = document.getElementById("openAddPlaylistBtn");

	// Elementos del modal "Agregar playlist"
	const overlay = document.getElementById("addPlaylistModalOverlay");
	const closeBtn = document.getElementById("closeAddPlaylistModalBtn");
	const nameInput = document.getElementById("playlist-name");
	const imageInput = document.getElementById("playlist-image");
	const imageDropZone = document.getElementById("playlistImageDropZone");
	const imagePreviewWrapper = document.getElementById(
		"playlistImagePreviewWrapper",
	);
	const songListContainer = document.getElementById("playlistSongList");
	const songSearchInput = document.getElementById("playlistSongSearch");
	const selectedCountEl = document.getElementById("playlistSelectedCount");
	const saveBtn = document.getElementById("savePlaylistBtn");

	let cancionesDisponibles = [];
	let idsSeleccionados = new Set();
	let rutaImagenPortada = null; // ruta REAL en disco (no Base64)

	const previewVacio = `
		<i class="fa-solid fa-image drop-icon"></i>
		<span class="drop-text">Selecciona una imagen</span>
	`;

	function actualizarEstadoGuardar() {
		const nombreValido = nameInput.value.trim().length > 0;
		saveBtn.disabled = !(nombreValido && idsSeleccionados.size > 0);

		const total = idsSeleccionados.size;
		selectedCountEl.textContent =
			total === 0
				? "Ninguna canción seleccionada"
				: `${total} canción${total === 1 ? "" : "es"} seleccionada${total === 1 ? "" : "s"}`;
	}

	function renderSongList(filtro = "") {
		songListContainer.innerHTML = "";
		const filtroNormalizado = filtro.trim().toLowerCase();

		const cancionesFiltradas = cancionesDisponibles.filter((cancion) => {
			if (!filtroNormalizado) return true;
			return (
				cancion.nombre.toLowerCase().includes(filtroNormalizado) ||
				(cancion.artista || "").toLowerCase().includes(filtroNormalizado)
			);
		});

		if (cancionesFiltradas.length === 0) {
			const vacio = document.createElement("p");
			vacio.classList.add("playlist-song-list-empty");
			vacio.textContent = cancionesDisponibles.length
				? "No se encontraron canciones."
				: "Todavía no tienes canciones en tu biblioteca.";
			songListContainer.appendChild(vacio);
			return;
		}

		cancionesFiltradas.forEach((cancion) => {
			const item = document.createElement("div");
			item.classList.add("playlist-song-item");
			item.dataset.id = cancion.id;

			if (idsSeleccionados.has(cancion.id)) {
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
				if (idsSeleccionados.has(id)) {
					idsSeleccionados.delete(id);
					item.classList.remove("selected");
				} else {
					idsSeleccionados.add(id);
					item.classList.add("selected");
				}
				actualizarEstadoGuardar();
			});

			songListContainer.appendChild(item);
		});
	}

	function resetFormulario() {
		nameInput.value = "";
		idsSeleccionados = new Set();
		rutaImagenPortada = null;
		imageInput.value = "";
		imagePreviewWrapper.innerHTML = previewVacio;
		imageDropZone.classList.remove("has-file");
		songSearchInput.value = "";
	}

	async function abrirModal() {
		resetFormulario();

		songListContainer.innerHTML = `<p class="playlist-song-list-empty">Cargando canciones...</p>`;
		overlay.classList.add("active");

		try {
			cancionesDisponibles = (await ipcRenderer.invoke("get-songs")) || [];
		} catch (error) {
			console.error("Error al cargar canciones para la playlist:", error);
			cancionesDisponibles = [];
		}

		renderSongList();
		actualizarEstadoGuardar();
	}

	function cerrarModal() {
		overlay.classList.remove("active");
	}

	openAddPlaylistBtn.addEventListener("click", abrirModal);
	closeBtn.addEventListener("click", cerrarModal);

	// Cerrar haciendo clic fuera del modal (en el fondo oscuro)
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) cerrarModal();
	});

	// Cerrar con la tecla Escape, solo si el modal está abierto
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && overlay.classList.contains("active")) {
			cerrarModal();
		}
	});

	nameInput.addEventListener("input", actualizarEstadoGuardar);

	songSearchInput.addEventListener("input", () => {
		renderSongList(songSearchInput.value);
	});

	// Preview de la portada + guardar la RUTA REAL del archivo.
	// ANTES guardábamos un Base64 en "imagen", pero main.js espera
	// "imagePath" (una ruta de disco) para copiar el archivo a
	// img/playlists/. Ahora usamos el mismo método que
	// modal-agregar-cancion.js: webUtils.getPathForFile().
	imageInput.addEventListener("change", () => {
		const archivo = imageInput.files[0];
		if (!archivo) return;

		rutaImagenPortada = webUtils.getPathForFile(archivo);
		if (!rutaImagenPortada) {
			console.error("No se pudo obtener la ruta de la imagen.");
			return;
		}

		imagePreviewWrapper.innerHTML = `
			<img src="file://${rutaImagenPortada.replace(/\\/g, "/")}" class="preview-img" alt="Portada" />
			<span class="drop-text">${archivo.name}</span>
		`;
		imageDropZone.classList.add("has-file");
	});

	// Guardar la playlist
	saveBtn.addEventListener("click", async () => {
		const nombre = nameInput.value.trim();
		if (!nombre || idsSeleccionados.size === 0) return;

		const textoOriginal = saveBtn.innerHTML;
		saveBtn.disabled = true;
		saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;

		try {
			// main.js (create-playlist) espera el campo "imagePath" con la
			// ruta real del archivo; copia la imagen a img/playlists/ y
			// guarda la ruta relativa en la base de datos.
			const resultado = await ipcRenderer.invoke("create-playlist", {
				nombre: nombre,
				imagePath: rutaImagenPortada,
				cancionIds: Array.from(idsSeleccionados),
			});

			if (!resultado || !resultado.success) {
				alert(
					(resultado && resultado.error) || "No se pudo guardar la playlist",
				);
				return;
			}

			cerrarModal();

			if (typeof window.recargarPlaylists === "function") {
				window.recargarPlaylists();
			}
		} catch (error) {
			console.error("Error al guardar la playlist:", error);
			alert("Ocurrió un error al guardar la playlist");
		} finally {
			saveBtn.innerHTML = textoOriginal;
			actualizarEstadoGuardar();
		}
	});
})();
