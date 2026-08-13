// responsive.js - Versión mejorada y robusta
(function () {
	// Evitar redeclaración si ya existe
	if (window.initResponsiveMenu) return;

	function createOverlay() {
		let overlay = document.querySelector('.nav-overlay') || document.querySelector('.sidebar-overlay');
		if (!overlay) {
			overlay = document.createElement('div');
			overlay.className = 'nav-overlay';
			document.body.appendChild(overlay);
		}
		return overlay;
	}

	function getNavContainer() {
		return document.querySelector('.admin-header .nav-container') || document.querySelector('.nav-container');
	}

	function getToggles() {
		return {
			headerToggle: document.getElementById('navToggle'),
			pageToggle: document.getElementById('menuToggle')
		};
	}

	function setAria(btn, expanded) {
		if (!btn) return;
		try { btn.setAttribute('aria-expanded', expanded ? 'true' : 'false'); } catch (e) { /* noop */ }
	}

	function openNav(navContainer, overlay, toggles) {
		if (navContainer) navContainer.classList.add('active');
		if (overlay) overlay.classList.add('active');
		setAria(toggles.headerToggle, true);
		setAria(toggles.pageToggle, true);
		document.body.classList.add('nav-open');
		// marcar visual del toggle
		if (toggles.headerToggle) toggles.headerToggle.classList.add('active');
		if (toggles.pageToggle) toggles.pageToggle.classList.add('active');
	}

	function closeNav(navContainer, overlay, toggles) {
		if (navContainer) navContainer.classList.remove('active');
		if (overlay) overlay.classList.remove('active');
		setAria(toggles.headerToggle, false);
		setAria(toggles.pageToggle, false);
		document.body.classList.remove('nav-open');
		if (toggles.headerToggle) toggles.headerToggle.classList.remove('active');
		if (toggles.pageToggle) toggles.pageToggle.classList.remove('active');
	}

	function toggleNav(navContainer, overlay, toggles) {
		if (!navContainer) return;
		if (navContainer.classList.contains('active')) closeNav(navContainer, overlay, toggles);
		else openNav(navContainer, overlay, toggles);
	}

	function initResponsiveMenu() {
		const navContainer = getNavContainer();
		const overlay = createOverlay();
		const toggles = getToggles();

		// Evitar múltiples listeners: marcamos init en el navContainer
		if (navContainer && navContainer.dataset.responsiveInit === '1') return;
		if (navContainer) navContainer.dataset.responsiveInit = '1';

		// IMPORTANTE: Forzar estado inicial CERRADO (eliminar clase .active si la tiene)
		if (navContainer) navContainer.classList.remove('active');
		if (overlay) overlay.classList.remove('active');
		setAria(toggles.headerToggle, false);
		setAria(toggles.pageToggle, false);
		if (toggles.headerToggle) toggles.headerToggle.classList.remove('active');
		if (toggles.pageToggle) toggles.pageToggle.classList.remove('active');
		document.body.classList.remove('nav-open');

		// Asociar eventos a los toggles (si existen)
		if (toggles.headerToggle && !toggles.headerToggle.dataset.bound) {
			toggles.headerToggle.addEventListener('click', function (e) {
				e.preventDefault();
				toggleNav(navContainer, overlay, toggles);
			});
			toggles.headerToggle.dataset.bound = '1';
		}

		if (toggles.pageToggle && !toggles.pageToggle.dataset.bound) {
			toggles.pageToggle.addEventListener('click', function (e) {
				e.preventDefault();
				toggleNav(navContainer, overlay, toggles);
			});
			toggles.pageToggle.dataset.bound = '1';
		}

		// Overlay: clic cierra
		if (!overlay.dataset.bound) {
			overlay.addEventListener('click', function () {
				closeNav(navContainer, overlay, toggles);
			});
			overlay.dataset.bound = '1';
		}

		// Cerrar al pulsar un enlace dentro del menú (UX)
		if (navContainer && !navContainer.dataset.linkBound) {
			navContainer.addEventListener('click', function (e) {
				const a = e.target.closest('a');
				if (a && window.innerWidth <= 768) {
					// si es enlace con target _blank no cerramos
					if (a.target === '_blank') return;
					closeNav(navContainer, overlay, toggles);
				}
			});
			navContainer.dataset.linkBound = '1';
		}

		// ESC cierra
		if (!document.body.dataset.escBound) {
			document.addEventListener('keydown', function (e) {
				if (e.key === 'Escape') {
					closeNav(navContainer, overlay, toggles);
				}
			});
			document.body.dataset.escBound = '1';
		}

		// Resize: si se agranda, asegurar estado cerrado
		if (!window._responsiveResizeBound) {
			window.addEventListener('resize', function () {
				if (window.innerWidth > 768) {
					closeNav(navContainer, overlay, getToggles());
				}
			});
			window._responsiveResizeBound = true;
		}
	}

	// Exponer la función globalmente
	window.initResponsiveMenu = initResponsiveMenu;

	// Auto-inicializar si DOM ya fue cargado; si no, esperar DOMContentLoaded
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initResponsiveMenu);
	} else {
		initResponsiveMenu();
	}
})();