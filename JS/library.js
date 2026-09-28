// JS/library.js
// Lógica para la vista de "Biblioteca".
// Ahora pide las canciones directamente a la base de datos (antes usaba el
// arreglo global "canciones", que cambia cuando se reproduce una playlist o
// los favoritos y hacía que la biblioteca mostrara solo esa cola).
(function () {
	const { ipcRenderer } = require("electron");

	let todas = []; // todas las canciones de la biblioteca
	let visibles = []; // las que se ven ahora (filtradas + ordenadas) = cola

	function renderLibraryCards(lista, animar) {
		const contenedor = document.getElementById("libraryGrid");
		if (!contenedor) return;

		// Sin animación de entrada al buscar/ordenar (solo al abrir la vista)
		contenedor.classList.toggle("no-anim", !animar);
		contenedor.innerHTML = "";

		if (!lista || lista.length === 0) {
			const mensaje =
				todas.length === 0
					? "Tu biblioteca está vacía."
					: "No se encontraron canciones.";
			contenedor.innerHTML = `<div class="empty-library">
				<i class="fa-solid fa-music"></i>
				<p>${mensaje}</p>
			</div>`;
			return;
		}

		lista.forEach((cancion, i) => {
			contenedor.appendChild(window.crearTarjetaCancion(cancion, i));
		});
	}

	async function initLibraryView() {
		const searchInput = document.getElementById("librarySearchInput");
		const sortSelect = document.getElementById("librarySortSelect");
		const grid = document.getElementById("libraryGrid");

		if (!grid) return;

		try {
			// Los ids favoritos deben estar listos para pintar las estrellas
			if (typeof window.cargarFavoritosIds === "function") {
				await window.cargarFavoritosIds();
			}
			todas = (await ipcRenderer.invoke("get-songs")) || [];
		} catch (error) {
			console.error("Error al cargar la biblioteca:", error);
			todas = [];
		}

		// Si el usuario cambió de vista mientras cargaba, no hacemos nada
		if (!grid.isConnected) return;

		function updateLibrary(animar = false) {
			let filtradas = [...todas];

			// 1. Filtrar por búsqueda
			if (searchInput) {
				const query = searchInput.value.toLowerCase().trim();
				if (query) {
					filtradas = filtradas.filter(
						(c) =>
							(c.nombre || "").toLowerCase().includes(query) ||
							(c.artista || "").toLowerCase().includes(query),
					);
				}
			}

			// 2. Ordenar
			if (sortSelect) {
				const sortValue = sortSelect.value;
				filtradas.sort((a, b) => {
					if (sortValue === "name_asc") {
						return (a.nombre || "").localeCompare(b.nombre || "");
					} else if (sortValue === "name_desc") {
						return (b.nombre || "").localeCompare(a.nombre || "");
					} else if (sortValue === "artist_asc") {
						return (a.artista || "").localeCompare(b.artista || "");
					}
					// Predeterminado por ID (orden de subida)
					return a.id - b.id;
				});
			}

			visibles = filtradas;

			// 3. Renderizar las tarjetas
			renderLibraryCards(visibles, animar);
		}

		// oninput / onchange / onclick reemplazan el handler en cada llamada
		// (initLibraryView también se llama al recargar canciones)
		if (searchInput) searchInput.oninput = () => updateLibrary(false);
		if (sortSelect) sortSelect.onchange = () => updateLibrary(false);

		updateLibrary(true);

		// Al tocar una tarjeta, la cola pasa a ser la lista que se está viendo
		grid.onclick = (e) => {
			const tarjeta = e.target.closest(".song-card");
			if (!tarjeta) return;

			const id = Number(tarjeta.dataset.id);
			const indice = visibles.findIndex((c) => c.id === id);
			if (indice === -1) return;

			if (typeof window.cargarYReproducirLista === "function") {
				window.cargarYReproducirLista(visibles, indice);
			}
		};
	}

	// Exponer la función globalmente para que router.js y renderer.js puedan llamarla
	window.initLibraryView = initLibraryView;
})();
