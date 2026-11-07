"use client"

import React, { useEffect, useRef, useState } from 'react';
import { FlaskConical, Plus, Send, Trash2 } from 'lucide-react';
import {
	AI_PREDICTION_DEFAULT_NUMBERS,
	AI_PREDICTION_FIELDS,
	AI_PREDICTION_LIVE_MAX_RECIPES,
	AI_PREDICTION_NUMERIC_RANGES,
	AI_PREDICTION_TEXT_MAX_LENGTH,
	AI_PREDICTION_TEXT_OPTIONS,
} from '@/constants';
import { fetchLivePrediction, fetchPredictionStatus } from '@/app/api/ai-prediction/handler';
import { checkNumericValue, checkTextValue, formatPredictionValue, isNumericField, isTextField } from '@/lib/prediction';
import { PredLabel, ScoreBar } from '@/components/PredictionScore';

type TextDrafts = Record<AiPredictionTextField, string>;
type NumberDrafts = Record<AiPredictionNumericField, string>;
type CardState = 'idle' | 'queued' | 'running' | 'waiting' | 'done' | 'error' | 'cancelled';

type RecipeCard = {
	id: number;
	texts: TextDrafts;
	drafts: NumberDrafts;
	state: CardState;
	result?: SynthesisPrediction;
	// The recipe the result belongs to, to spot edits made after the run
	resultKey?: string;
	message?: string;
};

const TEXT_FIELDS = AI_PREDICTION_FIELDS.filter(f => isTextField(f.key));
const NUMERIC_FIELDS = AI_PREDICTION_FIELDS.filter(f => isNumericField(f.key));

const INPUT_CLASS = "w-full p-2.5 pl-3 text-sm bg-white dark:bg-slate-800 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:text-slate-200 disabled:opacity-60";

const TEXT_PLACEHOLDERS: Record<AiPredictionTextField, string> = {
	metal_precursor: 'e.g. Zn(NO3)2·6H2O',
	organic_linker: 'e.g. terephthalic acid',
	modulator: 'e.g. acetic acid (blank = none)',
	solvent: 'e.g. dimethylformamide',
};

const STATUS_POLL_MS = 30_000;
// A recipe the server turns away as busy or rate limited waits and tries again
const MAX_RETRIES = 3;
const DEFAULT_RETRY_S = 10;

const STATUS_DOT: Record<AiPredictionLiveStatus, { dot: string; text: string }> = {
	online: { dot: 'bg-emerald-500', text: 'Model online' },
	busy: { dot: 'bg-amber-400', text: 'Model busy' },
	offline: { dot: 'bg-rose-500', text: 'Model offline' },
};

function newCard(id: number): RecipeCard {
	return {
		id,
		texts: { metal_precursor: '', organic_linker: '', modulator: '', solvent: '' },
		drafts: { ...AI_PREDICTION_DEFAULT_NUMBERS },
		state: 'idle',
	};
}

function recipeKey(recipe: SynthesisRecipe): string {
	return AI_PREDICTION_FIELDS.map(({ key }) => recipe[key]).join('|');
}

// The recipe a card describes, or null while a name is missing or a value is invalid
function checkCard(card: RecipeCard) {
	const textChecks = TEXT_FIELDS.map(({ key }) => checkTextValue(key as AiPredictionTextField, card.texts[key as AiPredictionTextField]));
	const checks = NUMERIC_FIELDS.map(({ key }) => checkNumericValue(key as AiPredictionNumericField, card.drafts[key as AiPredictionNumericField]));
	const recipe: SynthesisRecipe | null = textChecks.every(c => c.error == null) && checks.every(c => c.error == null)
		? {
			...Object.fromEntries(TEXT_FIELDS.map(({ key }, i) => [key, textChecks[i].value])),
			...Object.fromEntries(NUMERIC_FIELDS.map(({ key }, i) => [key, checks[i].value])),
		} as SynthesisRecipe
		: null;
	return { textChecks, checks, recipe };
}

// Already scored with exactly these values, so a submit can skip it
function isUpToDate(card: RecipeCard, recipe: SynthesisRecipe | null): boolean {
	return card.state === 'done' && recipe != null && card.resultKey === recipeKey(recipe);
}

function liveErrorMessage(code: AiPredictionErrorCode, message: string, retryAfter?: number): string {
	if (code === 'rate_limited' && retryAfter) {
		return `Too many predictions from your connection. Please try again in about ${retryAfter} s.`;
	}
	return message;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const LivePredictions: React.FC = () => {
	const [cards, setCards] = useState<RecipeCard[]>(() => [newCard(1)]);
	const cardsRef = useRef<RecipeCard[]>(cards);
	const nextIdRef = useRef(2);
	// A name box shows its message once it has been typed in, or after a submit
	const [touched, setTouched] = useState<Set<string>>(() => new Set());
	const [openSuggestionKey, setOpenSuggestionKey] = useState<string | null>(null);

	const [liveStatus, setLiveStatus] = useState<AiPredictionLiveStatus | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const runIdRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => { cardsRef.current = cards; }, [cards]);

	// Close an open suggestions menu when the user clicks anywhere outside its field.
	useEffect(() => {
		if (openSuggestionKey == null) return;

		const closeOnOutsidePointer = (event: PointerEvent) => {
			const target = event.target;
			if (!(target instanceof Element)) {
				setOpenSuggestionKey(null);
				return;
			}

			const field = target.closest<HTMLElement>('[data-ai-prediction-suggestion]');
			if (field?.dataset.aiPredictionSuggestion !== openSuggestionKey) {
				setOpenSuggestionKey(null);
			}
		};

		document.addEventListener('pointerdown', closeOnOutsidePointer);
		return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
	}, [openSuggestionKey]);

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

	const setText = (id: number, key: AiPredictionTextField, value: string) =>
		setCards(prev => prev.map(c => c.id === id ? { ...c, texts: { ...c.texts, [key]: value } } : c));

	const touch = (id: number, key: string) =>
		setTouched(prev => prev.has(`${id}:${key}`) ? prev : new Set(prev).add(`${id}:${key}`));

	const setDraft = (id: number, key: AiPredictionNumericField, value: string) =>
		setCards(prev => prev.map(c => c.id === id ? { ...c, drafts: { ...c.drafts, [key]: value } } : c));

	// A new card starts as a copy of the last one, so one condition can be changed and compared
	const addCard = () => setCards(prev => {
		if (prev.length >= AI_PREDICTION_LIVE_MAX_RECIPES) return prev;
		const last = prev[prev.length - 1];
		return [...prev, {
			id: nextIdRef.current++,
			texts: { ...last.texts },
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
		// Show what is still missing on every card
		setTouched(new Set(cardsRef.current.flatMap(c => TEXT_FIELDS.map(({ key }) => `${c.id}:${key}`))));
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
	// Submit stays clickable while names are missing, so a click can point them out
	const nothingToDo = toRun === 0 && checked.every(({ recipe }) => recipe != null);
	const statusDot = liveStatus ? STATUS_DOT[liveStatus] : null;

	// Typed name with an in-field suggestions menu for each text condition.
	const renderTextInput = (card: RecipeCard, textChecks: ReturnType<typeof checkCard>['textChecks'], { key, label }: (typeof AI_PREDICTION_FIELDS)[number], index: number) => {
		const textKey = key as AiPredictionTextField;
		const error = touched.has(`${card.id}:${key}`) ? textChecks[index].error : null;
		const hintId = `ai-pred-${card.id}-${key}-hint`;
		const inputId = `ai-pred-${card.id}-${key}-input`;
		const menuId = `ai-pred-${card.id}-${key}-suggestions`;
		const suggestionKey = `${card.id}:${textKey}`;
		const options = AI_PREDICTION_TEXT_OPTIONS[textKey];
		const suggestionsOpen = openSuggestionKey === suggestionKey;

		return (
			<div key={key} className="block ai-prediction-field">
				<label htmlFor={inputId} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
				<div
					className={`ai-prediction-input-shell ${error ? 'is-invalid' : ''}`}
					data-ai-prediction-suggestion={suggestionKey}
					onBlur={(event) => {
						const nextTarget = event.relatedTarget;
						if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
							setOpenSuggestionKey(current => current === suggestionKey ? null : current);
						}
					}}
				>
					<input
						id={inputId}
						type="text"
						value={card.texts[textKey]}
						onChange={(e) => {
							setText(card.id, textKey, e.target.value);
							touch(card.id, key);
						}}
						onKeyDown={(e) => {
							if (e.key === 'ArrowDown' && options.length > 0) {
								e.preventDefault();
								setOpenSuggestionKey(suggestionKey);
							} else if (e.key === 'Escape' && suggestionsOpen) {
								e.preventDefault();
								setOpenSuggestionKey(null);
							}
						}}
						placeholder={TEXT_PLACEHOLDERS[textKey]}
						maxLength={AI_PREDICTION_TEXT_MAX_LENGTH + 20}
						autoComplete="off"
						spellCheck={false}
						disabled={isRunning}
						aria-invalid={error != null}
						aria-describedby={error ? hintId : undefined}
						className="ai-prediction-text-input"
					/>
					<button
						type="button"
						className="ai-prediction-suggestion-trigger"
						aria-label={`${suggestionsOpen ? 'Hide' : 'Show'} suggested ${label.toLowerCase()} values`}
						aria-haspopup="menu"
						aria-expanded={suggestionsOpen}
						aria-controls={suggestionsOpen ? menuId : undefined}
						title={`Choose a suggested ${label.toLowerCase()}`}
						disabled={isRunning || options.length === 0}
						onClick={() => setOpenSuggestionKey(current => current === suggestionKey ? null : suggestionKey)}
					/>
					{suggestionsOpen && options.length > 0 && (
						<div id={menuId} className="ai-prediction-suggestion-menu" role="menu" aria-label={`Suggested ${label.toLowerCase()} values`}>
							{options.map((option) => (
								<button
									type="button"
									key={option}
									role="menuitemradio"
									aria-checked={card.texts[textKey] === option}
									className="ai-prediction-suggestion-option"
									onClick={() => {
										setText(card.id, textKey, option);
										touch(card.id, key);
										setOpenSuggestionKey(null);
									}}
								>
									{option}
								</button>
							))}
						</div>
					)}
				</div>
				{error && <span id={hintId} className="block mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</span>}
			</div>
		);
	};

	// Typed number within the training range
	const renderNumberInput = (card: RecipeCard, checks: ReturnType<typeof checkCard>['checks'], { key, label, unit }: (typeof AI_PREDICTION_FIELDS)[number], index: number) => {
		const numericKey = key as AiPredictionNumericField;
		const { min, max, step } = AI_PREDICTION_NUMERIC_RANGES[numericKey];
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
					value={card.drafts[numericKey]}
					onChange={(e) => setDraft(card.id, numericKey, e.target.value)}
					disabled={isRunning}
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
					Running the model… <span aria-hidden="true">{elapsed} s</span>
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
					{recipe ? 'Not submitted yet.' : 'Fill in the recipe, then submit.'}
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
					{/* The model server's mock backend (a wiring test, no model) */}
					{/mock|test mode/i.test(result.model) && (
						<span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
							{result.model}
						</span>
					)}
					{result.latencyMs != null && <span>Answered in {(result.latencyMs / 1000).toFixed(1)} s</span>}
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

			{checked.map(({ card, textChecks, checks, recipe }, index) => (
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
						{TEXT_FIELDS.map((field, i) => renderTextInput(card, textChecks, field, i))}
					</div>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
						disabled={nothingToDo}
						className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<Send size={14} />
						{toRun > 1 ? `Submit ${toRun} recipes` : 'Submit'}
					</button>
				)}
				<button
					type="button"
					onClick={addCard}
					disabled={isRunning || cards.length >= AI_PREDICTION_LIVE_MAX_RECIPES}
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
