import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function assertExists(path, label) {
	if (!existsSync(path)) {
		throw new Error(`Missing ${label}: ${path}`);
	}
}

function copyFile(source, target) {
	assertExists(source, "source file");
	mkdirSync(dirname(target), { recursive: true });
	copyFileSync(source, target);
}

function copyDirectory(sourceDir, targetDir) {
	assertExists(sourceDir, "source directory");

	rmSync(targetDir, { recursive: true, force: true });
	mkdirSync(dirname(targetDir), { recursive: true });

	cpSync(sourceDir, targetDir, {
		recursive: true,
		force: true,
	});
}

function copyRDKit() {
	const rdkitDist = join(root, "node_modules", "@rdkit", "rdkit", "Code", "MinimalLib", "dist");
	const targetDir = join(root, "public", "binaries", "rdkit");

	copyFile(
		join(rdkitDist, "RDKit_minimal.js"),
		join(targetDir, "RDKit_minimal.js")
	);

	copyFile(
		join(rdkitDist, "RDKit_minimal.wasm"),
		join(targetDir, "RDKit_minimal.wasm")
	);
}

function copyJSME() {
	const jsmeSourceDir = join(root, "node_modules", "jsme-editor");
	const jsmeTargetDir = join(root, "public", "binaries", "jsme");

	copyDirectory(jsmeSourceDir, jsmeTargetDir);
}

copyRDKit();
copyJSME();