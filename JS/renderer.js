//Llamada a los recursos
const { ipcRenderer } = require("electron");

//Reproductor
const reproductor = document.querySelector("audio");

//Controles del reproductor
const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const volume = document.getElementById("volumeSlider");

//Elementos del reproductor
const progressBar = document.getElementById("progressBar");
const currentTimeEl = document.getElementById("currentTime");
const durationTimeEl = document.getElementById("durationTime");

//Funciones del reproductor
const {
	actualizarNombreCancion,
	actualizarImagenCancion,
} = require("./JS/actualizarNombre.js");
const formatTime = require("./JS/formatTime.js");

//Nombre de las canciones
const songName = document.getElementById("song-name");
//Imagenes de las canciones
const songImageContainer = document.getElementById("song-image");
const songImageSwipe = songImageContainer.querySelector(".image-swipe");
const songImage = songImageContainer.getElementsByTagName("img")[0];

//Fondo
const fondo = document.querySelector(".fondo-container");

//Panel derecho
const playlistBtn = document.getElementById("song-queue");
const lyricsBtn = document.getElementById("btn-lyric");

const playlistView = document.getElementById("playlistView");
const lyricsView = document.getElementById("lyricsView");

let canciones = [];
let indiceCancion = 0;

// Estado de la letra sincronizada actualmente mostrada
let lineasSincronizadas = []; // [{ time: segundos, text: "..." }, ...]
let elementosLineas = []; // <p> correspondiente a cada línea, mismo índice
let indiceLineaActual = -1;

/**
 * Convierte texto en formato LRC (ej: "[01:23.45] Letra de la línea")
 * a un arreglo ordenado de { time, text }, donde time está en segundos.
 * Soporta líneas con más de un timestamp (coros repetidos).
 */
function parseLRC(textoLRC) {
	const regexTiempo = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
	const resultado = [];

	for (const linea of textoLRC.split("\n")) {
		const coincidencias = [...linea.matchAll(regexTiempo)];
		if (coincidencias.length === 0) continue;

		const texto = linea.replace(regexTiempo, "").trim();

		for (const match of coincidencias) {
			const minutos = Number(match[1]);
			const segundos = Number(match[2]);
			// Rellena "4" -> "400" para que siempre sean milisegundos completos
			const milisegundos = match[3] ? Number(match[3].padEnd(3, "0")) : 0;

			resultado.push({
				time: minutos * 60 + segundos + milisegundos / 1000,
				text: texto,
			});
		}
	}

	resultado.sort((a, b) => a.time - b.time);
	return resultado;
}

function actualizarConAnimacion() {
	//Animación del titulo de la canción
	songName.classList.remove("swipe-in");
	songName.classList.add("swipe-out");

	//Animación del fondo
	fondo.classList.remove("fade-in");
	fondo.classList.add("fade-out");

	//Animación de la imagen de la canción (en el wrapper, no en el img)
	songImageSwipe.classList.remove("swipe-in");
	songImageSwipe.classList.add("swipe-out");

	setTimeout(() => {
		actualizarNombreCancion(canciones, indiceCancion, songName);
		actualizarImagenCancion(canciones, indiceCancion, songImage);
		songName.classList.remove("swipe-out");
		songName.classList.add("swipe-in");

		songImageSwipe.classList.remove("swipe-out");
		songImageSwipe.classList.add("swipe-in");

		fondo.classList.remove("fade-out");
		fondo.classList.add("fade-in");
	}, 250);
}

async function cargarCanciones() {
	const canciones = await ipcRenderer.invoke("get-songs");
	console.log("Lista de canciones obtenida desde Node:", canciones);
	return canciones;
}

function reproducirCancion(indice) {
	indiceCancion = indice;
	reproductor.src = canciones[indiceCancion].archivo;
	reproductor.currentTime = 0;
	playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
	reproductor.play();
	marcarTarjetaActiva(canciones[indiceCancion].id);

	// Si el usuario tiene abierta la pestaña de letras, actualízala también
	if (lyricsView.classList.contains("active")) {
		mostrarLetraCancionActual();
	}
}

// Resalta visualmente en la playlist cuál canción está sonando.
function marcarTarjetaActiva(id) {
	const tarjetas = playlistView.querySelectorAll(".playlist-card");
	tarjetas.forEach((tarjeta) => {
		tarjeta.classList.toggle(
			"playing",
			Number(tarjeta.dataset.id) === Number(id),
		);
	});
}

// Caché en memoria: evita pedir la misma letra dos veces mientras
// la app sigue abierta.
const cacheLetras = {};

async function obtenerLetra(cancion) {
	if (cacheLetras[cancion.id]) {
		return cacheLetras[cancion.id];
	}

	const resultado = await ipcRenderer.invoke("get-lyrics", {
		nombre: cancion.nombre,
		artista: cancion.artista,
		album: cancion.album,
		duration: cancion.duration,
	});

	cacheLetras[cancion.id] = resultado;
	return resultado;
}

// Renderiza texto de forma segura (textContent, no innerHTML) ya que
// el contenido viene de una API externa.
function renderizarMensajeLetra(mensaje) {
	lyricsView.innerHTML = "";
	const p = document.createElement("p");
	p.classList.add("lyrics-mensaje");
	p.textContent = mensaje;
	lyricsView.appendChild(p);
}

function renderizarTextoLetra(texto) {
	lyricsView.innerHTML = "";
	const pre = document.createElement("pre");
	pre.classList.add("lyrics-text");
	pre.textContent = texto;
	lyricsView.appendChild(pre);
}

function renderizarLetraSincronizada(lineas) {
	lyricsView.innerHTML = "";
	lineasSincronizadas = lineas;
	elementosLineas = [];
	indiceLineaActual = -1;

	const contenedor = document.createElement("div");
	contenedor.classList.add("lyrics-synced");

	lineas.forEach((linea) => {
		const p = document.createElement("p");
		p.classList.add("lyrics-line");
		p.textContent = linea.text || "♪";
		contenedor.appendChild(p);
		elementosLineas.push(p);
	});

	lyricsView.appendChild(contenedor);

	// Por si el usuario abrió la pestaña a media canción
	actualizarLetraSincronizada();
}

/**
 * Busca cuál línea corresponde al tiempo actual de reproducción y la
 * resalta. Se llama en cada "timeupdate" del <audio>. No hace nada si
 * la letra mostrada actualmente no es de tipo sincronizada.
 */
function actualizarLetraSincronizada() {
	if (lineasSincronizadas.length === 0) return;

	const tiempoActual = reproductor.currentTime;

	// Última línea cuyo timestamp ya pasó (o es igual al tiempo actual)
	let nuevoIndice = -1;
	for (let i = lineasSincronizadas.length - 1; i >= 0; i--) {
		if (lineasSincronizadas[i].time <= tiempoActual) {
			nuevoIndice = i;
			break;
		}
	}

	if (nuevoIndice === indiceLineaActual) return;

	if (elementosLineas[indiceLineaActual]) {
		elementosLineas[indiceLineaActual].classList.remove("active");
	}

	indiceLineaActual = nuevoIndice;

	const elementoActivo = elementosLineas[indiceLineaActual];
	if (elementoActivo) {
		elementoActivo.classList.add("active");

		// Solo se anima el scroll si la pestaña de letras está visible
		if (lyricsView.classList.contains("active")) {
			elementoActivo.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}
}

async function mostrarLetraCancionActual() {
	const cancion = canciones[indiceCancion];
	renderizarMensajeLetra("Buscando letra...");

	// Reseteamos el estado de la letra sincronizada anterior
	lineasSincronizadas = [];
	elementosLineas = [];
	indiceLineaActual = -1;

	const resultado = await obtenerLetra(cancion);

	// Si el usuario ya cambió de canción mientras esperábamos la respuesta,
	// no pisamos la vista con una letra que ya no corresponde.
	if (cancion.id !== canciones[indiceCancion].id) return;

	if (!resultado.found) {
		renderizarMensajeLetra("No se encontró letra para esta canción.");
		return;
	}

	if (resultado.instrumental) {
		renderizarMensajeLetra("Esta canción es instrumental.");
		return;
	}

	// Preferimos la letra sincronizada; si no existe, caemos a texto plano
	if (resultado.syncedLyrics) {
		const lineas = parseLRC(resultado.syncedLyrics);
		if (lineas.length > 0) {
			renderizarLetraSincronizada(lineas);
			return;
		}
	}

	if (resultado.plainLyrics) {
		renderizarTextoLetra(resultado.plainLyrics);
		return;
	}

	renderizarMensajeLetra("Letra no disponible.");
}

async function iniciarReproductor() {
	canciones = await cargarCanciones();

	reproductor.src = canciones[indiceCancion].archivo;
	actualizarNombreCancion(canciones, indiceCancion, songName);
	actualizarImagenCancion(canciones, indiceCancion, songImage);

	//Cancion siguiente
	nextBtn.addEventListener("click", () => {
		let nuevoIndice = indiceCancion + 1;
		//Si el indice de la cancion es mayor que el tamño del arreglo, entonces volvemos al inicio
		if (nuevoIndice > canciones.length - 1) {
			nuevoIndice = 0;
		}
		actualizarConAnimacion();
		reproducirCancion(nuevoIndice);
	});

	//Cancion anterior
	prevBtn.addEventListener("click", () => {
		let nuevoIndice = indiceCancion;
		if (progressBar.value <= 3) {
			nuevoIndice = indiceCancion - 1;
			//Si el indice de la cancion es menor a 0, entonces volvemos al final
			if (nuevoIndice < 0) {
				nuevoIndice = canciones.length - 1;
			}
			actualizarConAnimacion();
		}
		reproducirCancion(nuevoIndice);
	});
	playlistView.addEventListener("click", (e) => {
		const tarjeta = e.target.closest(".playlist-card");
		if (!tarjeta) return;

		const id = Number(tarjeta.dataset.id);
		const indiceSeleccionado = canciones.findIndex(
			(cancion) => cancion.id === id,
		);
		if (indiceSeleccionado === -1) return;
		if (indiceSeleccionado !== indiceCancion) {
			actualizarConAnimacion();
		}
		reproducirCancion(indiceSeleccionado);
	});

	playBtn.addEventListener("click", () => {
		if (reproductor.paused == true) {
			reproductor.play();
			playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
		} else {
			reproductor.pause();
			playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
		}
	});

	reproductor.addEventListener("loadedmetadata", () => {
		progressBar.max = reproductor.duration;
		durationTimeEl.textContent = formatTime(reproductor.duration);
		const porcentaje = (progressBar.value / progressBar.max) * 100;
		const colorFondo = `linear-gradient(to right, var(--rojo-oscuro) ${porcentaje}%, #333 ${porcentaje}%)`;
		progressBar.style.background = colorFondo;
	});

	reproductor.addEventListener("timeupdate", () => {
		progressBar.value = reproductor.currentTime;
		currentTimeEl.textContent = formatTime(reproductor.currentTime);
		const porcentaje = (progressBar.value / progressBar.max) * 100;
		const colorFondo = `linear-gradient(to right, var(--rojo-oscuro) ${porcentaje}%, #333 ${porcentaje}%)`;
		progressBar.style.background = colorFondo;

		actualizarLetraSincronizada();
	});

	progressBar.addEventListener("input", () => {
		reproductor.currentTime = progressBar.value;
		const porcentaje = (progressBar.value / progressBar.max) * 100;
		const colorFondo = `linear-gradient(to right, var(--rojo-oscuro) ${porcentaje}%, #333 ${porcentaje}%)`;
		progressBar.style.background = colorFondo;
	});

	reproductor.addEventListener("ended", () => {
		playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
		progressBar.value = 0;
		currentTimeEl.textContent = "0:00";
		nextBtn.click();
	});

	volume.addEventListener("input", () => {
		reproductor.volume = volume.value / 100;
		volume.style.background = `linear-gradient(to right, var(--rojo-oscuro) ${volume.value}%, #333 ${volume.value}%)`;
	});

	volume.style.background = `linear-gradient(to right, var(--rojo-oscuro) ${volume.value}%, #333 ${volume.value}%)`;

	//Pausa al presionar la imagen
	songImageContainer.addEventListener("click", () => {
		songImage.classList.remove("bounce");
		void songImage.offsetWidth;
		songImage.classList.add("bounce");

		songImage.addEventListener(
			"animationend",
			() => {
				songImage.classList.remove("bounce");
			},
			{ once: true },
		);

		// Play / Pausa
		if (reproductor.paused) {
			reproductor.play();
			playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
		} else {
			reproductor.pause();
			playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
		}
	});

	//Cargar la lista de canciones
	canciones.forEach((cancion) => {
		const playlistCard = document.createElement("div");

		playlistCard.classList.add("playlist-card");
		playlistCard.dataset.id = cancion.id;

		playlistCard.innerHTML = `
		<div class="image-playlist-song">
			<img src="${cancion.thumbnail}" alt="PlayList Image" />
		</div>

		<div class="playlist-text">
			<p>${cancion.nombre}</p>
			<label class="duration-playlist" for="durationTime">
				${formatTime(cancion.duration)}
			</label>
		</div>
	`;

		playlistView.appendChild(playlistCard);
	});

	// Marca la canción inicial como activa en la playlist
	marcarTarjetaActiva(canciones[indiceCancion].id);

	//Comando pausar y reproducir
	document.addEventListener("keydown", (e) => {
		if (e.code === "Space") {
			e.preventDefault();
			if (reproductor.paused) {
				reproductor.play();
				playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
			} else if (reproductor.played) {
				reproductor.pause();
				playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
			}
		}
	});

	//Presionar siguiente canción
	document.addEventListener("keydown", (e) => {
		if (e.ctrlKey && e.code === "ArrowRight") {
			e.preventDefault();
			nextBtn.click();
		}

		if (e.ctrlKey && e.code === "ArrowLeft") {
			e.preventDefault();
			prevBtn.click();
		}
	});

	//Subir y bajar volumen
	document.addEventListener("keydown", (e) => {
		if (e.ctrlKey && e.code === "ArrowUp") {
			e.preventDefault();
			volume.value = Number(volume.value) + 10;
			volume.dispatchEvent(new Event("input"));
		}

		if (e.ctrlKey && e.code === "ArrowDown") {
			e.preventDefault();
			volume.value = Number(volume.value) - 10;
			volume.dispatchEvent(new Event("input"));
		}
	});

	playlistBtn.addEventListener("click", () => {
		playlistView.classList.add("active");
		lyricsView.classList.remove("active");

		playlistBtn.classList.add("active");
		lyricsBtn.classList.remove("active");
	});

	lyricsBtn.addEventListener("click", () => {
		lyricsView.classList.add("active");
		playlistView.classList.remove("active");

		lyricsBtn.classList.add("active");
		playlistBtn.classList.remove("active");

		mostrarLetraCancionActual();
	});

	//Cambiar la pestaña de la playlist
	document.addEventListener("keydown", (e) => {
		if (e.ctrlKey && e.code === "Digit1") {
			e.preventDefault();
			playlistView.classList.add("active");
			lyricsView.classList.remove("active");

			playlistBtn.classList.add("active");
			lyricsBtn.classList.remove("active");
		}
	});

	//Cambiar la pestaña de la letra
	document.addEventListener("keydown", (e) => {
		if (e.ctrlKey && e.code === "Digit2") {
			e.preventDefault();
			lyricsView.classList.add("active");
			playlistView.classList.remove("active");

			lyricsBtn.classList.add("active");
			playlistBtn.classList.remove("active");

			mostrarLetraCancionActual();
		}
	});
}

iniciarReproductor();
