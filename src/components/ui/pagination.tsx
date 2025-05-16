import * as React from "react"

const Pagination = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={className} {...props} />
))
Pagination.displayName = "Pagination"

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={`flex flex-row items-center gap-1 ${className}`}
    {...props}
  />
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={className} {...props} />
))
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
  isActive?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>

const PaginationLink = React.forwardRef<
  HTMLButtonElement,
  PaginationLinkProps
>(({ className, isActive, ...props }, ref) => (
  <button
    ref={ref}
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-white transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950 dark:hover:bg-gray-800 dark:hover:text-gray-50 dark:focus-visible:ring-gray-300 
    ${isActive ? 'bg-gray-100' : ''} ${className}`}
    {...props}
  />
))
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-white transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950 dark:hover:bg-gray-800 dark:hover:text-gray-50 dark:focus-visible:ring-gray-300 ${className}`}
    {...props}
  >
    上一页
  </button>
))
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-white transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-gray-950 dark:hover:bg-gray-800 dark:hover:text-gray-50 dark:focus-visible:ring-gray-300 ${className}`}
    {...props}
  >
    下一页
  </button>
))
PaginationNext.displayName = "PaginationNext"

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} 