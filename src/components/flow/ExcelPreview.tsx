import { DataFrameViewer } from "@/components/flow/DataFrameViewer";
import { SheetInfo } from "@/types";
import { Flex, Tabs, IconButton } from "@radix-ui/themes";
import { useEffect, useMemo, useState, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";

interface ExcelPreviewProps {
  sheets: SheetInfo[];
  hide: boolean;
  loading: boolean;
}

export default function ExcelPreview({
  sheets,
  // hide,
  loading,
}: ExcelPreviewProps) {
  const [selectedSheetName, setSelectedSheetName] = useState<string | null>(
    null,
  );
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabsListRef = useRef<HTMLDivElement>(null);

  const tranformedPreviewData = useMemo(() => {
    if (sheets?.length === 0) return [];
    if (!selectedSheetName) return sheets[0];
    const sheet = sheets?.find(
      (sheet) => sheet.sheet_name === selectedSheetName,
    );
    if (!sheet) return [];
    return sheet;
  }, [selectedSheetName, sheets]);

  // 检查滚动状态
  const checkScrollability = () => {
    if (tabsListRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsListRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth);
    }
  };

  // 滚动函数
  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsListRef.current) {
      const scrollAmount = 200; // 每次滚动的像素数
      const newScrollLeft = direction === 'left' 
        ? tabsListRef.current.scrollLeft - scrollAmount
        : tabsListRef.current.scrollLeft + scrollAmount;
      
      tabsListRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (sheets && sheets?.length > 0 && !loading) {
      setSelectedSheetName(sheets[0].sheet_name);
    }
  }, [loading, sheets]);

  useEffect(() => {
    checkScrollability();
    
    const handleResize = () => checkScrollability();
    const handleScroll = () => checkScrollability();
    
    window.addEventListener('resize', handleResize);
    if (tabsListRef.current) {
      tabsListRef.current.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (tabsListRef.current) {
        tabsListRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, [sheets]);

  return (
    <div className="flex flex-col gap-4 rounded-md border border-gray-200 p-4">
      <Flex direction="column" gap="2">
        <Tabs.Root
          orientation="horizontal"
          defaultValue={selectedSheetName ?? sheets?.[0]?.sheet_name}
          onValueChange={setSelectedSheetName}
        >
          <div className="relative flex items-center">
            {/* 左滚动按钮 */}
            {canScrollLeft && (
              <IconButton
                variant="ghost"
                size="1"
                className="absolute left-0 z-10 bg-white shadow-sm"
                onClick={() => scrollTabs('left')}
              >
                <ChevronLeftIcon />
              </IconButton>
            )}
            
            {/* 标签列表 */}
            <Tabs.List 
              ref={tabsListRef}
              className="overflow-x-scroll scrollbar-hide mx-6"
              style={{
                scrollbarWidth: 'none', /* Firefox */
                msOverflowStyle: 'none', /* IE and Edge */
              }}
            >
              {sheets &&
                sheets?.map((sheet) => (
                  <Tabs.Trigger
                    key={sheet.sheet_name}
                    value={sheet.sheet_name}
                    className="text-ellipsis whitespace-nowrap !p-0"
                  >
                    {sheet?.sheet_name}
                  </Tabs.Trigger>
                ))}
            </Tabs.List>
            
            {/* 右滚动按钮 */}
            {canScrollRight && (
              <IconButton
                variant="ghost"
                size="1"
                className="absolute right-0 z-10 bg-white shadow-sm"
                onClick={() => scrollTabs('right')}
              >
                <ChevronRightIcon />
              </IconButton>
            )}
          </div>
        </Tabs.Root>
        {tranformedPreviewData && selectedSheetName && (
          <DataFrameViewer
            columns={
              sheets?.find((sheet) => sheet.sheet_name === selectedSheetName)
                ?.columns ?? []
            }
            data={
              sheets?.find((sheet) => sheet.sheet_name === selectedSheetName)
                ?.data ?? ([] as any)
            }
          />
        )}
      </Flex>
    </div>
  );
}
