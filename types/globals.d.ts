import type { RDKitLoader, RDKitModule } from "@rdkit/rdkit";

/* eslint-disable no-unused-vars */

declare module "@rdkit/rdkit" {
	const initRDKitModule: RDKitLoader;
	export default initRDKitModule;
}

// fallback safety net
declare module "@rdkit/rdkit";

declare global {
	// eslint-disable-next-line no-var
	var __rdkitPromise: Promise<RDKitModule> | undefined;
}

export { };