"use client"

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FlaskConical, Plus, Send, Trash2 } from 'lucide-react';
import { AI_PREDICTION_FIELDS, AI_PREDICTION_LIVE_MAX_RECIPES } from '@/constants';
import { fetchLivePrediction, fetchPredictionStatus } from '@/app/api/ai-prediction/handler';
import { checkNumericValue, formatPredictionValue, isNumericField, isOnGrid } from '@/lib/prediction';
import { PredLabel, ScoreBar } from '@/components/PredictionScore';

type ChoiceField = 'metal_precursor' | 'organic_linker' | 'modulator' | 'solvent';
type NumberDrafts = Record<AiPredictionNumericField, string>;
type CardState = 'idle' | 'queued' | 'running' | 'waiting' | 'done' | 'error' | 'cancelled';

type RecipeCard = {
	id: number;
	choices: Partial<Record<ChoiceField, string>>;
	drafts: NumberDrafts;
	state: CardState;
	result?: SynthesisPrediction;
	// The recipe the result belongs to, to spot edits made after the run
	resultKey?: string;
	message?: string;
};

const PAIR_FIELDS = AI_PREDICTION_FIELDS.filter(f => f.key === 'metal_precursor' || f.key === 'organic_linker');
const CONDITION_CHOICES = AI_PREDICTION_FIELDS.filter(f => f.key === 'modulator' || f.key === 'solvent');
const NUMERIC_FIELDS = AI_PREDICTION_FIELDS.filter(f => isNumericField(f.key));

const SELECT_CLASS = "w-full p-2.5 pl-3 pr-8 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg appearance-none focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-slate-200 disabled:opacity-60";
const INPUT_CLASS = "w-full p-2.5 pl-3 text-sm bg-white dark:bg-slate-800 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-slate-200 disabled:opacity-60";

const STATUS_POLL_MS = 30_000;
// A recipe the server turns away as busy or rate limited waits and tries again
const MAX_RETRIES = 3;
const DEFAULT_RETRY_S = 10;

const STATUS_DOT: Record<AiPredictionLiveStatus, { dot: string; text: string }> = {
	online: { dot: 'bg-emerald-500', text: 'Live model online' },
	busy: { dot: 'bg-amber-400', text: 'Live model busy' },
	offline: { dot: 'bg-rose-500', text: 'Live model offline' },
	disabled: { dot: 'bg-slate-400', text: 'Live model off' },
};

function recipeKey(recipe: SynthesisRecipe): string {
	return AI_PREDICTION_FIELDS.map(({ key }) => recipe[key]).join('|');
}

// The recipe a card describes, or null while a choice is missing or a number is invalid
function checkCard(card: RecipeCard) {
	const checks = NUMERIC_FIELDS.map(({ key }) => checkNumericValue(key as AiPredictionNumericField, card.drafts[key as AiPredictionNumericField]));
	const { metal_precursor, organic_linker, modulator, solvent } = card.choices;
	const recipe: SynthesisRecipe | null = metal_precursor && organic_linker && modulator && solvent && checks.every(c => c.error == null)
		? {
			metal_precursor,
			organic_linker,
			modulator,
			solvent,
			...Object.fromEntries(NUMERIC_FIELDS.map(({ key }, i) => [key, checks[i].value])),
		} as SynthesisRecipe
		: null;
	return { checks, recipe };
}

// Already scored with exactly these values, so a submit can skip it
function isUpToDate(card: RecipeCard, recipe: SynthesisRecipe | null): boolean {
	return card.state === 'done' && recipe != null && card.resultKey === recipeKey(recipe);
}

function liveErrorMessage(code: AiPredictionErrorCode, message: string, retryAfter?: number): string {
	if (code === 'rate_limited' && retryAfter) {
		return `Too many live predictions from your connection. Please try again in about ${retryAfter} s.`;
	}
	return message;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const LivePredictions: React.FC<LivePredictionsProps> = ({ options, ranges }) => {
	const [cards, setCards] = useState<RecipeCard[]>([]);
	const cardsRef = useRef<RecipeCard[]>([]);
	const nextIdRef = useRef(1);

	const [liveStatus, setLiveStatus] = useState<AiPredictionLiveStatus | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const runIdRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => { cardsRef.current = cards; }, [cards]);

	// First card once the dropdown choices are in: no pair yet, first choice of the rest
	useEffect(() => {
		if (!options || cards.length > 0) return;
		const drafts = Object.fromEntries(NUMERIC_FIELDS.map(({ key }) => [key, String(options[key][0])])) as NumberDrafts;
		setCards([{
			id: nextIdRef.current++,
			choices: { modulator: String(options.modulator[0]), solvent: String(options.solvent[0]) },
			drafts,
			state: 'idle',
		}]);
	}, [options, cards.length]);

	// Status dot, refreshed while the panel is open
	useEffect(() => {
		let cancelled = false;
		const refresh = () => fetchPredictionStatus()
			.then((status) => !cancelled && setLiveStatus(status.live))
			.catch(() => !cancelled && setLiveStatus('offline'));

		refresh();
		const timer = setInterval(refresh, STATUS_POLL_MS);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, []);

	// Seconds counter for the recipe being scored
	useEffect(() => {
		if (runStartedAt == null) return;
		setElapsed(0);
		const timer = setInterval(() => setElapsed(Math.floor((Date.now() - runStartedAt) / 1000)), 250);
		return () => clearInterval(timer);
	}, [runStartedAt]);

	// Closing the panel stops a running submit
	useEffect(() => () => {
		runIdRef.current += 1;
		abortRef.current?.abort();
	}, []);

	const updateCard = (id: number, patch: Partial<RecipeCard>) =>
		setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));

	const setChoice = (id: number, key: ChoiceField, value: string) =>
		setCards(prev => prev.map(c => c.id === id ? { ...c, choices: { ...c.choices, [key]: value || undefined } } : c));

	const setDraft = (id: number, key: AiPredictionNumericField, value: string) =>
		setCards(prev => prev.map(c => c.id === id ? { ...c, drafts: { ...c.drafts, [key]: value } } : c));

	// A new card starts as a copy of the last one, so one condition can be changed and compared
	const addCard = () => setCards(prev => {
		if (prev.length >= AI_PREDICTION_LIVE_MAX_RECIPES) return prev;
		const last = prev[prev.length - 1];
		return [...prev, {
			id: nextIdRef.current++,
			choices: { ...last.choices },
			drafts: { ...last.drafts },
			state: 'idle',
		}];
	});

	const removeCard = (id: number) => setCards(prev => prev.length > 1 ? prev.filter(c => c.id !== id) : prev);

	// One recipe, retried a few times when the model is busy; false when the submit was cancelled
	const scoreCard = async (id: number, recipe: SynthesisRecipe, runId: number): Promise<boolean> => {
		for (let attempt = 0; ; attempt++) {
			const controller = new AbortController();
			abortRef.current = controller;
			updateCard(id, { state: 'running', message: undefined });
			setRunStartedAt(Date.now());

			let result;
			try {
				result = await fetchLivePrediction(recipe, controller.signal);
			} catch {
				return false;
			}
			if (runId !== runIdRef.current) return false;
			setRunStartedAt(null);

			if (result.ok) {
				updateCard(id, { state: 'done', result: result.data, resultKey: recipeKey(recipe), message: undefined });
				return true;
			}

			if ((result.code === 'busy' || result.code === 'rate_limited') && attempt < MAX_RETRIES) {
				const wait = result.retryAfter ?? DEFAULT_RETRY_S;
				updateCard(id, { state: 'waiting', message: `The model is busy. Trying again in about ${wait} s…` });
				await sleep(wait * 1000);
				if (runId !== runIdRef.current) return false;
				continue;
			}

			updateCard(id, { state: 'error', message: liveErrorMessage(result.code, result.error, result.retryAfter) });
			if (result.code === 'busy' || result.code === 'offline' || result.code === 'timeout') {
				fetchPredictionStatus().then((s) => setLiveStatus(s.live)).catch(() => setLiveStatus('offline'));
			}
			return true;
		}
	};

	// Scores every card that needs it, one at a time, top to bottom
	const submit = async () => {
		if (isRunning) return;
		const todo = cardsRef.current
			.filter(c => {
				const { recipe } = checkCard(c);
				return recipe != null && !isUpToDate(c, recipe);
			})
			.map(c => c.id);
		if (todo.length === 0) return;

		const runId = ++runIdRef.current;
		setIsRunning(true);
		setCards(prev => prev.map(c => todo.includes(c.id) ? { ...c, state: 'queued', message: undefined } : c));

		for (const id of todo) {
			const card = cardsRef.current.find(c => c.id === id);
			const recipe = card ? checkCard(card).recipe : null;
			if (!recipe) continue;
			if (!(await scoreCard(id, recipe, runId))) return;
		}

		if (runId === runIdRef.current) {
			setIsRunning(false);
			abortRef.current = null;
		}
	};

	const cancel = () => {
		runIdRef.current += 1;
		abortRef.current?.abort();
		abortRef.current = null;
		setIsRunning(false);
		setRunStartedAt(null);
		setCards(prev => prev.map(c =>
			c.state === 'queued' ? { ...c, state: c.result ? 'done' : 'idle' }
			: c.state === 'running' || c.state === 'waiting' ? { ...c, state: 'cancelled', message: 'Cancelled.' }
			: c
		));
	};

	const checked = cards.map(c => ({ card: c, ...checkCard(c) }));
	const toRun = checked.filter(({ card, recipe }) => recipe != null && !isUpToDate(card, recipe)).length;
	const statusDot = liveStatus ? STATUS_DOT[liveStatus] : null;

	const renderSelect = (card: RecipeCard, { key, label }: (typeof AI_PREDICTION_FIELDS)[number], placeholder?: string) => (
		<label key={key} className="block">
			<span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</span>
			<div className="relative">
				<select
					value={card.choices[key as ChoiceField] ?? ''}
					onChange={(e) => setChoice(card.id, key as ChoiceField, e.target.value)}
					disabled={!options || isRunning}
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

	// Typed number with the grid values offered as suggestions
	const renderNumberInput = (card: RecipeCard, checks: ReturnType<typeof checkCard>['checks'], { key, label, unit }: (typeof AI_PREDICTION_FIELDS)[number], index: number) => {
		const numericKey = key as AiPredictionNumericField;
		const { min, max, step } = ranges[numericKey];
		const { error } = checks[index];
		const hintId = `ai-pred-${card.id}-${key}-hint`;

		return (
			<label key={key} className="block">
				<span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
					{label}{unit ? ` (${unit})` : ''}
				</span>
				<input
					type="number"
					inputMode="decimal"
					min={min}
					max={max}
					step={step}
					list={`ai-pred-${key}-grid`}
					value={card.drafts[numericKey]}
					onChange={(e) => setDraft(card.id, numericKey, e.target.value)}
					disabled={!options || isRunning}
					aria-invalid={error != null}
					aria-describedby={hintId}
					className={`${INPUT_CLASS} ${error ? 'border-rose-400 dark:border-rose-500' : 'border-slate-200 dark:border-slate-700'}`}
				/>
				<span id={hintId} className={`block mt-1 text-xs ${error ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
					{error ?? `${formatPredictionValue(key, min)} to ${formatPredictionValue(key, max)}`}
				</span>
			</label>
		);
	};

	const renderResult = (card: RecipeCard, recipe: SynthesisRecipe | null) => {
		if (card.state === 'queued') {
			return <p className="text-sm text-slate-500 dark:text-slate-400">Waiting for its turn…</p>;
		}
		if (card.state === 'running') {
			return (
				<p className="text-sm text-slate-600 dark:text-slate-300">
					Running the live model… <span aria-hidden="true">{elapsed} s</span>
				</p>
			);
		}

		const note = card.message && (
			<p className={`text-sm ${card.state === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
				{card.message}
			</p>
		);
		const result = card.result;

		if (!result) {
			if (note) return note;
			return (
				<p className="text-sm text-slate-500 dark:text-slate-400">
					{card.choices.metal_precursor && card.choices.organic_linker
						? 'Not submitted yet.'
						: 'Select a metal precursor and a linker.'}
				</p>
			);
		}

		const changed = recipe == null || card.resultKey !== recipeKey(recipe);

		return (
			<div className="space-y-2">
				{note}
				<div className={`flex flex-col sm:flex-row sm:items-center gap-3 ${changed || card.state !== 'done' ? 'opacity-50' : ''}`}>
					<div className="flex-1">
						<ScoreBar score={result.score} pred={result.pred} />
					</div>
					<PredLabel pred={result.pred} />
				</div>
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
					<span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-medium">Live model</span>
					{/* The model server's mock backend (a wiring test) answers from the precomputed table */}
					{/mock|test mode/i.test(result.model) && (
						<span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
							{result.model}
						</span>
					)}
					{result.latencyMs != null && <span>{(result.latencyMs / 1000).toFixed(1)} s</span>}
					{result.precomputedScore != null ? (
						<span>Full model (precomputed): <span className="font-mono">{result.precomputedScore.toFixed(3)}</span></span>
					) : options && !isOnGrid(result.recipe, options) ? (
						<span>Not on the precomputed grid, so there is no full-model score to compare.</span>
					) : null}
				</div>
				{changed && <p className="text-xs text-slate-500 dark:text-slate-400">The conditions changed since this run. Submit to score them.</p>}
			</div>
		);
	};

	return (
		<form
			noValidate
			onSubmit={(e) => {
				e.preventDefault();
				submit();
			}}
			className="space-y-4"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
					<FlaskConical size={16} className="text-indigo-600 dark:text-indigo-400" />
					{cards.length > 1 ? 'Your recipes' : 'Your recipe'}
				</h4>
				{statusDot && (
					<span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
						<span className={`inline-block w-2 h-2 rounded-full ${statusDot.dot}`} />
						{statusDot.text}
					</span>
				)}
			</div>

			{/* Shared by every card's number inputs */}
			{NUMERIC_FIELDS.map(({ key }) => (
				<datalist key={key} id={`ai-pred-${key}-grid`}>
					{(options?.[key] ?? []).map(value => <option key={String(value)} value={value} />)}
				</datalist>
			))}

			{checked.map(({ card, checks, recipe }, index) => (
				<section key={card.id} className="p-4 space-y-3 rounded-xl border border-slate-200 dark:border-slate-800">
					{cards.length > 1 && (
						<div className="flex items-center justify-between">
							<h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recipe {index + 1}</h5>
							<button
								type="button"
								onClick={() => removeCard(card.id)}
								disabled={isRunning}
								aria-label={`Remove recipe ${index + 1}`}
								className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
							>
								<Trash2 size={14} />
							</button>
						</div>
					)}

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{PAIR_FIELDS.map(field => renderSelect(card, field, `Select ${field.label.toLowerCase()}`))}
					</div>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
						{CONDITION_CHOICES.map(field => renderSelect(card, field))}
						{NUMERIC_FIELDS.map((field, i) => renderNumberInput(card, checks, field, i))}
					</div>

					<div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50" aria-live="polite">
						{renderResult(card, recipe)}
					</div>
				</section>
			))}

			<div className="flex flex-wrap items-center gap-3">
				{isRunning ? (
					<button
						type="button"
						onClick={cancel}
						className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
					>
						Cancel
					</button>
				) : (
					<button
						type="submit"
						disabled={toRun === 0}
						className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<Send size={14} />
						{toRun > 1 ? `Submit ${toRun} recipes` : 'Submit'}
					</button>
				)}
				<button
					type="button"
					onClick={addCard}
					disabled={isRunning || cards.length === 0 || cards.length >= AI_PREDICTION_LIVE_MAX_RECIPES}
					className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<Plus size={14} />
					Add another recipe
				</button>
				{cards.length > 1 && (
					<span className="text-xs text-slate-400">
						Recipes are scored one at a time, up to {AI_PREDICTION_LIVE_MAX_RECIPES}.
					</span>
				)}
			</div>
		</form>
	);
};

export default LivePredictions
