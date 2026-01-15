const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-transparent dark:border-slate-700" />
    <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
      Loading MOF dataset…
    </div>
  </div>
);

export default LoadingSpinner