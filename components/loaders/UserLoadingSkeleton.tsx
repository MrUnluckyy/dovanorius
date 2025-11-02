import React from "react";

export function UserLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-12">
        <div className="skeleton h-30 w-30 shrink-0 rounded-full"></div>
        <div className="flex flex-col gap-4">
          <div className="skeleton h-12 w-40"></div>
          <div className="skeleton h-4 w-50"></div>
        </div>
      </div>
    </div>
  );
}
