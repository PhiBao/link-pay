"use client";

import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string | null;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, containerClassName = "", className = "", ...props }, ref) => {
    return (
      <div className={`flex flex-col gap-2 ${containerClassName}`}>
        {label && (
          <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`h-14 w-full rounded-lg border bg-zinc-50 px-5 text-[15px] text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-400 focus:bg-white focus:outline-none dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-zinc-800 ${
            error
              ? "border-red-300 dark:border-red-700"
              : "border-zinc-200 dark:border-zinc-800"
          } ${className}`}
          {...props}
        />
        {helperText && !error && (
          <p className="text-xs text-zinc-400">{helperText}</p>
        )}
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
