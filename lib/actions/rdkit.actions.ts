import "server-only";
import path from "path";
import type { RDKitModule, RDKitLoader } from "@rdkit/rdkit";

async function loadInitRDKitModule(): Promise<RDKitLoader> {
	const mod = await import("@rdkit/rdkit");
	const candidate =
		(mod as any).default ?? (mod as any).initRDKitModule;

	if (typeof candidate !== "function") {
		throw new Error("Could not load RDKit init function");
	}

	return candidate;
}

export async function getServerRDKit(): Promise<RDKitModule> {
	const g = globalThis as any;

	if (!g.__rdkitServerPromise) {
		g.__rdkitServerPromise = (async () => {
			const initRDKitModule = await loadInitRDKitModule();
			const wasmPath = path.join(
				process.cwd(),
				"node_modules",
				"@rdkit",
				"rdkit",
				"dist",
				"RDKit_minimal.wasm"
			);

			return initRDKitModule({
				locateFile: () => wasmPath,
			});
		})();
	}

	return g.__rdkitServerPromise;
}