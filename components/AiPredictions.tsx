"use client"

import React from 'react';
import { X, Brain, Download } from 'lucide-react';
import { AI_PREDICTION_FULL_MODEL_URL } from '@/constants';
import LivePredictions from '@/components/LivePredictions';

const AiPredictions: React.FC<AiPredictionsProps> = ({ isOpen, onClose }) => {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
			<div className="bg-white dark:bg-slate-900 w-full max-w-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-10 duration-300 border border-slate-200 dark:border-slate-800">

				{/* Header */}
				<div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-blue-600 text-white sm:rounded-t-2xl">
					<div className="flex items-center gap-2">
						<Brain size={20} />
						<h3 className="font-bold">AI MOF Recommender</h3>
					</div>
					<button onClick={onClose} aria-label="Close" className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded-full transition-colors">
						<X size={20} />
					</button>
				</div>

				{/* Body */}
				<div className="flex-1 p-6 overflow-y-auto space-y-6">
					<div className="space-y-3">
						<p className="text-sm text-slate-600 dark:text-slate-400">
							Enter a synthesis and submit it to the MOFinder model. The score is the predicted probability
							that the synthesis gives a crystalline product.
						</p>
						<a
							href={AI_PREDICTION_FULL_MODEL_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-2 w-fit px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
						>
							<Download size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
							<span>
								Model: <span className="font-semibold">GPT-oss-MOFinder</span>. Download it on Hugging Face
							</span>
						</a>
					</div>

					<LivePredictions />

					<p className="text-xs text-slate-400 dark:text-slate-500">
						Scores come from a quantized (compressed) copy of GPT-oss-MOFinder running on the lab server, so they can
						differ slightly from the full model on Hugging Face.
					</p>
				</div>
			</div>
		</div>
	);
};

export default AiPredictions
