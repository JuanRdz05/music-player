const mainContent = document.getElementById("app-main-content");
const navLinks = document.querySelectorAll(".nav-link");

// Qué función "init" ejecutar al cargar cada vista.
// Para agregar una vista nueva: crea pages/<ruta>.html, su init, y
// regístrala aquí.
const inicializadoresDeVista = {
	home: () => window.initHomeView?.(),
	library: () => window.initLibraryView?.(),
	favorites: () => window.initFavoritesView?.(),
};

async function navigateTo(route) {
	try {
		const response = await fetch(`pages/${route}.html`);

		if (!response.ok) {
			mainContent.innerHTML = `<h2>Error cargando la vista: ${route}</h2>`;
			return;
		}

		const html = await response.text();
		mainContent.innerHTML = html;

		inicializadoresDeVista[route]?.();

		// Actualizar active classes en el sidebar
		navLinks.forEach((link) => {
			link.classList.remove("active");
			if (link.dataset.route === route) {
				link.classList.add("active");
			}
		});
	} catch (error) {
		console.error("Error al navegar:", error);
		mainContent.innerHTML = `<h2>Error: No se pudo cargar ${route}</h2>`;
	}
}

document.addEventListener("click", (e) => {
	const link = e.target.closest("[data-route]");

	if (link) {
		e.preventDefault();
		const route = link.dataset.route;
		if (route) {
			navigateTo(route);
		}
	}
});

// Cargar la vista inicial por defecto
document.addEventListener("DOMContentLoaded", () => {
	navigateTo("home");
});
