// JS/modal-eliminar-cancion.js
(function () {
	const { ipcRenderer } = require("electron");
	const formatTime = require("./JS/formatTime.js");

	const openBtn = document.getElementById("eliminar-canciones");
	const overlay = document.getElementById("deleteSongModalOverlay");
	const closeBtn = document.getElementById("closeDeleteSongModalBtn");
	const songListContainer = document.getElementById("deleteSongList");
	const songSearchInput = document.getElementById("deleteSongSearch");
	const selectedCountEl = document.getElementById("deleteSelectedCount");
	const confirmDeleteBtn = document.getElementById("confirmDeleteSongsBtn");
	const selectedListContainer = document.getElementById("deleteSelectedList");

	let cancionesDisponibles = [];
	let idsSeleccionados = new Set();

	function actualizarEstadoBoton() {
		const total = idsSeleccionados.size;

		confirmDeleteBtn.disabled = total === 0;

		selectedCountEl.textContent =
			total === 0
				? "Ninguna canción seleccionada"
				: `${total} canción${total === 1 ? "" : "es"} seleccionada${total === 1 ? "" : "s"}`;

		renderSelectedSongs();
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
				: "No hay canciones activas en tu biblioteca.";
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
				actualizarEstadoBoton();
			});

			songListContainer.appendChild(item);
		});
	}

	function renderSelectedSongs() {
		selectedListContainer.innerHTML = "";

		const cancionesSeleccionadas = cancionesDisponibles.filter((cancion) =>
			idsSeleccionados.has(cancion.id),
		);

		if (cancionesSeleccionadas.length === 0) {
			selectedListContainer.innerHTML = `
			<div class="delete-selected-empty">
				<i class="fa-solid fa-check"></i>

				<p>Selecciona una o más canciones</p>

				<span>
					Aquí aparecerán las canciones que elijas.
				</span>
			</div>
		`;

			return;
		}

		cancionesSeleccionadas.forEach((cancion) => {
			const item = document.createElement("div");
			item.classList.add("delete-selected-item");
			item.dataset.id = cancion.id;

			item.innerHTML = `
			<div class="delete-selected-thumb">
				<img
					src="${cancion.thumbnail}"
					alt=""
				/>
			</div>

			<div class="delete-selected-info">
				<p class="delete-selected-name">
					${cancion.nombre}
				</p>

				<p class="delete-selected-artist">
					${cancion.artista || ""}
				</p>
			</div>

			<button
				class="delete-selected-remove"
				type="button"
				title="Quitar de la selección"
			>
				<i class="fa-solid fa-xmark"></i>
			</button>
		`;

			item
				.querySelector(".delete-selected-remove")
				.addEventListener("click", (event) => {
					event.stopPropagation();

					idsSeleccionados.delete(cancion.id);

					actualizarEstadoBoton();
					renderSongList(songSearchInput.value);
					renderSelectedSongs();
				});

			selectedListContainer.appendChild(item);
		});
	}

	function resetModal() {
		idsSeleccionados = new Set();
		songSearchInput.value = "";
		actualizarEstadoBoton();
	}

	async function abrirModal() {
		resetModal();
		songListContainer.innerHTML = `<p class="playlist-song-list-empty">Cargando canciones...</p>`;
		overlay.classList.add("active");

		try {
			// Solicitamos las canciones (el backend debe filtrar las que tengan eliminado = 0)
			cancionesDisponibles = (await ipcRenderer.invoke("get-songs")) || [];
		} catch (error) {
			console.error("Error al cargar canciones para eliminar:", error);
			cancionesDisponibles = [];
		}

		renderSongList();
		actualizarEstadoBoton();
	}

	function cerrarModal() {
		overlay.classList.remove("active");
	}

	if (openBtn) openBtn.addEventListener("click", abrirModal);
	if (closeBtn) closeBtn.addEventListener("click", cerrarModal);

	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) cerrarModal();
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && overlay.classList.contains("active")) {
			cerrarModal();
		}
	});

	songSearchInput.addEventListener("input", () => {
		renderSongList(songSearchInput.value);
	});

	confirmDeleteBtn.addEventListener("click", async () => {
		const total = idsSeleccionados.size;
		if (total === 0) return;

		// Cuadro de confirmación nativo requerido
		const confirmado = confirm(
			`¿Estás seguro de que deseas enviar a la papelera ${total} canción${total === 1 ? "" : "es"}?`,
		);
		if (!confirmado) return;

		const idsArray = Array.from(idsSeleccionados);
		const textoOriginal = confirmDeleteBtn.innerHTML;
		confirmDeleteBtn.disabled = true;
		confirmDeleteBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Eliminando...`;

		try {
			const resultado = await ipcRenderer.invoke("delete-songs", idsArray);

			if (!resultado || !resultado.success) {
				alert(
					(resultado && resultado.error) ||
						"No se pudieron eliminar las canciones",
				);
				return;
			}

			cerrarModal();

			// Recargamos la interfaz general de la app usando la función global existente en renderer.js
			if (typeof window.recargarCanciones === "function") {
				window.recargarCanciones();
			}
		} catch (error) {
			console.error("Error al eliminar canciones:", error);
			alert("Ocurrió un error al procesar la eliminación");
		} finally {
			confirmDeleteBtn.innerHTML = textoOriginal;
			actualizarEstadoBoton();
		}
	});
})();
