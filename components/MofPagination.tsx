"use client";

import React, { useEffect, useState } from "react";
import MofCard from "@/components/MofCard";

const buttonBaseClasses =
  "px-4 py-2 text-sm font-medium transition-colors";

const MofPagination: React.FC<MofPaginationProps> = ({
  data,
  total,
  page,
  onPageChange,
  pageSize = 9,
  onCardClick,
}) => {
  const [inputValue, setInputValue] = useState("1");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setInputValue(String(page));
  }, [page]);

  const handlePrev = () => {
    onPageChange(Math.max(1, page - 1));
  };

  const handleNext = () => {
    onPageChange(Math.min(totalPages, page + 1));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setInputValue(value);
    }
  };

  const goToPage = () => {
    if (inputValue === "") return;
    const page = Number(inputValue);
    if (!Number.isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
    } else {
      setInputValue(String(page));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {data.map((mof, index) => (
          <MofCard
            key={`${mof.mof_name}-${index}`}
            mof={mof}
            onClick={onCardClick}
          />
        ))}
      </div>

      {/* Pagination controls (no styling assumptions) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center mt-6">
          <div>
            <button
              onClick={handlePrev}
              disabled={page === 1}
              className={`${buttonBaseClasses} ${page === 1
                ? "text-gray-500"
                : "text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                }`}
            >
              Prev
            </button>
          </div>

          <span className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-300">
            <span>Page</span>
            <input
              type="text"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-sm px-2 py-1 w-12 text-center"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  goToPage();
                }
              }}
              onBlur={goToPage}
            />
            <span>of {totalPages}</span>
          </span>

          <button
            onClick={handleNext}
            disabled={page === totalPages}
            className={`${buttonBaseClasses} ${page === totalPages
              ? "text-gray-500"
              : "text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
              }`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default MofPagination;