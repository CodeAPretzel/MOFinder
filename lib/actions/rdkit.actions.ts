import path from "path";
import type { RDKitModule, RDKitLoader } from "@rdkit/rdkit";

async function loadInitRDKitModule(): Promise<RDKitLoader> {
	// Try the package root first.
	try {
		const mod = await import("@rdkit/rdkit");
		const candidate =
			(mod as unknown as { default?: RDKitLoader }).default ??
			((mod as unknown as { initRDKitModule?: RDKitLoader }).initRDKitModule);

		if (typeof candidate === "function") {
			return candidate;
		}
	} catch {
		// fall through
	}

	const distMod = await import("@rdkit/rdkit"); // Fallback: load the dist asset --> @rdkit/rdkit/dist/RDKit_minimal.js (errors out)
	const candidate =
		(distMod as unknown as { default?: RDKitLoader }).default ??
		((globalThis as { initRDKitModule?: RDKitLoader }).initRDKitModule);

	if (typeof candidate === "function") {
		return candidate;
	}

	throw new Error(
		"Could not load RDKit init function from @rdkit/rdkit or RDKit_minimal.js"
	);
}

export async function getRDKit(): Promise<RDKitModule> {
	if (!globalThis.__rdkitPromise) {
		globalThis.__rdkitPromise = (async () => {
			const initRDKitModule = await loadInitRDKitModule();

			const wasmPath = path.join(
				process.cwd(),
				"node_modules",
				"@rdkit",
				"rdkit",
				"dist",
				"RDKit_minimal.wasm"
			);

			return await initRDKitModule({
				locateFile: () => wasmPath,
			});
		})();
	}

	return globalThis.__rdkitPromise;
}