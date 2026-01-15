const ErrorPanel = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/30">
    <div className="font-semibold text-red-800 dark:text-red-200">Failed to load data</div>
    <div className="mt-1 text-sm text-red-700 dark:text-red-300 break-words">{message}</div>
    <button
      onClick={onRetry}
      className="mt-4 inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
    >
      Retry
    </button>
  </div>
);

export default ErrorPanel