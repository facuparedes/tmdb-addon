import React from "react";

export function Stats() {
  return (
    <div className="inline-flex items-center bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full text-green-800 dark:text-green-100 text-sm">
      <svg
        className="mr-2 w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M12 14C8.13401 14 5 17.134 5 21H19C19 17.134 15.866 14 12 14Z"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <span>Users</span>
    </div>
  );
}
