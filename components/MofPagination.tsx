"use client";

import React, { useEffect, useState } from "react";
import MofCard from "@/components/MofCard";

const buttonBaseClasses =
  "px-4 py-2 text-sm font-medium transition-colors";

const MofPagination: React.FC<MofPaginationProps> = ({
  data,
  onCardClick,
  pageSize = 9,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [inputValue, setInputValue] = useState("1");

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
    setInputValue("1");
  }, [data]);

  useEffect(() => {
    setInputValue(String(currentPage));
  }, [currentPage]);

  const handlePrev = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNext = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
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
      setCurrentPage(page);
    } else {
      setInputValue(String(currentPage));
    }
  };

  const startIndex = (currentPage - 1) * pageSize;
  const currentItems = data.slice(startIndex, startIndex + pageSize);

  return (
    <div className="flex flex-col gap-4">
      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {currentItems.map((mof, index) => (
          <MofCard
            key={`${mof.mof_name}-${startIndex + index}`}
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
              disabled={currentPage === 1}
              className={`${buttonBaseClasses} ${currentPage === 1
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
            disabled={currentPage === totalPages}
            className={`${buttonBaseClasses} ${currentPage === totalPages
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