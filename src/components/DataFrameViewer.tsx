import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table } from "@radix-ui/themes";
import React, { useEffect, useMemo } from "react";

interface DataFrameViewerProps {
  columns: string[];
  data: any[][];
  pageSize?: number;
  className?: string;
  onSort?: (column: string) => void;
}

export const DataFrameViewer: React.FC<DataFrameViewerProps> = ({
  columns,
  data,
  pageSize = 10,
  className = "",
}) => {
  console.log("props", columns, data);
  const [page, setPage] = React.useState(1);

  // 计算总页数
  const totalPages = Math.ceil(data.length / pageSize);

  // 获取当前页的数据
  const currentPageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return data.slice(start, end);
  }, [data, page, pageSize]);

  useEffect(() => {
    console.log("currentPageData", currentPageData);
  }, [currentPageData]);

  return (
    <div className={`w-full p-2 ${className}`}>
      <div className="rounded-md border">
        <Table.Root size="1">
          <Table.Header>
            <Table.Row>
              {columns.map((column, index) => (
                <Table.ColumnHeaderCell key={index} className="border-r">
                  <div className="max-w-18 overflow-hidden text-ellipsis whitespace-nowrap">
                    {column}
                  </div>
                </Table.ColumnHeaderCell>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {currentPageData.map((row, rowIndex) => (
              <Table.Row key={rowIndex} className="max-h-12">
                {row.map((cell, cellIndex) => (
                  <Table.Cell key={cellIndex}>
                    <div className="max-w-18 overflow-hidden text-ellipsis whitespace-nowrap">
                      {cell}
                    </div>
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNum) => (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setPage(pageNum)}
                      isActive={page === pageNum}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};
