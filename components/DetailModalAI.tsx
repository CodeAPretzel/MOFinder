"use client";

import { Cpu, Zap, Droplets, Flame } from "lucide-react";

const DetailModalAI = ({ mof }: { mof: DetailModalProps["mof"] }) => {
	return (
		<section className="flex flex-col h-full">
			<h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
				<Cpu className="text-indigo-600 dark:text-indigo-400" size={20} />
				AI Predictions
				<span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
					Beta
				</span>
			</h3>

			<div className="flex-1 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-indigo-900/20 rounded-xl p-6 border border-indigo-100 dark:border-indigo-900/30 relative overflow-hidden">
				<div className="absolute top-0 right-0 p-4 opacity-5">
					<Zap size={120} />
				</div>

				<div className="relative z-10 space-y-6">
					<div>
						<div className="flex justify-between items-end mb-1">
							<div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
								Synthesizability Score
							</div>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="bg-white/60 dark:bg-slate-900/40 p-3 rounded-lg backdrop-blur-sm border border-white/50 dark:border-slate-700/50">
							<div className="flex items-center gap-2 mb-2">
								<Droplets size={14} className="text-blue-500" />
								<span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
									Water Stability
								</span>
							</div>
						</div>

						<div className="bg-white/60 dark:bg-slate-900/40 p-3 rounded-lg backdrop-blur-sm border border-white/50 dark:border-slate-700/50">
							<div className="flex items-center gap-2 mb-2">
								<Flame size={14} className="text-orange-500" />
								<span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
									Thermal Stability
								</span>
							</div>
						</div>
					</div>

					<div className="bg-indigo-100/50 dark:bg-indigo-900/30 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800/50 mt-2">
						<p className="text-xs text-indigo-800 dark:text-indigo-200 italic">
							"AI Model v2.1 predicts this framework fits the standard {mof.topology_code}{" "}
							topology template with high fidelity. Suggested for catalytic applications."
						</p>
					</div>
				</div>
			</div>
		</section>
	);
};

export default DetailModalAI;