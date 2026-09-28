/**
 * modal-agregar-cancion.js
 *
 * Lógica del modal de dos paneles:
 *  - Columna izquierda: formulario (audio, imagen, título, artista)
 *  - Columna derecha:   preview de letra + opciones guardar/ignorar
 *
 * Se envuelve en IIFE para no colisionar con las declaraciones de
 * renderer.js (mismo contexto global en Electron con nodeIntegration:true).
 */

(function () {
	const _ipc = require("electron").ipcRenderer;
	const _webUtils = require("electron").webUtils;
	const _path = require("path");
	const _fs = require("fs");
	const _getMP3Duration = require("get-mp3-duration");

	// ─── Referencias al DOM ────────────────────────────────────────────────

	const addSongModalOverlay = document.getElementById("addSongModalOverlay");
	const openAddSongModalBtn = document.getElementById("openAddSongModalBtn");
	const closeAddSongModalBtn = document.getElementById("closeAddSongModalBtn");

	// Formulario
	const audioFileInput = document.getElementById("audio-file");
	const imageFileInput = document.getElementById("image-file");
	const songTitleInput = document.getElementById("song-title");
	const songArtistInput = document.getElementById("song-artist");
	const audioDropZone = document.getElementById("audioDropZone");
	const imageDropZone = document.getElementById("imageDropZone");
	const audioFileNameEl = document.getElementById("audioFileName");
	const imageFileNameEl = document.getElementById("imageFileName");
	const imagePreviewWrapper = document.getElementById("imagePreviewWrapper");
	const saveSongBtn = document.getElementById("saveSongBtn");

	// Columna de letra
	const searchLyricsBtn = document.getElementById("searchLyricsBtn");
	const lyricsPlaceholder = document.getElementById("lyricsPlaceholder");
	const lyricsLoading = document.getElementById("lyricsLoading");
	const lyricsResult = document.getElementById("lyricsResult");
	const lyricsPreviewText = document.getElementById("lyricsPreviewText");
	const lyricsNotFound = document.getElementById("lyricsNotFound");
	const lyricsNotFoundMsg = document.getElementById("lyricsNotFoundMsg");
	const lyricsActions = document.getElementById("lyricsActions");
	const lyricsStatusBadge = document.getElementById("lyricsStatusBadge");
	const lyricsStatusText = document.getElementById("lyricsStatusText");
	const acceptLyricsBtn = document.getElementById("acceptLyricsBtn");
	const skipLyricsBtn = document.getElementById("skipLyricsBtn");

	// ─── Estado interno ────────────────────────────────────────────────────

	let audioPath = null;
	let imagePath = null;
	let audioDuration = 0;
	let lyricsData = null;
	let lyricsDecision = null; // 'accept' | 'skip' | null

	// Contenido normal del botón "Guardar canción". Se captura UNA sola vez,
	// al cargar el script, para poder restaurarlo siempre igual.
	const HTML_GUARDAR = saveSongBtn.innerHTML;
	let timerErrorGuardar = null;

	// ─── Helpers de UI ─────────────────────────────────────────────────────

	function showLyricsState(state) {
		lyricsPlaceholder.classList.add("hidden");
		lyricsLoading.classList.add("hidden");
		lyricsResult.classList.add("hidden");
		lyricsNotFound.classList.add("hidden");

		if (state === "placeholder") lyricsPlaceholder.classList.remove("hidden");
		else if (state === "loading") lyricsLoading.classList.remove("hidden");
		else if (state === "result") lyricsResult.classList.remove("hidden");
		else if (state === "not-found") lyricsNotFound.classList.remove("hidden");
	}

	function actualizarBuscarLetraBtn() {
		const titulo = songTitleInput.value.trim();
		const artista = songArtistInput.value.trim();
		searchLyricsBtn.disabled = !(titulo && artista);
	}

	function actualizarGuardarBtn() {
		const titulo = songTitleInput.value.trim();
		const artista = songArtistInput.value.trim();
		const tieneArchivo = audioPath !== null;
		const tieneImagen = imagePath !== null;
		const tieneDecision = lyricsDecision !== null;
		saveSongBtn.disabled = !(
			titulo &&
			artista &&
			tieneArchivo &&
			tieneImagen &&
			tieneDecision
		);
	}

	// Devuelve el botón a su texto normal y recalcula si debe estar habilitado.
	function restaurarBotonGuardar() {
		clearTimeout(timerErrorGuardar);
		saveSongBtn.innerHTML = HTML_GUARDAR;
		actualizarGuardarBtn();
	}

	function marcarDecisionLetra(decision) {
		lyricsDecision = decision;
		acceptLyricsBtn.classList.toggle("active", decision === "accept");
		skipLyricsBtn.classList.toggle("active", decision === "skip");
		actualizarGuardarBtn();
	}

	function resetearLetra() {
		lyricsData = null;
		lyricsDecision = null;
		showLyricsState("placeholder");

		lyricsActions.classList.remove("hidden");
		lyricsStatusBadge.classList.add("hidden");
		acceptLyricsBtn.classList.add("hidden");

		acceptLyricsBtn.classList.remove("active");
		skipLyricsBtn.classList.remove("active");
	}

	// ─── Abrir / cerrar modal ──────────────────────────────────────────────

	function abrirAddSongModal() {
		addSongModalOverlay.classList.add("active");
	}

	function cerrarAddSongModal() {
		addSongModalOverlay.classList.remove("active");
	}

	function resetearModal() {
		audioPath = null;
		imagePath = null;
		audioDuration = 0;

		audioFileInput.value = "";
		imageFileInput.value = "";
		songTitleInput.value = "";
		songArtistInput.value = "";

		audioFileNameEl.textContent = "Selecciona un MP3";
		imageFileNameEl.textContent = "Selecciona una imagen";
		audioDropZone.classList.remove("has-file");
		imageDropZone.classList.remove("has-file");

		// Eliminar imagen preview si existía y restaurar ícono
		const existingImg = imagePreviewWrapper.querySelector(".preview-img");
		if (existingImg) existingImg.remove();
		const iconEl = imagePreviewWrapper.querySelector(".drop-icon");
		if (!iconEl) {
			const i = document.createElement("i");
			i.className = "fa-solid fa-image drop-icon";
			imagePreviewWrapper.insertBefore(i, imageFileNameEl);
		}

		resetearLetra();
		actualizarBuscarLetraBtn();
		restaurarBotonGuardar();
	}

	// ─── Manejo de archivos ────────────────────────────────────────────────

	audioFileInput.addEventListener("change", () => {
		const file = audioFileInput.files[0];
		if (!file) return;

		audioPath = _webUtils ? _webUtils.getPathForFile(file) : file.path;
		if (!audioPath) {
			console.error(
				"No se pudo obtener la ruta del archivo. ¿La app tiene permisos?",
			);
			return;
		}

		audioFileNameEl.textContent = file.name;
		audioDropZone.classList.add("has-file");

		// Calcular duración del MP3
		try {
			const buffer = _fs.readFileSync(audioPath);
			audioDuration = _getMP3Duration(buffer) / 1000;
		} catch (err) {
			console.error("Error al leer duración del MP3:", err);
			audioDuration = 0;
		}

		// Auto-rellenar título si está vacío
		if (!songTitleInput.value.trim()) {
			const nombre = _path.basename(file.name, _path.extname(file.name));
			songTitleInput.value = nombre;
		}

		resetearLetra();
		actualizarBuscarLetraBtn();
		actualizarGuardarBtn();
	});

	imageFileInput.addEventListener("change", () => {
		const file = imageFileInput.files[0];
		if (!file) return;

		imagePath = _webUtils ? _webUtils.getPathForFile(file) : file.path;
		if (!imagePath) {
			console.error("No se pudo obtener la ruta de la imagen.");
			return;
		}

		imageDropZone.classList.add("has-file");

		// Eliminar ícono previo
		const existingImg = imagePreviewWrapper.querySelector(".preview-img");
		if (existingImg) existingImg.remove();
		const iconEl = imagePreviewWrapper.querySelector(".drop-icon");
		if (iconEl) iconEl.remove();

		// Insertar preview de imagen
		const img = document.createElement("img");
		img.className = "preview-img";
		img.src = `file://${imagePath.replace(/\\/g, "/")}`;
		img.alt = "Preview";
		imagePreviewWrapper.insertBefore(img, imageFileNameEl);
		imageFileNameEl.textContent = file.name;

		actualizarGuardarBtn();
	});

	// ─── Inputs de texto → habilitar botones ──────────────────────────────

	songTitleInput.addEventListener("input", () => {
		actualizarBuscarLetraBtn();
		if (lyricsData) resetearLetra();
		actualizarGuardarBtn();
	});

	songArtistInput.addEventListener("input", () => {
		actualizarBuscarLetraBtn();
		if (lyricsData) resetearLetra();
		actualizarGuardarBtn();
	});

	// ─── Buscar letra ──────────────────────────────────────────────────────

	searchLyricsBtn.addEventListener("click", async () => {
		const nombre = songTitleInput.value.trim();
		const artista = songArtistInput.value.trim();
		if (!nombre || !artista) return;

		showLyricsState("loading");
		lyricsActions.classList.add("hidden");
		lyricsData = null;
		lyricsDecision = null;
		acceptLyricsBtn.classList.remove("active");
		skipLyricsBtn.classList.remove("active");

		try {
			const resultado = await _ipc.invoke("get-lyrics", {
				nombre,
				artista,
				duration: audioDuration || undefined,
			});

			lyricsData = resultado;

			if (!resultado.found) {
				lyricsNotFoundMsg.textContent = resultado.error
					? "Error al conectar con la API de letras"
					: "No se encontró la letra para esta canción";

				showLyricsState("not-found");
				lyricsStatusBadge.className = "lyrics-status-badge not-found";
				lyricsStatusBadge.classList.remove("hidden");
				lyricsStatusText.textContent = "Sin letra disponible";
				lyricsStatusBadge.querySelector("i").className =
					"fa-solid fa-circle-xmark";
				lyricsStatusBadge.querySelector("i").style.color = "var(--rojo)";

				lyricsActions.classList.remove("hidden");
				acceptLyricsBtn.classList.add("hidden");
				marcarDecisionLetra("skip");
				return;
			}

			// Letra encontrada → restaurar botón aceptar si estaba oculto
			lyricsStatusBadge.classList.remove("hidden");
			acceptLyricsBtn.classList.remove("hidden");

			if (resultado.instrumental) {
				lyricsNotFoundMsg.textContent = "Esta canción es instrumental 🎵";
				showLyricsState("not-found");
				lyricsStatusBadge.className = "lyrics-status-badge";
				lyricsStatusText.textContent = "Instrumental";
				lyricsStatusBadge.querySelector("i").className = "fa-solid fa-music";
				lyricsStatusBadge.querySelector("i").style.color = "#a0a0a0";
				lyricsData.syncedLyrics = null;
				lyricsData.plainLyrics = null;
				lyricsActions.classList.remove("hidden");
				acceptLyricsBtn.classList.add("hidden");
				marcarDecisionLetra("skip");
				return;
			}

			const textoPreview =
				resultado.syncedLyrics || resultado.plainLyrics || "";
			lyricsPreviewText.textContent = textoPreview;
			showLyricsState("result");

			lyricsStatusBadge.className = "lyrics-status-badge";
			lyricsStatusText.textContent = resultado.syncedLyrics
				? "Letra sincronizada encontrada"
				: "Letra encontrada";
			lyricsStatusBadge.querySelector("i").className =
				"fa-solid fa-check-circle";
			lyricsStatusBadge.querySelector("i").style.color = "#4caf50";

			lyricsActions.classList.remove("hidden");
			marcarDecisionLetra("accept");
		} catch (err) {
			console.error("Error buscando letra:", err);
			lyricsNotFoundMsg.textContent = "Error al buscar la letra";
			showLyricsState("not-found");
			lyricsStatusBadge.classList.remove("hidden");
			lyricsActions.classList.remove("hidden");
			marcarDecisionLetra("skip");
		}
	});

	// ─── Decisión sobre la letra ───────────────────────────────────────────

	acceptLyricsBtn.addEventListener("click", () =>
		marcarDecisionLetra("accept"),
	);
	skipLyricsBtn.addEventListener("click", () => marcarDecisionLetra("skip"));

	// ─── Guardar canción ───────────────────────────────────────────────────

	saveSongBtn.addEventListener("click", async () => {
		const nombre = songTitleInput.value.trim();
		const artista = songArtistInput.value.trim();
		if (!nombre || !artista || !audioPath) return;

		saveSongBtn.disabled = true;
		saveSongBtn.innerHTML =
			'<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

		try {
			let lyrics = null;
			let lyricsTimed = null;

			if (lyricsDecision === "accept" && lyricsData && lyricsData.found) {
				lyrics = lyricsData.plainLyrics ?? null;
				lyricsTimed = lyricsData.syncedLyrics ?? null;
			}

			const resultado = await _ipc.invoke("add-song", {
				nombre,
				artista,
				audioPath,
				imagePath,
				duration: audioDuration,
				lyrics,
				lyricsTimed,
			});

			if (resultado.success) {
				cerrarAddSongModal();
				resetearModal();
				if (typeof window.recargarCanciones === "function") {
					window.recargarCanciones();
				}
			} else {
				console.error("Error al guardar canción:", resultado.error);
				saveSongBtn.innerHTML =
					'<i class="fa-solid fa-triangle-exclamation"></i> ' +
					(resultado.error || "Error al guardar");
				timerErrorGuardar = setTimeout(restaurarBotonGuardar, 3000);
			}
		} catch (err) {
			console.error("Error IPC add-song:", err);
			saveSongBtn.innerHTML =
				'<i class="fa-solid fa-triangle-exclamation"></i> Error';
			timerErrorGuardar = setTimeout(restaurarBotonGuardar, 3000);
		}
	});

	// ─── Eventos de apertura / cierre ─────────────────────────────────────

	openAddSongModalBtn.addEventListener("click", abrirAddSongModal);

	closeAddSongModalBtn.addEventListener("click", () => {
		cerrarAddSongModal();
		resetearModal();
	});

	addSongModalOverlay.addEventListener("click", (e) => {
		if (e.target === addSongModalOverlay) {
			cerrarAddSongModal();
			resetearModal();
		}
	});

	document.addEventListener("keydown", (e) => {
		if (
			e.key === "Escape" &&
			addSongModalOverlay.classList.contains("active")
		) {
			cerrarAddSongModal();
			resetearModal();
		}
	});

	// Inicializar estado del modal
	resetearModal();
})();
