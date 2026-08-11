const reproductor = document.querySelector("audio");

const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pauseBtn = document.getElementById("pauseBtn");

let canciones = [];
let indiceCancion = 0;

async function cargarCanciones() {
	const canciones = await window.music.getSongs();

	console.log("Lista de canciones obtenida desde Node:", canciones);

	return canciones;
}

async function iniciarReproductor() {
	canciones = await cargarCanciones();

	reproductor.src = "music/" + canciones[indiceCancion];

	nextBtn.addEventListener("click", () => {
		indiceCancion++;
		//Si el indice de la cancion es mayor que el tamño del arreglo, entonces volvemos al inicio
		if (indiceCancion > canciones.length - 1) {
			indiceCancion = 0;
		}
		reproductor.src = "music/" + canciones[indiceCancion];
		reproductor.play();
	});

	prevBtn.addEventListener("click", () => {
		indiceCancion--;
		//Si el indice de la cancion es menor a 0, entonces volvemos al final
		if (indiceCancion < 0) {
			indiceCancion = canciones.length - 1;
		}
		reproductor.src = "music/" + canciones[indiceCancion];
		reproductor.play();
	});

	playBtn.addEventListener("click", () => {
		reproductor.play();
	});

	pauseBtn.addEventListener("click", () => {
		reproductor.pause();
	});
}

iniciarReproductor();
