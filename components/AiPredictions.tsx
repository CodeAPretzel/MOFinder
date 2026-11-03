"use client"

import React, { useEffect, useState } from 'react';
import { X, Brain, ChevronDown, Trophy, FlaskConical } from 'lucide-react';
import { AI_PREDICTION_FIELDS, AI_PREDICTION_FULL_MODEL_URL, AI_PREDICTION_NUMERIC_RANGES, AI_PREDICTION_TOP_LIMIT } from '@/constants';
import {
	fetchPrediction,
	fetchPredictionConfig,
	fetchPredictionOptions,
	fetchTopRecipes,
} from '@/app/api/ai-prediction/handler';
import { formatPredictionValue } from '@/lib/prediction';
import { PredLabel, ScoreBar } from '@/components/PredictionScore';
import LivePredictions from '@/components/LivePredictions';

const PAIR_FIELDS = AI_PREDICTION_FIELDS.filter(f => f.key === 'metal_precursor' || f.key === 'organic_linker');
const CONDITION_FIELDS = AI_PREDICTION_FIELDS.filter(f => f.key !== 'metal_precursor' && f.key !== 'organic_linker');

const SELECT_CLASS = "w-full p-2.5 pl-3 pr-8 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg appearance-none focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-slate-200";

const FullModelLink = ({ url }: { url: string }) => (
	<a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-600 dark:hover:text-indigo-400">
		Hugging Face
	</a>
);

const AiPredictions: React.FC<AiPredictionsProps> = ({ isOpen, onClose }) => {
	const [options, setOptions] = useState<AiPredictionOptions | null>(null);
	const [optionsError, setOptionsError] = useState<string | null>(null);

	// Which mode the server runs in; null until /config answers
	const [config, setConfig] = useState<AiPredictionConfig | null>(null);
	const [configFailed, setConfigFailed] = useState(false);
	const mode: AiPredictionMode | null = config?.mode ?? (configFailed ? 'precomputed' : null);
	const isLive = mode === 'live';

	// Precomputed mode (Plan A): metal + linker pair, top recipes, one checked recipe
	const [recipe, setRecipe] = useState<Partial<SynthesisRecipe>>({});

	const [top, setTop] = useState<SynthesisPrediction[] | null>(null);
	const [topLoading, setTopLoading] = useState(false);
	const [topError, setTopError] = useState<string | null>(null);

	const [prediction, setPrediction] = useState<SynthesisPrediction | null>(null);
	const [predictionLoading, setPredictionLoading] = useState(false);
	const [predictionError, setPredictionError] = useState<string | null>(null);

	// Load the dropdown choices the first time the panel opens
	useEffect(() => {
		if (!isOpen || options) return;
		let cancelled = false;

		fetchPredictionOptions()
			.then((loaded) => {
				if (cancelled) return;
				setOptions(loaded);
				// Start the condition dropdowns on the first choice of each
				setRecipe((prev) => {
					const next = { ...prev };
					for (const { key } of CONDITION_FIELDS) {
						if (next[key] == null) (next as Record<string, unknown>)[key] = loaded[key][0];
					}
					return next;
				});
			})
			.catch((err) => !cancelled && setOptionsError(err.message));

		return () => { cancelled = true; };
	}, [isOpen, options]);

	// Precomputed (Plan A) or live (Plan B); if this fails, behave like Plan A
	useEffect(() => {
		if (!isOpen || config || configFailed) return;
		let cancelled = false;

		fetchPredictionConfig()
			.then((loaded) => !cancelled && setConfig(loaded))
			.catch(() => !cancelled && setConfigFailed(true));

		return () => { cancelled = true; };
	}, [isOpen, config, configFailed]);

	const metal = recipe.metal_precursor ?? '';
	const linker = recipe.organic_linker ?? '';

	// Best recipes whenever the metal + linker pair changes
	useEffect(() => {
		if (!metal || !linker || mode !== 'precomputed') {
			setTop(null);
			return;
		}
		let cancelled = false;
		setTopLoading(true);
		setTopError(null);

		fetchTopRecipes({ metal_precursor: metal, organic_linker: linker }, AI_PREDICTION_TOP_LIMIT)
			.then((data) => !cancelled && setTop(data))
			.catch((err) => !cancelled && setTopError(err.message))
			.finally(() => !cancelled && setTopLoading(false));

		return () => { cancelled = true; };
	}, [metal, linker, mode]);

	// Score the full recipe once every field is chosen
	const isComplete = AI_PREDICTION_FIELDS.every(({ key }) => recipe[key] != null && recipe[key] !== '');
	const recipeKey = AI_PREDICTION_FIELDS.map(({ key }) => recipe[key]).join('|');

	useEffect(() => {
		if (!isComplete || mode !== 'precomputed') {
			setPrediction(null);
			return;
		}
		let cancelled = false;
		setPredictionLoading(true);
		setPredictionError(null);

		fetchPrediction(recipe as SynthesisRecipe)
			.then((data) => !cancelled && setPrediction(data))
			.catch((err) => !cancelled && setPredictionError(err.message))
			.finally(() => !cancelled && setPredictionLoading(false));

		return () => { cancelled = true; };
		// recipeKey captures every recipe field
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [recipeKey, isComplete, mode]);

	if (!isOpen) return null;

	const ranges = config?.numericRanges ?? AI_PREDICTION_NUMERIC_RANGES;
	const fullModelUrl = config?.liveModel.fullModelUrl ?? AI_PREDICTION_FULL_MODEL_URL;

	const setField = (key: AiPredictionField, raw: string, numeric: boolean) => {
		setRecipe(prev => ({ ...prev, [key]: raw === '' ? undefined : numeric ? Number(raw) : raw }));
	};

	const renderSelect = ({ key, label, numeric }: (typeof AI_PREDICTION_FIELDS)[number], placeholder?: string) => (
		<label key={key} className="block">
			<span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</span>
			<div className="relative">
				<select
					value={recipe[key] ?? ''}
					onChange={(e) => setField(key, e.target.value, numeric)}
					disabled={!options}
					className={SELECT_CLASS}
				>
					{placeholder && <option value="">{placeholder}</option>}
					{(options?.[key] ?? []).map(value =>
						<option key={String(value)} value={value}>{formatPredictionValue(key, value)}</option>
					)}
				</select>
				<ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={16} />
			</div>
		</label>
	);

	const renderPrecomputed = () => (
		<>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{PAIR_FIELDS.map(field => renderSelect(field, `Select ${field.label.toLowerCase()}`))}
			</div>

			{/* Top recipes */}
			{metal && linker && (
				<section className="space-y-2">
					<h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
						<Trophy size={16} className="text-indigo-600 dark:text-indigo-400" />
						Top {AI_PREDICTION_TOP_LIMIT} predicted recipes
					</h4>

					{topError && <p className="text-sm text-rose-600 dark:text-rose-400">{topError}</p>}

					<div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
						<table className="w-full text-xs">
							<thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
								<tr>
									<th className="px-3 py-2 text-left font-medium">Score</th>
									{CONDITION_FIELDS.map(({ key, label }) =>
										<th key={key} className="px-3 py-2 text-left font-medium whitespace-nowrap">{label}</th>
									)}
								</tr>
							</thead>
							<tbody className={topLoading ? 'opacity-50' : ''}>
								{(top ?? []).map((row, i) => (
									<tr
										key={i}
										onClick={() => setRecipe(row.recipe)}
										className="border-t border-slate-100 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer"
										title="Load this recipe below"
									>
										<td className="px-3 py-2"><ScoreBar score={row.score} pred={row.pred} /></td>
										{CONDITION_FIELDS.map(({ key }) =>
											<td key={key} className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
												{formatPredictionValue(key, row.recipe[key])}
											</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p className="text-xs text-slate-400">Click a row to load it into the recipe checker.</p>
				</section>
			)}

			{/* Single recipe */}
			<section className="space-y-3">
				<h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
					<FlaskConical size={16} className="text-indigo-600 dark:text-indigo-400" />
					Check a specific recipe
				</h4>

				<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
					{CONDITION_FIELDS.map(field => renderSelect(field))}
				</div>

				<div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50">
					{!metal || !linker ? (
						<p className="text-sm text-slate-500 dark:text-slate-400">Select a metal precursor and a linker to score this recipe.</p>
					) : predictionError ? (
						<p className="text-sm text-rose-600 dark:text-rose-400">{predictionError}</p>
					) : prediction ? (
						<div className={`flex flex-col sm:flex-row sm:items-center gap-3 ${predictionLoading ? 'opacity-50' : ''}`}>
							<div className="flex-1">
								<ScoreBar score={prediction.score} pred={prediction.pred} />
							</div>
							<PredLabel pred={prediction.pred} />
						</div>
					) : (
						<p className="text-sm text-slate-500 dark:text-slate-400">Scoring…</p>
					)}
				</div>
			</section>

			<p className="text-xs text-slate-400 dark:text-slate-500">
				Scores are precomputed by the MOFinder model for 1,000,000 recipes on a fixed grid of conditions
				{prediction ? ` (model ${prediction.model})` : ''}.
			</p>
		</>
	);

	return (
		<div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
			<div className="bg-white dark:bg-slate-900 w-full max-w-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-10 duration-300 border border-slate-200 dark:border-slate-800">

				{/* Header */}
				<div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-blue-600 text-white sm:rounded-t-2xl">
					<div className="flex items-center gap-2">
						<Brain size={20} />
						<h3 className="font-bold">AI MOF Recommender</h3>
					</div>
					<button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded-full transition-colors">
						<X size={20} />
					</button>
				</div>

				{/* Body */}
				<div className="flex-1 p-6 overflow-y-auto space-y-6">
					<p className="text-sm text-slate-600 dark:text-slate-400">
						{isLive
							? 'Describe a synthesis and submit it to the live MOFinder model. '
							: 'Pick a metal precursor and an organic linker to see the synthesis conditions the model scores highest. '}
						The score is the predicted probability that the synthesis gives a crystalline product.
					</p>

					{optionsError && (
						<div className="p-3 text-sm rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300">
							Could not load the prediction options: {optionsError}
						</div>
					)}

					{mode == null ? (
						<p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
					) : isLive ? (
						<>
							<LivePredictions options={options} ranges={ranges} />
							<p className="text-xs text-slate-400 dark:text-slate-500">
								Live scores come from a quantized (compressed) copy of GPT-oss-MOFinder running on the lab server, so they can
								differ slightly from the precomputed scores. The full model is on{' '}
								<FullModelLink url={fullModelUrl} />.
							</p>
						</>
					) : renderPrecomputed()}
				</div>
			</div>
		</div>
	);
};

export default AiPredictions
