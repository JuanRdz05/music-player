//Reproductor
const reproductor = document.querySelector("audio");

//Controles del reproductor
const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

//Elementos del reproductor
const progressBar = document.getElementById("progressBar");
const currentTimeEl = document.getElementById("currentTime");
const durationTimeEl = document.getElementById("durationTime");

//Llamada a los recursos
const { ipcRenderer } = require("electron");
const {
	actualizarNombreCancion,
	actualizarImagenCancion,
} = require("./JS/actualizarNombre.js");
const formatTime = require("./JS/formatTime.js");

//Nombre de las canciones
const songName = document.getElementById("song-name");
//Imagenes de las canciones
const songImage = document
	.getElementById("song-image")
	.getElementsByTagName("img")[0];

let canciones = [];
let indiceCancion = 0;

function actualizarConAnimacion() {
	//Animación del titulo de la canción
	songName.classList.remove("swipe-in");
	songName.classList.add("swipe-out");

	//Animación de la imagen de la canción
	songImage.classList.remove("swipe-in");
	songImage.classList.add("swipe-out");

	setTimeout(() => {
		actualizarNombreCancion(canciones, indiceCancion, songName);
		actualizarImagenCancion(canciones, indiceCancion, songImage);
		songName.classList.remove("swipe-out");
		songName.classList.add("swipe-in");

		songImage.classList.remove("swipe-out");
		songImage.classList.add("swipe-in");
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
	});

	reproductor.addEventListener("timeupdate", () => {
		progressBar.value = reproductor.currentTime;
		currentTimeEl.textContent = formatTime(reproductor.currentTime);
	});

	progressBar.addEventListener("input", () => {
		reproductor.currentTime = progressBar.value;
	});

	reproductor.addEventListener("ended", () => {
		playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
		progressBar.value = 0;
		currentTimeEl.textContent = "0:00";
		nextBtn.click();
	});
}

iniciarReproductor();
