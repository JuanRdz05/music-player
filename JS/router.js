const mainContent = document.getElementById("app-main-content");
const navLinks = document.querySelectorAll(".nav-link");

async function navigateTo(route) {
	try {
		const response = await fetch(`pages/${route}.html`);

		if (!response.ok) {
			mainContent.innerHTML = `<h2>Error cargando la vista: ${route}</h2>`;
			return;
		}

		const html = await response.text();
		mainContent.innerHTML = html;

		if (route === "home" && typeof window.initHomeView === "function") {
			window.initHomeView();
		} else if (route === "library" && typeof window.initLibraryView === "function") {
			window.initLibraryView();
		}

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

// Configurar los event listeners del sidebar
navLinks.forEach((link) => {
	link.addEventListener("click", (e) => {
		e.preventDefault();
		const route = link.dataset.route;
		if (route) {
			navigateTo(route);
		}
	});
});

// Cargar la vista inicial por defecto
document.addEventListener("DOMContentLoaded", () => {
	navigateTo("home");
});
