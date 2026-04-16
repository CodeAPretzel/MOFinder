declare global {
	interface Window {
		JSApplet?: JSAppletNamespace;
		__jsmeLoaderPromise?: Promise<void>;
		__jsmeReady?: boolean;
		jsmeOnLoad?: () => void;
	}
}

export function loadJSME(): Promise<void> {
	if (typeof window === "undefined") {
		return Promise.reject(new Error("JSME can only be loaded in the browser."));
	}

	if (window.__jsmeReady && window.JSApplet?.JSME) {
		return Promise.resolve();
	}

	if (window.__jsmeLoaderPromise) {
		return window.__jsmeLoaderPromise;
	}

	window.__jsmeLoaderPromise = new Promise<void>((resolve, reject) => {
		window.jsmeOnLoad = () => {
			window.__jsmeReady = true;
			resolve();
		};

		const existing = document.querySelector<HTMLScriptElement>(
			'script[src="/binaries/jsme/jsme.nocache.js"]'
		);

		if (existing) {
			existing.addEventListener(
				"error",
				() => reject(new Error("Failed to load /binaries/jsme/jsme.nocache.js")),
				{ once: true }
			);

			// If the script was already present and finished before this mount:
			if (window.JSApplet?.JSME) {
				window.__jsmeReady = true;
				resolve();
			}

			return;
		}

		const script = document.createElement("script");
		script.src = "/binaries/jsme/jsme.nocache.js";
		script.async = true;
		script.onerror = () => reject(new Error("Failed to load /binaries/jsme/jsme.nocache.js"));

		document.head.appendChild(script);
	});

	return window.__jsmeLoaderPromise;
}