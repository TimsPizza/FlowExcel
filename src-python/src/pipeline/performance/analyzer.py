"""
简洁的插件式性能分析器
提供非侵入式的性能计数功能
"""

import time
import threading
from typing import Dict, Any, Optional
from dataclasses import dataclass, field


@dataclass
class NodeStats:
    """节点统计信息"""

    node_id: str
    node_type: str
    execution_count: int = 0
    total_time_ms: float = 0.0
    min_time_ms: float = float("inf")
    max_time_ms: float = 0.0
    error_count: int = 0

    @property
    def avg_time_ms(self) -> float:
        return self.total_time_ms / max(1, self.execution_count)


@dataclass
class DataFrameConversionStats:
    """DataFrame转换统计信息"""

    to_pandas_count: int = 0
    to_pandas_total_time_ms: float = 0.0
    to_pandas_total_rows: int = 0
    from_pandas_count: int = 0
    from_pandas_total_time_ms: float = 0.0
    from_pandas_total_rows: int = 0

    @property
    def to_pandas_avg_time_ms(self) -> float:
        return self.to_pandas_total_time_ms / max(1, self.to_pandas_count)

    @property
    def from_pandas_avg_time_ms(self) -> float:
        return self.from_pandas_total_time_ms / max(1, self.from_pandas_count)


@dataclass
class ExcelIOStats:
    """Excel文件IO统计信息"""

    read_count: int = 0
    read_total_time_ms: float = 0.0
    read_total_rows: int = 0
    read_total_size_bytes: int = 0

    @property
    def read_avg_time_ms(self) -> float:
        return self.read_total_time_ms / max(1, self.read_count)


@dataclass
class CacheStats:
    """缓存统计信息"""

    hit_count: int = 0
    miss_count: int = 0

    @property
    def total_requests(self) -> int:
        return self.hit_count + self.miss_count

    @property
    def hit_rate(self) -> float:
        total = self.total_requests
        return self.hit_count / max(1, total)

    @property
    def miss_rate(self) -> float:
        return 1.0 - self.hit_rate


class PerformanceAnalyzer:
    """
    集中管理的性能分析器
    提供插件式的性能监控能力
    """

    def __init__(self):
        self.enabled = True
        self._lock = threading.Lock()
        self._node_stats: Dict[str, NodeStats] = {}
        self._active_executions: Dict[str, float] = {}  # execution_id -> start_time
        self._execution_counter = 0

        # 全局统计
        self.total_executions = 0
        self.total_errors = 0
        self.total_time_ms = 0.0

        # 新增的统计类型
        self._dataframe_conversion_stats = DataFrameConversionStats()
        self._excel_io_stats = ExcelIOStats()
        self._cache_stats = CacheStats()

        # DataFrame转换操作的活跃执行追踪
        self._active_dataframe_conversions: Dict[str, float] = {}
        self._active_excel_reads: Dict[str, float] = {}
        self._conversion_counter = 0
        self._excel_read_counter = 0

    def onStart(self, node_id: str, node_type: str) -> str:
        """
        节点开始执行

        Args:
            node_id: 节点ID
            node_type: 节点类型

        Returns:
            执行ID，用于后续的onFinish调用
        """
        if not self.enabled:
            return ""

        with self._lock:
            self._execution_counter += 1
            execution_id = f"{node_id}_{self._execution_counter}"
            self._active_executions[execution_id] = time.time()

            # 确保节点统计存在
            if node_id not in self._node_stats:
                self._node_stats[node_id] = NodeStats(
                    node_id=node_id, node_type=node_type
                )

        return execution_id

    def onFinish(self, execution_id: str, success: bool = True) -> Optional[float]:
        """
        节点执行完成

        Args:
            execution_id: 执行ID（由onStart返回）
            success: 是否成功执行

        Returns:
            执行时间（毫秒），如果execution_id无效则返回None
        """
        if not self.enabled or not execution_id:
            return None

        with self._lock:
            if execution_id not in self._active_executions:
                return None

            start_time = self._active_executions.pop(execution_id)
            execution_time_ms = (time.time() - start_time) * 1000

            # 从execution_id提取node_id
            node_id = execution_id.rsplit("_", 1)[0]

            if node_id in self._node_stats:
                stats = self._node_stats[node_id]
                stats.execution_count += 1
                stats.total_time_ms += execution_time_ms
                stats.min_time_ms = min(stats.min_time_ms, execution_time_ms)
                stats.max_time_ms = max(stats.max_time_ms, execution_time_ms)

                if not success:
                    stats.error_count += 1

            # 更新全局统计
            self.total_executions += 1
            self.total_time_ms += execution_time_ms
            if not success:
                self.total_errors += 1

            # 性能警告
            if execution_time_ms > 1000:
                print(f"PERF WARNING: Node {node_id} took {execution_time_ms:.2f}ms")

            return execution_time_ms

    def onError(self, execution_id: str, error: Exception):
        """
        节点执行出错

        Args:
            execution_id: 执行ID
            error: 错误信息
        """
        execution_time = self.onFinish(execution_id, success=False)
        if execution_time is not None:
            node_id = execution_id.rsplit("_", 1)[0] if execution_id else "unknown"

    # DataFrame转换性能计数hook
    def onDataFrameToPandasStart(self, row_count: int = None) -> str:
        """
        DataFrame.to_pandas()转换开始

        Args:
            row_count: DataFrame行数（可选）

        Returns:
            转换ID
        """
        if not self.enabled:
            return ""

        with self._lock:
            self._conversion_counter += 1
            conversion_id = f"to_pandas_{self._conversion_counter}"
            self._active_dataframe_conversions[conversion_id] = time.time()

        return conversion_id

    def onDataFrameToPandasFinish(self, conversion_id: str, row_count: int = None):
        """
        DataFrame.to_pandas()转换完成

        Args:
            conversion_id: 转换ID
            row_count: DataFrame行数
        """
        if not self.enabled or not conversion_id:
            return

        with self._lock:
            if conversion_id not in self._active_dataframe_conversions:
                return

            start_time = self._active_dataframe_conversions.pop(conversion_id)
            conversion_time_ms = (time.time() - start_time) * 1000

            self._dataframe_conversion_stats.to_pandas_count += 1
            self._dataframe_conversion_stats.to_pandas_total_time_ms += (
                conversion_time_ms
            )
            if row_count:
                self._dataframe_conversion_stats.to_pandas_total_rows += row_count

            # 性能警告
            if conversion_time_ms > 100:
                print(
                    f"PERF WARNING: DataFrame.to_pandas() took {conversion_time_ms:.2f}ms for {row_count or 'unknown'} rows"
                )

    def onDataFrameFromPandasStart(self, row_count: int = None) -> str:
        """
        DataFrame.from_pandas()转换开始

        Args:
            row_count: pandas DataFrame行数（可选）

        Returns:
            转换ID
        """
        if not self.enabled:
            return ""

        with self._lock:
            self._conversion_counter += 1
            conversion_id = f"from_pandas_{self._conversion_counter}"
            self._active_dataframe_conversions[conversion_id] = time.time()

        return conversion_id

    def onDataFrameFromPandasFinish(self, conversion_id: str, row_count: int = None):
        """
        DataFrame.from_pandas()转换完成

        Args:
            conversion_id: 转换ID
            row_count: pandas DataFrame行数
        """
        if not self.enabled or not conversion_id:
            return

        with self._lock:
            if conversion_id not in self._active_dataframe_conversions:
                return

            start_time = self._active_dataframe_conversions.pop(conversion_id)
            conversion_time_ms = (time.time() - start_time) * 1000

            self._dataframe_conversion_stats.from_pandas_count += 1
            self._dataframe_conversion_stats.from_pandas_total_time_ms += (
                conversion_time_ms
            )
            if row_count:
                self._dataframe_conversion_stats.from_pandas_total_rows += row_count

            # 性能警告
            if conversion_time_ms > 100:
                print(
                    f"PERF WARNING: DataFrame.from_pandas() took {conversion_time_ms:.2f}ms for {row_count or 'unknown'} rows"
                )

    # Excel IO性能计数hook
    def onExcelReadStart(self, file_path: str, sheet_name: str = None) -> str:
        """
        Excel文件读取开始

        Args:
            file_path: 文件路径
            sheet_name: Sheet名称（可选）

        Returns:
            读取ID
        """
        if not self.enabled:
            return ""

        with self._lock:
            self._excel_read_counter += 1
            read_id = f"excel_read_{self._excel_read_counter}"
            self._active_excel_reads[read_id] = time.time()

        return read_id

    def onExcelReadFinish(
        self, read_id: str, row_count: int = None, file_size_bytes: int = None
    ):
        """
        Excel文件读取完成

        Args:
            read_id: 读取ID
            row_count: 读取的行数
            file_size_bytes: 文件大小（字节）
        """
        if not self.enabled or not read_id:
            return

        with self._lock:
            if read_id not in self._active_excel_reads:
                return

            start_time = self._active_excel_reads.pop(read_id)
            read_time_ms = (time.time() - start_time) * 1000

            self._excel_io_stats.read_count += 1
            self._excel_io_stats.read_total_time_ms += read_time_ms
            if row_count:
                self._excel_io_stats.read_total_rows += row_count
            if file_size_bytes:
                self._excel_io_stats.read_total_size_bytes += file_size_bytes

            # 性能警告
            if read_time_ms > 500:
                print(
                    f"PERF WARNING: Excel read took {read_time_ms:.2f}ms for {row_count or 'unknown'} rows"
                )

    # 缓存性能计数hook
    def onCacheHit(self, cache_key: str = None):
        """
        缓存命中

        Args:
            cache_key: 缓存键（可选，用于调试）
        """
        if not self.enabled:
            return

        with self._lock:
            self._cache_stats.hit_count += 1

    def onCacheMiss(self, cache_key: str = None):
        """
        缓存未命中

        Args:
            cache_key: 缓存键（可选，用于调试）
        """
        if not self.enabled:
            return

        with self._lock:
            self._cache_stats.miss_count += 1

    def get_stats(self) -> Dict[str, Any]:
        """获取性能统计信息"""
        with self._lock:
            return {
                "total_executions": self.total_executions,
                "total_time_ms": self.total_time_ms,
                "total_errors": self.total_errors,
                "avg_time_per_execution_ms": self.total_time_ms
                / max(1, self.total_executions),
                "error_rate": self.total_errors / max(1, self.total_executions),
                "active_executions": len(self._active_executions),
                "node_stats": {
                    node_id: {
                        "node_type": stats.node_type,
                        "execution_count": stats.execution_count,
                        "total_time_ms": stats.total_time_ms,
                        "avg_time_ms": stats.avg_time_ms,
                        "min_time_ms": (
                            stats.min_time_ms
                            if stats.min_time_ms != float("inf")
                            else 0
                        ),
                        "max_time_ms": stats.max_time_ms,
                        "error_count": stats.error_count,
                        "error_rate": stats.error_count / max(1, stats.execution_count),
                    }
                    for node_id, stats in self._node_stats.items()
                },
                "dataframe_conversion_stats": {
                    "to_pandas_count": self._dataframe_conversion_stats.to_pandas_count,
                    "to_pandas_total_time_ms": self._dataframe_conversion_stats.to_pandas_total_time_ms,
                    "to_pandas_avg_time_ms": self._dataframe_conversion_stats.to_pandas_avg_time_ms,
                    "to_pandas_total_rows": self._dataframe_conversion_stats.to_pandas_total_rows,
                    "from_pandas_count": self._dataframe_conversion_stats.from_pandas_count,
                    "from_pandas_total_time_ms": self._dataframe_conversion_stats.from_pandas_total_time_ms,
                    "from_pandas_avg_time_ms": self._dataframe_conversion_stats.from_pandas_avg_time_ms,
                    "from_pandas_total_rows": self._dataframe_conversion_stats.from_pandas_total_rows,
                },
                "excel_io_stats": {
                    "read_count": self._excel_io_stats.read_count,
                    "read_total_time_ms": self._excel_io_stats.read_total_time_ms,
                    "read_avg_time_ms": self._excel_io_stats.read_avg_time_ms,
                    "read_total_rows": self._excel_io_stats.read_total_rows,
                    "read_total_size_bytes": self._excel_io_stats.read_total_size_bytes,
                },
                "cache_stats": {
                    "hit_count": self._cache_stats.hit_count,
                    "miss_count": self._cache_stats.miss_count,
                    "total_requests": self._cache_stats.total_requests,
                    "hit_rate": self._cache_stats.hit_rate,
                    "miss_rate": self._cache_stats.miss_rate,
                },
            }

    def print_stats(self):
        """打印性能统计信息"""
        stats = self.get_stats()

        print("=" * 60)
        print("性能分析报告")
        print("=" * 60)
        print(f"📊 总执行次数: {stats['total_executions']}")
        print(f"⏱️  总执行时间: {stats['total_time_ms']:.2f}ms")
        print(f"📈 平均执行时间: {stats['avg_time_per_execution_ms']:.2f}ms")
        print(f"❌ 错误次数: {stats['total_errors']}")
        print(f"📉 错误率: {stats['error_rate']:.2%}")
        print(f"🔄 活跃执行: {stats['active_executions']}")
        print()

        # DataFrame转换统计
        df_stats = stats["dataframe_conversion_stats"]
        if df_stats["to_pandas_count"] > 0 or df_stats["from_pandas_count"] > 0:
            print("DataFrame转换统计:")
            print("-" * 30)
            print(f"🔄 to_pandas()调用: {df_stats['to_pandas_count']}")
            print(f"⏱️  to_pandas()总时间: {df_stats['to_pandas_total_time_ms']:.2f}ms")
            print(f"📊 to_pandas()平均时间: {df_stats['to_pandas_avg_time_ms']:.2f}ms")
            print(f"📋 to_pandas()总行数: {df_stats['to_pandas_total_rows']}")
            print(f"🔄 from_pandas()调用: {df_stats['from_pandas_count']}")
            print(
                f"⏱️  from_pandas()总时间: {df_stats['from_pandas_total_time_ms']:.2f}ms"
            )
            print(
                f"📊 from_pandas()平均时间: {df_stats['from_pandas_avg_time_ms']:.2f}ms"
            )
            print(f"📋 from_pandas()总行数: {df_stats['from_pandas_total_rows']}")
            print()

        # Excel IO统计
        excel_stats = stats["excel_io_stats"]
        if excel_stats["read_count"] > 0:
            print("Excel文件IO统计:")
            print("-" * 30)
            print(f"📖 文件读取次数: {excel_stats['read_count']}")
            print(f"⏱️  读取总时间: {excel_stats['read_total_time_ms']:.2f}ms")
            print(f"📊 平均读取时间: {excel_stats['read_avg_time_ms']:.2f}ms")
            print(f"📋 读取总行数: {excel_stats['read_total_rows']}")
            print(f"💾 读取总大小: {excel_stats['read_total_size_bytes']} bytes")
            print()

        # 缓存统计
        cache_stats = stats["cache_stats"]
        if cache_stats["total_requests"] > 0:
            print("缓存性能统计:")
            print("-" * 30)
            print(f"✅ 缓存命中: {cache_stats['hit_count']}")
            print(f"❌ 缓存未命中: {cache_stats['miss_count']}")
            print(f"📊 总请求数: {cache_stats['total_requests']}")
            print(f"📈 命中率: {cache_stats['hit_rate']:.2%}")
            print(f"📉 未命中率: {cache_stats['miss_rate']:.2%}")
            print()

        if stats["node_stats"]:
            print("各节点详细统计:")
            print("-" * 60)
            for node_id, node_stats in stats["node_stats"].items():
                print(f"🔹 {node_stats['node_type']} ({node_id}):")
                print(f"   执行次数: {node_stats['execution_count']}")
                print(f"   平均时间: {node_stats['avg_time_ms']:.2f}ms")
                print(
                    f"   时间范围: {node_stats['min_time_ms']:.2f}ms - {node_stats['max_time_ms']:.2f}ms"
                )
                print(
                    f"   错误次数: {node_stats['error_count']} ({node_stats['error_rate']:.1%})"
                )
                print()
        print("=" * 60)

    def reset(self):
        """重置所有性能数据"""
        with self._lock:
            self._node_stats.clear()
            self._active_executions.clear()
            self._active_dataframe_conversions.clear()
            self._active_excel_reads.clear()
            self._execution_counter = 0
            self._conversion_counter = 0
            self._excel_read_counter = 0
            self.total_executions = 0
            self.total_errors = 0
            self.total_time_ms = 0.0

            # 重置新的统计数据
            self._dataframe_conversion_stats = DataFrameConversionStats()
            self._excel_io_stats = ExcelIOStats()
            self._cache_stats = CacheStats()

        print("PERF: 性能统计已重置")

    def enable(self):
        """启用性能监控"""
        self.enabled = True

    def disable(self):
        """禁用性能监控"""
        self.enabled = False


# 全局性能分析器实例
_global_analyzer = PerformanceAnalyzer()


def get_performance_analyzer() -> PerformanceAnalyzer:
    """获取全局性能分析器实例"""
    return _global_analyzer
