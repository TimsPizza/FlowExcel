"""
批量预加载器
并行加载多个Excel文件的多个Sheet，大幅减少IO次数和上下文切换开销
专为性能优化设计，支持进度监控和错误处理
"""

import pandas as pd
import time
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

from .file_analyzer import FileBatchInfo
from ..models import GlobalContext
from ..performance.analyzer import get_performance_analyzer


@dataclass
class PreloadResult:
    """预加载结果"""

    file_id: str
    sheet_name: str
    success: bool
    dataframe: Optional[pd.DataFrame] = None
    error: Optional[str] = None
    load_time_ms: float = 0.0
    rows: int = 0


@dataclass
class BatchPreloadSummary:
    """批量预加载摘要"""

    total_sheets: int
    successful_sheets: int
    failed_sheets: int
    total_time_ms: float
    total_rows: int
    total_files_size_bytes: int
    io_reduction_count: int  # 减少的IO次数


class BatchPreloader:
    """批量预加载器 - 并行加载多个Excel文件"""

    def __init__(self, max_workers: int = 4):
        self.max_workers = max_workers
        self.analyzer = get_performance_analyzer()

    def preload_files(
        self, batch_infos: List[FileBatchInfo], global_context: GlobalContext
    ) -> BatchPreloadSummary:
        """
        批量预加载文件

        Args:
            batch_infos: 文件批量加载信息列表
            global_context: 全局上下文（用于存储缓存）

        Returns:
            批量预加载摘要
        """
        start_time = time.time()

        print(f"PERF: Starting batch preload for {len(batch_infos)} files...")

        # 准备所有需要加载的任务
        load_tasks = []
        for batch_info in batch_infos:
            for sheet_name in batch_info.required_sheets:
                load_tasks.append((batch_info, sheet_name))

        # 计算估算的IO减少量
        io_reduction = len(load_tasks) - len(batch_infos)

        print(
            f"PERF: Will load {len(load_tasks)} sheets from {len(batch_infos)} files (IO reduction: {io_reduction})"
        )

        # 并行执行加载任务
        results = self._execute_parallel_loads(load_tasks, global_context)

        # 生成摘要
        total_time = (time.time() - start_time) * 1000
        summary = self._create_summary(results, total_time, io_reduction)

        # 打印摘要已在analyzer中包含
        # self._print_summary(summary)

        # 记录批量预加载统计（分开计算，避免与常规Excel IO混淆）
        self.analyzer.onBatchPreloadComplete(
            total_files=len(batch_infos),
            total_sheets=summary.total_sheets,
            successful_sheets=summary.successful_sheets,
            failed_sheets=summary.failed_sheets,
            total_time_ms=summary.total_time_ms,
            total_rows=summary.total_rows,
            total_io_reduction=io_reduction
        )

        return summary

    def _execute_parallel_loads(
        self, load_tasks: List[Tuple[FileBatchInfo, str]], global_context: GlobalContext
    ) -> List[PreloadResult]:
        """
        并行执行加载任务

        Args:
            load_tasks: 加载任务列表
            global_context: 全局上下文

        Returns:
            预加载结果列表
        """
        results = []

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # 提交所有任务
            future_to_task = {
                executor.submit(self._load_single_sheet, batch_info, sheet_name): (
                    batch_info,
                    sheet_name,
                )
                for batch_info, sheet_name in load_tasks
            }

            # 收集结果
            for future in as_completed(future_to_task):
                batch_info, sheet_name = future_to_task[future]

                try:
                    result = future.result()
                    results.append(result)

                    # 如果成功，添加到缓存
                    if result.success and result.dataframe is not None:
                        cache_key = f"{batch_info.file_id}_{sheet_name}"
                        global_context.loaded_dataframes[cache_key] = result.dataframe

                except Exception as e:
                    # 处理意外错误
                    error_result = PreloadResult(
                        file_id=batch_info.file_id,
                        sheet_name=sheet_name,
                        success=False,
                        error=f"Unexpected error: {str(e)}",
                    )
                    results.append(error_result)

        return results

    def _load_single_sheet(
        self, batch_info: FileBatchInfo, sheet_name: str
    ) -> PreloadResult:
        """
        加载单个Sheet

        Args:
            batch_info: 文件批量信息
            sheet_name: Sheet名称

        Returns:
            预加载结果
        """
        start_time = time.time()

        # 注意：批量预加载不计入常规Excel IO统计，避免重复计数
        # read_id = self.analyzer.onExcelReadStart(batch_info.file_path, sheet_name)

        try:
            # 获取header row
            header_row = batch_info.sheet_header_rows.get(sheet_name, 0)

            # 读取Excel
            df = pd.read_excel(
                batch_info.file_path, sheet_name=sheet_name, header=header_row
            )

            load_time_ms = (time.time() - start_time) * 1000

            # 获取文件大小
            try:
                file_size = os.path.getsize(batch_info.file_path)
            except:
                file_size = None

            # 批量预加载不计入常规Excel IO统计
            # self.analyzer.onExcelReadFinish(read_id, len(df), file_size)

            return PreloadResult(
                file_id=batch_info.file_id,
                sheet_name=sheet_name,
                success=True,
                dataframe=df,
                load_time_ms=load_time_ms,
                rows=len(df),
            )

        except Exception as e:
            load_time_ms = (time.time() - start_time) * 1000

            # 批量预加载不计入常规Excel IO统计
            # self.analyzer.onExcelReadFinish(read_id, 0, None)

            return PreloadResult(
                file_id=batch_info.file_id,
                sheet_name=sheet_name,
                success=False,
                error=str(e),
                load_time_ms=load_time_ms,
            )

    def _create_summary(
        self,
        results: List[PreloadResult],
        total_time_ms: float,
        io_reduction_count: int,
    ) -> BatchPreloadSummary:
        """
        创建批量预加载摘要

        Args:
            results: 预加载结果列表
            total_time_ms: 总时间
            io_reduction_count: IO减少数量

        Returns:
            批量预加载摘要
        """
        successful_results = [r for r in results if r.success]
        failed_results = [r for r in results if not r.success]

        total_rows = sum(r.rows for r in successful_results)

        # 估算文件大小（基于成功加载的数据）
        estimated_size = total_rows * 50  # 粗略估算每行50字节

        return BatchPreloadSummary(
            total_sheets=len(results),
            successful_sheets=len(successful_results),
            failed_sheets=len(failed_results),
            total_time_ms=total_time_ms,
            total_rows=total_rows,
            total_files_size_bytes=estimated_size,
            io_reduction_count=io_reduction_count,
        )

    def _print_summary(self, summary: BatchPreloadSummary):
        """
        打印预加载摘要

        Args:
            summary: 批量预加载摘要
        """
        print("=" * 50)
        print("📦 批量预加载报告")
        print("=" * 50)
        print(f"📊 总Sheet数: {summary.total_sheets}")
        print(f"✅ 成功加载: {summary.successful_sheets}")
        print(f"❌ 加载失败: {summary.failed_sheets}")
        print(f"⏱️ 总加载时间: {summary.total_time_ms:.2f}ms")
        print(f"📋 总行数: {summary.total_rows}")
        print(f"💾 估算大小: {summary.total_files_size_bytes} bytes")
        print(f"🚀 减少IO次数: {summary.io_reduction_count}")

        if summary.total_sheets > 0:
            success_rate = summary.successful_sheets / summary.total_sheets * 100
            avg_time = summary.total_time_ms / summary.total_sheets
            print(f"📈 成功率: {success_rate:.1f}%")
            print(f"📊 平均加载时间: {avg_time:.2f}ms/sheet")

        print("=" * 50)
