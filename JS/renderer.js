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

async function iniciarReproductor() {
	canciones = await cargarCanciones();

	reproductor.src = "music/" + canciones[indiceCancion].nombre;
	actualizarNombreCancion(canciones, indiceCancion, songName);
	actualizarImagenCancion(canciones, indiceCancion, songImage);

	//Cancion siguiente
	nextBtn.addEventListener("click", () => {
		indiceCancion++;
		//Si el indice de la cancion es mayor que el tamño del arreglo, entonces volvemos al inicio
		if (indiceCancion > canciones.length - 1) {
			indiceCancion = 0;
		}
		actualizarConAnimacion();
		reproductor.src = "music/" + canciones[indiceCancion].nombre;
		playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
		reproductor.play();
	});

	//Cancion anterior
	prevBtn.addEventListener("click", () => {
		if (progressBar.value <= 3) {
			indiceCancion--;
			//Si el indice de la cancion es menor a 0, entonces volvemos al final
			if (indiceCancion < 0) {
				indiceCancion = canciones.length - 1;
			}
			actualizarConAnimacion();
		}
		reproductor.src = "music/" + canciones[indiceCancion].nombre;
		reproductor.currentTime = 0;
		playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
		reproductor.play();
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
	});
}

iniciarReproductor();
