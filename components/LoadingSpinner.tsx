import Image from "next/image";

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center py-16">
    <Image 
      src="/icons/loader.svg"
      width={30}
      height={30}
      alt="Loading"
      className="h-10 w-10 animate-spin"
    />
    <div className="mt-4 text-sm text-slate-600 dark:text-slate-500">
      Loading MOF dataset…
    </div>
  </div>
);

export default LoadingSpinner