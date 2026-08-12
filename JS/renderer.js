const reproductor = document.querySelector("audio");

const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const progressBar = document.getElementById("progressBar");
const currentTimeEl = document.getElementById("currentTime");
const durationTimeEl = document.getElementById("durationTime");

const { ipcRenderer } = require("electron");
const actualizarNombreCancion = require("./JS/actualizarNombre.js");
const formatTime = require("./JS/formatTime.js");

const songName = document.getElementById("song-name");

let canciones = [];
let indiceCancion = 0;

async function cargarCanciones() {
	const canciones = await ipcRenderer.invoke("get-songs");
	console.log("Lista de canciones obtenida desde Node:", canciones);
	return canciones;
}

async function iniciarReproductor() {
	canciones = await cargarCanciones();

	reproductor.src = "music/" + canciones[indiceCancion];
	actualizarNombreCancion(canciones, indiceCancion, songName);

	nextBtn.addEventListener("click", () => {
		indiceCancion++;
		//Si el indice de la cancion es mayor que el tamño del arreglo, entonces volvemos al inicio
		if (indiceCancion > canciones.length - 1) {
			indiceCancion = 0;
		}
		actualizarNombreCancion(canciones, indiceCancion, songName);
		reproductor.src = "music/" + canciones[indiceCancion];
		playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
		reproductor.play();
	});

	prevBtn.addEventListener("click", () => {
		if (progressBar.value <= 3) {
			indiceCancion--;
			//Si el indice de la cancion es menor a 0, entonces volvemos al final
			if (indiceCancion < 0) {
				indiceCancion = canciones.length - 1;
			}
		}
		actualizarNombreCancion(canciones, indiceCancion, songName);
		reproductor.src = "music/" + canciones[indiceCancion];
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
