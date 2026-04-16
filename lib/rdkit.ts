"use client";

import type { RDKitModule } from "@rdkit/rdkit";

declare global {
	interface Window {
		__rdkitBrowserPromise?: Promise<RDKitModule>;
	}
}

function loadScript(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const existing = document.querySelector(`script[src="${src}"]`);
		if (existing) {
			resolve();
			return;
		}

		const script = document.createElement("script");
		script.src = src;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error(`Failed to load ${src}`));
		document.head.appendChild(script);
	});
}

export async function getClientRDKit(): Promise<RDKitModule> {
	if (!window.__rdkitBrowserPromise) {
		window.__rdkitBrowserPromise = (async () => {
			await loadScript("/binaries/rdkit/RDKit_minimal.js");

			const init = (globalThis as { initRDKitModule?: unknown }).initRDKitModule;
			if (typeof init !== "function") {
				throw new Error("RDKit loader was not attached to global scope");
			}

			return init({
				locateFile: () => `/binaries/rdkit/RDKit_minimal.wasm`,
			});
		})();
	}

	return window.__rdkitBrowserPromise;
}