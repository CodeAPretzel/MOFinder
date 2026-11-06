import React from 'react';

export const ScoreBar = ({ score, pred }: { score: number; pred: 'P' | 'N' }) => (
	<div className="flex items-center gap-2 min-w-[7rem]">
		<div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
			<div
				className={`h-full rounded-full ${pred === 'P' ? 'bg-emerald-500' : 'bg-rose-400'}`}
				style={{ width: `${Math.round(score * 100)}%` }}
			/>
		</div>
		<span className="w-10 text-right font-mono text-xs text-slate-700 dark:text-slate-300">{score.toFixed(3)}</span>
	</div>
);

export const PredLabel = ({ pred }: { pred: 'P' | 'N' }) => (
	<span className={`text-sm font-semibold ${pred === 'P' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
		{pred === 'P' ? 'Likely crystalline' : 'Unlikely to crystallize'}
	</span>
);
