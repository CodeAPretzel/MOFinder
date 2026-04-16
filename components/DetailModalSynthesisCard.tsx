"use client";

import { Beaker, Thermometer, Clock, Hexagon, ChevronDown, ChevronUp } from "lucide-react";

const DetailModalSynthesisCard = ({
	mof,
	isExpanded,
	onToggleExpanded,
	showLinkerPreview,
	linkerPreview,
	onLinkerEnter,
	onLinkerLeave,
}: {
	mof: DetailModalProps["mof"];
	isExpanded: boolean;
	onToggleExpanded: () => void;
	showLinkerPreview: boolean;
	linkerPreview: {
		loading: boolean;
		svg?: string;
		error?: string;
	};
	onLinkerEnter: () => void;
	onLinkerLeave: () => void;
}) => {
	return (
		<section>
			<h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
				<Beaker className="text-indigo-500" size={20} /> Synthesis Protocol
			</h3>

			<div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					<div className="space-y-1">
						<div className="text-xs text-slate-500 uppercase font-semibold">
							Primary Metal Source
						</div>
						<div className="font-medium text-slate-900 dark:text-slate-200">
							{mof.metal_1}
						</div>
						<div className="text-xs text-slate-400">Abbr: {mof.metal_1_abbr}</div>
					</div>

					<div className="space-y-1 min-w-0">
						<div className="text-xs text-slate-500 uppercase font-semibold">
							Organic Linker
						</div>

						<div
							className="relative inline-block max-w-full"
							onMouseEnter={onLinkerEnter}
							onMouseLeave={onLinkerLeave}
						>
							<div className="font-medium text-slate-900 dark:text-slate-200 cursor-help underline decoration-dotted break-words">
								{mof.linker_1}
							</div>

							{showLinkerPreview && (
								<div className="absolute left-0 -translate-x-1 top-full z-30 mt-3 w-80 max-w-[calc(100vw-4rem)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-2xl">
									{linkerPreview.loading && (
										<div className="text-sm text-slate-500 dark:text-slate-400">
											Loading structure...
										</div>
									)}

									{linkerPreview.error && (
										<div className="text-sm text-red-500">{linkerPreview.error}</div>
									)}

									{linkerPreview.svg && (
										<div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2 overflow-hidden">
											<div
												className="flex items-center justify-center [&_svg]:h-auto [&_svg]:w-full"
												dangerouslySetInnerHTML={{ __html: linkerPreview.svg }}
											/>
										</div>
									)}
								</div>
							)}
						</div>

						<div className="text-xs text-slate-400">Abbr: {mof.linker_1_abbr}</div>
					</div>

					<div className="space-y-1">
						<div className="text-xs text-slate-500 uppercase font-semibold">
							Solvent System
						</div>
						<div className="font-medium text-slate-900 dark:text-slate-200">
							{mof.solvent_main}
						</div>
					</div>

					<div className="space-y-1">
						<div className="text-xs text-slate-500 uppercase font-semibold">Yield</div>
						<div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
							{mof.yield_percent}%
						</div>
						<div className="text-xs text-slate-400">Based on metal</div>
					</div>
				</div>

				<div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
						<div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded">
							<Thermometer size={20} />
						</div>
						<div>
							<div className="text-xs text-slate-400 font-semibold">Reaction Temp</div>
							<div className="font-bold text-slate-900 dark:text-slate-100">
								{mof.temperature_c} °C
							</div>
						</div>
					</div>

					<div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
						<div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded">
							<Clock size={20} />
						</div>
						<div>
							<div className="text-xs text-slate-400 font-semibold">Reaction Time</div>
							<div className="font-bold text-slate-900 dark:text-slate-100">
								{mof.time_h} Hours
							</div>
						</div>
					</div>

					<div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
						<div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-500 rounded">
							<Hexagon size={20} />
						</div>
						<div>
							<div className="text-xs text-slate-400 font-semibold">Morphology</div>
							<div
								className="font-bold text-slate-900 dark:text-slate-100 leading-snug max-h-20 overflow-y-auto pr-1 break-words whitespace-pre-wrap"
								title={mof.crystal_morphology}
							>
								{mof.crystal_morphology || "—"}
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="mt-4">
				<button
					onClick={onToggleExpanded}
					className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
				>
					<span>Step-by-Step Preparation & Activation</span>
					{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
				</button>

				{isExpanded && (
					<div className="mt-2 p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg animate-in slide-in-from-top-2 duration-200">
						<div className="space-y-4">
							<div>
								<h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-2">
									Preparation
								</h4>
								<p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
									{mof.synthesis_procedure}
								</p>
							</div>

							<div className="h-px bg-slate-100 dark:bg-slate-700" />

							<div>
								<h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-2">
									Activation
								</h4>
								<p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
									{mof.activation_procedure}
								</p>
							</div>
						</div>
					</div>
				)}
			</div>
		</section>
	);
};

export default DetailModalSynthesisCard;