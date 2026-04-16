"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, Pencil, Hexagon, XCircle } from "lucide-react";
import { resolveLinkerInput } from "@/app/api/linker/handler";
import JSMEEditor from "@/components/JsmeEditor";

const SmilesEditor: React.FC<SmilesEditorProps> = ({
	value,
	resolvedDisplayName,
	resolvedSmilesHash,
	onChange,
	onResolved,
	onClear,
}) => {
	const [mode, setMode] = useState<"text" | "draw">("text");
	const [isResolving, setIsResolving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [drawnSmiles, setDrawnSmiles] = useState("");
	const [drawResetKey, setDrawResetKey] = useState(0);

	const hasResolvedFilter = Boolean(resolvedSmilesHash);

	const helperText = useMemo(() => {
		if (hasResolvedFilter && resolvedDisplayName) {
			return `Filtering by ${resolvedDisplayName}`;
		}
		if (hasResolvedFilter) {
			return "Linker filter is active.";
		}
		if (mode === "draw" && drawnSmiles.trim()) {
			return "Structure captured. Click “Use structure” to apply the filter.";
		}
		if (mode === "draw") {
			return "Draw a linker structure, then apply it.";
		}
		return "Type a linker name or SMILES string.";
	}, [hasResolvedFilter, resolvedDisplayName, mode, drawnSmiles]);

	const resolveAndApply = async (rawQuery: string) => {
		const query = rawQuery.trim();

		if (!query) {
			setError(null);
			onClear();
			return;
		}

		setIsResolving(true);
		setError(null);

		try {
			const resolved = await resolveLinkerInput(query);

			if (!resolved.matched || !resolved.canonicalSmilesHash) {
				onResolved({
					query,
					normalizedQuery: resolved.normalizedQuery,
					inputMode: resolved.inputMode,
					matched: false,
					canonicalSmilesHash: null,
					canonicalSmiles: resolved.canonicalSmiles ?? null,
					displayName: null,
					aliases: [],
					suggestions: resolved.suggestions,
				});

				setError(
					resolved.suggestions.length
						? "No exact linker match found. Try one of the suggested aliases."
						: "No linker match found in the linker alias index."
				);
				return;
			}

			onChange(resolved.canonicalSmiles ?? query);
			onResolved(resolved);
			setError(null);
		} catch (err: any) {
			setError(err?.message ?? "Failed to resolve linker.");
		} finally {
			setIsResolving(false);
		}
	};

	const handleTextResolve = async () => {
		await resolveAndApply(value);
	};

	const handleDrawResolve = async () => {
		await resolveAndApply(drawnSmiles);
	};

	const handleReset = () => {
		setError(null);
		setDrawnSmiles("");
		setDrawResetKey((prev) => prev + 1);
		onChange("");
		onClear();
	};

	return (
		<div className="w-full space-y-3">
			<div className="flex items-center justify-between mb-1">
				<label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
					Linker Structure
				</label>

				<div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
					<button
						type="button"
						onClick={() => setMode("text")}
						className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === "text"
								? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
								: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
							}`}
					>
						SMILES
					</button>

					<button
						type="button"
						onClick={() => setMode("draw")}
						className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${mode === "draw"
								? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
								: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
							}`}
					>
						<Pencil size={12} /> Draw
					</button>
				</div>
			</div>

			{mode === "text" ? (
				<div className="space-y-2">
					<div className="relative">
						<input
							type="text"
							value={value}
							onChange={(e) => onChange(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									void handleTextResolve();
								}
							}}
							onBlur={() => {
								if (value.trim()) {
									void handleTextResolve();
								}
							}}
							placeholder="BDC, terephthalic acid, or Cc1[nH]ccn1"
							className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 placeholder-slate-400"
						/>
						<div className="absolute right-3 top-2.5 text-slate-400">
							<Hexagon size={16} />
						</div>
					</div>
				</div>
			) : (
				<div className="space-y-3">
					<JSMEEditor
						key={drawResetKey}
						initialSmiles={value}
						onSmilesChange={setDrawnSmiles}
					/>

					<div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-3 text-xs text-slate-500 dark:text-slate-400 space-y-2">
						<div className="font-semibold text-slate-600 dark:text-slate-300">
							Generated SMILES
						</div>
						<div className="break-all font-mono text-[11px] min-h-[1.0rem]">
							{drawnSmiles || "Draw a structure to generate SMILES."}
						</div>
					</div>

					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => void handleDrawResolve()}
							disabled={isResolving || !drawnSmiles.trim()}
							className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{isResolving ? "Applying..." : "Use structure"}
						</button>

						<button
							type="button"
							onClick={handleReset}
							className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
						>
							Clear
						</button>
					</div>
				</div>
			)}

			<div className="px-1 py-2 text-xs space-y-3">
				<div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
					{hasResolvedFilter ? (
						<CheckCircle2 size={14} className="mt-0.5 text-emerald-500" />
					) : (
						<XCircle size={14} className="mt-0.5 text-slate-400" />
					)}
					<div>
						<p className="font-medium">{helperText}</p>
					</div>
				</div>

				{error ? <p className="text-rose-600 dark:text-rose-400">{error}</p> : null}
			</div>
		</div>
	);
};

export default SmilesEditor;