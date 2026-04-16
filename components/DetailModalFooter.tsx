"use client";

import { Share2, Download, FileText } from "lucide-react";

const DetailModalFooter = ({
	mof,
	shareStatus,
	onShare,
	onExport,
}: {
	mof: DetailModalProps["mof"];
	shareStatus: "idle" | "copied" | "failed";
	onShare: () => Promise<void> | void;
	onExport: () => void;
}) => {
	return (
		<div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center sticky bottom-0">
			<a
				href={`https://doi.org/${mof.doi}`}
				target="_blank"
				rel="noopener noreferrer"
				className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
			>
				View Original Paper <FileText size={16} />
			</a>

			<div className="flex gap-3">
				<button
					className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
					onClick={onShare}
				>
					<Share2 size={16} />
					{shareStatus === "copied"
						? "Copied!"
						: shareStatus === "failed"
							? "Copy failed"
							: "Share"}
				</button>

				<button
					className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm shadow-blue-200 dark:shadow-none"
					onClick={onExport}
				>
					<Download size={16} /> Export Data
				</button>
			</div>
		</div>
	);
};

export default DetailModalFooter;