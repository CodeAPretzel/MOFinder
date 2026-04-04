import { createHash } from "crypto";
import { spawn } from "child_process";
import path from "path";

export type CanonicalizeSmilesResult =
  | {
      ok: true;
      input: string;
      canonicalSmiles: string;
      canonicalSmilesHash: string;
    }
  | {
      ok: false;
      input: string;
      error: string;
    };

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function canonicalizeSmiles(smiles: string): Promise<CanonicalizeSmilesResult> {
  const pythonBin = process.env.RDKIT_PYTHON_BIN || "python3";
  const scriptPath = path.join(process.cwd(), "scripts", "canonicalize_smiles.py");

  return new Promise((resolve) => {
    const child = spawn(pythonBin, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      resolve({
        ok: false,
        input: smiles,
        error: `Failed to launch RDKit helper: ${err.message}`,
      });
    });

    child.on("close", () => {
      try {
        const parsed = JSON.parse(stdout || "{}");
        if (!parsed.ok || !parsed.canonical_smiles) {
          resolve({
            ok: false,
            input: smiles,
            error: parsed.error || stderr || "Canonicalization failed",
          });
          return;
        }

        const canonicalSmiles = String(parsed.canonical_smiles);
        resolve({
          ok: true,
          input: smiles,
          canonicalSmiles,
          canonicalSmilesHash: sha256(canonicalSmiles),
        });
      } catch {
        resolve({
          ok: false,
          input: smiles,
          error: stderr || "Invalid JSON from RDKit helper",
        });
      }
    });

    child.stdin.write(JSON.stringify({ smiles }));
    child.stdin.end();
  });
}