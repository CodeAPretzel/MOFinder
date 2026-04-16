"use client";

import React, { useState } from "react";
import { X, CheckCircle, Maximize } from "lucide-react";
import { resolveLinkerInput } from "@/app/api/linker/handler";
import { getClientRDKit } from "@/lib/rdkit";
import DetailModalFooter from "./DetailModalFooter";
import DetailModalAI from "./DetailModalAI";
import DetailModalSynthesisCard from "./DetailModalSynthesisCard";

const DetailModal: React.FC<DetailModalProps> = ({ mof, onClose }) => {
	const [isSynthesisExpanded, setIsSynthesisExpanded] = useState(true);
	const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
	const [isLinkerHovered, setIsLinkerHovered] = useState(false);

	const [linkerPreview, setLinkerPreview] = useState<{
		loading: boolean;
		svg?: string;
		error?: string;
	}>({ loading: false });

	const showLinkerPreview =
		isLinkerHovered &&
		(linkerPreview.loading || Boolean(linkerPreview.error) || Boolean(linkerPreview.svg));

	const handleLinkerHover = async (linkerName: string) => {
		if (linkerPreview.svg || linkerPreview.loading || linkerPreview.error) return;

		setLinkerPreview({ loading: true });

		try {
			const resolved = await resolveLinkerInput(linkerName);

			if (!resolved.canonicalSmiles) {
				setLinkerPreview({
					loading: false,
					error: "No structure available",
				});
				return;
			}

			const RDKit = await getClientRDKit();
			const mol = RDKit.get_mol(resolved.canonicalSmiles);

			if (!mol) {
				setLinkerPreview({
					loading: false,
					error: "Could not render structure",
				});
				return;
			}

			const svg = mol.get_svg();
			mol.delete();

			setLinkerPreview({
				loading: false,
				svg,
			});
		} catch {
			setLinkerPreview({
				loading: false,
				error: "Failed to load structure",
			});
		}
	};

	const handleLinkerEnter = () => {
		setIsLinkerHovered(true);
		void handleLinkerHover(mof.linker_1);
	};

	const handleLinkerLeave = () => {
		setIsLinkerHovered(false);
	};

	const handleContentClick = (e: React.MouseEvent) => {
		e.stopPropagation();
	};

	const shareLink =
		typeof window !== "undefined" && mof.doi
			? `${window.location.origin}${window.location.pathname}?doi=${encodeURIComponent(mof.doi)}`
			: "";

	const handleShare = async () => {
		try {
			const url = shareLink || (typeof window !== "undefined" ? window.location.href : "");
			await navigator.clipboard.writeText(url);
			setShareStatus("copied");
		} catch {
			setShareStatus("failed");
		} finally {
			setTimeout(() => setShareStatus("idle"), 1500);
		}
	};

	const handleExport = () => {
		const blob = new Blob([JSON.stringify(mof, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = `${(mof.mof_name || "mof").replace(/[^a-z0-9-_]+/gi, "_")}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();

		URL.revokeObjectURL(url);
	};

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300"
			onClick={onClose}
		>
			<div
				className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200"
				onClick={handleContentClick}
			>
				<div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
					<div className="pr-8">
						<div className="flex items-center gap-3 mb-2">
							<div className="px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wide">
								{mof.topology_code} Net
							</div>
							<div
								className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide flex items-center gap-1 ${mof.status === "ok"
										? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
										: "bg-amber-100 text-amber-700"
									}`}
							>
								<CheckCircle size={12} /> Verified Experiment
							</div>
						</div>

						<h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
							{mof.mof_name}
						</h2>

						<p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm max-w-2xl">
							{mof.mof_description}
						</p>
					</div>

					<button
						onClick={onClose}
						className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
					>
						<X size={24} />
					</button>
				</div>

				<div className="overflow-y-auto p-6 space-y-8 custom-scrollbar">
					<DetailModalSynthesisCard
						mof={mof}
						isExpanded={isSynthesisExpanded}
						onToggleExpanded={() => setIsSynthesisExpanded((prev) => !prev)}
						showLinkerPreview={showLinkerPreview}
						linkerPreview={linkerPreview}
						onLinkerEnter={handleLinkerEnter}
						onLinkerLeave={handleLinkerLeave}
					/>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
						<section>
							<h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
								<Maximize className="text-teal-500" size={20} /> Physical Properties
							</h3>

							<div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
								<div className="divide-y divide-slate-100 dark:divide-slate-700">
									<div className="p-4 flex justify-between items-center">
										<span className="text-slate-600 dark:text-slate-400 text-sm font-medium">
											BET Surface Area
										</span>
										<span className="text-slate-900 dark:text-slate-100 font-bold font-mono">
											{mof.bet_surface_area_m2g} m²/g
										</span>
									</div>

									<div className="p-4 flex justify-between items-center">
										<span className="text-slate-600 dark:text-slate-400 text-sm font-medium">
											Pore Diameter
										</span>
										<span className="text-slate-900 dark:text-slate-100 font-bold font-mono">
											{mof.pore_diameter_A} Å
										</span>
									</div>

									<div className="p-4 flex justify-between items-center">
										<span className="text-slate-600 dark:text-slate-400 text-sm font-medium">
											TGA Decomposition
										</span>
										<span className="text-slate-900 dark:text-slate-100 font-bold font-mono">
											{mof.tga_decomposition_temp_c} °C
										</span>
									</div>

									<div className="p-4 flex justify-between items-center">
										<span className="text-slate-600 dark:text-slate-400 text-sm font-medium">
											Stability
										</span>

										<div className="flex gap-2">
											{mof.water_stable ? (
												<span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">
													Water Stable
												</span>
											) : (
												<span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs">
													Water Unstable
												</span>
											)}

											{mof.air_stable ? (
												<span className="px-2 py-1 rounded bg-teal-100 text-teal-700 text-xs font-bold">
													Air Stable
												</span>
											) : (
												<span className="px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs">
													Air Unstable
												</span>
											)}
										</div>
									</div>
								</div>
							</div>
						</section>

						<DetailModalAI mof={mof} />
					</div>
				</div>

				<DetailModalFooter
					mof={mof}
					shareStatus={shareStatus}
					onShare={handleShare}
					onExport={handleExport}
				/>
			</div>
		</div>
	);
};

export default DetailModal;