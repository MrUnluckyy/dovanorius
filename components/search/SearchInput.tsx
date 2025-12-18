import React from "react";
import { LuSearch } from "react-icons/lu";

export function SearchInput({
  variant,
  loading,
  inputRef,
  term,
  onSubmit,
  setTerm,
  onKeyDown,
  onOpen,
}: {
  variant: "small" | "overlay";
  loading: boolean;
  term: string;
  onSubmit: (e: React.FormEvent) => void;
  setTerm: React.Dispatch<React.SetStateAction<string>>;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onOpen: (open: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <form onSubmit={onSubmit} className="form-control">
      <label
        className={[
          "input input-bordered flex items-center gap-2 w-full",
          variant === "small" ? "max-w-md" : "h-12 text-base",
        ].join(" ")}
      >
        <LuSearch />
        <input
          ref={inputRef}
          type="search"
          value={term}
          onFocus={() => onOpen(true)}
          onChange={(e) => {
            setTerm(e.target.value);
          }}
          onKeyDown={onKeyDown}
          placeholder="Ieškoti žmonių..."
          aria-label="ieškoti"
          className="grow"
        />
        {loading && (
          <span className="loading loading-spinner loading-xs ml-1" />
        )}
      </label>
    </form>
  );
}
