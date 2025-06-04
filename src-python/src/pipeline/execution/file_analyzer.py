"""
文件分析器
在路径分析阶段收集所有需要的Excel文件和Sheet信息
用于批量预加载优化，减少IO次数和上下文切换开销
"""

from typing import List, Dict, Set, Tuple
from dataclasses import dataclass

from ..models import BaseNode, NodeType, WorkspaceConfig, FileInfo


@dataclass
class FileSheetRequirement:
    """文件+Sheet需求信息"""
    file_id: str
    file_path: str
    sheet_name: str
    node_id: str
    node_type: NodeType
    header_row: int = 0


@dataclass
class FileBatchInfo:
    """文件批量加载信息"""
    file_id: str
    file_path: str
    required_sheets: List[str]
    sheet_header_rows: Dict[str, int]  # sheet_name -> header_row


class FileAnalyzer:
    """文件分析器 - 收集所有需要的Excel文件和Sheet信息"""
    
    def __init__(self):
        pass
    
    def analyze_file_requirements(
        self,
        workspace_config: WorkspaceConfig,
        execution_nodes: List[str]
    ) -> List[FileBatchInfo]:
        """
        分析执行过程中需要的所有文件和Sheet
        
        Args:
            workspace_config: 工作区配置
            execution_nodes: 执行节点列表
            
        Returns:
            文件批量加载信息列表
        """
        # 创建节点映射
        node_map = {node.id: node for node in workspace_config.flow_nodes}
        
        # 收集所有文件+Sheet需求
        requirements: List[FileSheetRequirement] = []
        
        for node_id in execution_nodes:
            if node_id not in node_map:
                continue
                
            node = node_map[node_id]
            
            # 只有SheetSelector节点会读取Excel文件
            if node.type == NodeType.SHEET_SELECTOR:
                reqs = self._analyze_sheet_selector_node(node, workspace_config)
                requirements.extend(reqs)  # 现在返回的是列表
        
        # 按文件分组，生成批量加载信息
        return self._group_requirements_by_file(requirements)
    
    def _analyze_sheet_selector_node(
        self, 
        node: BaseNode, 
        workspace_config: WorkspaceConfig
    ) -> List[FileSheetRequirement]:
        """
        分析SheetSelector节点的文件需求
        
        Args:
            node: SheetSelector节点
            workspace_config: 工作区配置
            
        Returns:
            文件+Sheet需求信息列表，如果无法解析则返回空列表
        """
        data = node.data
        target_file_id = data.get("targetFileID")  # 注意大写ID
        mode = data.get("mode", "manual")  # 默认为manual模式
        
        if not target_file_id:
            return []
            
        # 查找文件信息
        file_info = None
        for file in workspace_config.files:
            if file.id == target_file_id:
                file_info = file
                break
                
        if not file_info:
            return []
        
        requirements = []
        
        if mode == "manual":
            # manual模式：明确指定sheet名称
            manual_sheet_name = data.get("manualSheetName")
            if not manual_sheet_name:
                return []
                
            # 获取header row信息
            header_row = 0
            for sheet_meta in file_info.sheet_metas:
                if sheet_meta.get("sheet_name") == manual_sheet_name:
                    header_row = sheet_meta.get("header_row", 0)
                    break
            
            requirements.append(FileSheetRequirement(
                file_id=target_file_id,
                file_path=file_info.path,
                sheet_name=manual_sheet_name,
                node_id=node.id,
                node_type=node.type,
                header_row=header_row
            ))
            
        elif mode == "auto_by_index":
            # auto_by_index模式：预加载该文件的所有sheet
            # 因为我们在预加载阶段还不知道具体的索引值，所以预加载所有可能的sheet
            print(f"PERF: auto_by_index mode detected for node {node.id}, will preload all sheets from file {target_file_id}")
            print(f"PERF: this may cause performance issue, remain to be optimized by reading necessary sheets!!!")
            
            for sheet_meta in file_info.sheet_metas:
                sheet_name = sheet_meta.get("sheet_name")
                if sheet_name:
                    header_row = sheet_meta.get("header_row", 0)
                    
                    requirements.append(FileSheetRequirement(
                        file_id=target_file_id,
                        file_path=file_info.path,
                        sheet_name=sheet_name,
                        node_id=node.id,
                        node_type=node.type,
                        header_row=header_row
                    ))
        
        return requirements
    
    def _group_requirements_by_file(
        self, 
        requirements: List[FileSheetRequirement]
    ) -> List[FileBatchInfo]:
        """
        按文件分组需求，生成批量加载信息
        
        Args:
            requirements: 文件+Sheet需求列表
            
        Returns:
            文件批量加载信息列表
        """
        # 按文件ID分组
        file_groups: Dict[str, List[FileSheetRequirement]] = {}
        
        for req in requirements:
            if req.file_id not in file_groups:
                file_groups[req.file_id] = []
            file_groups[req.file_id].append(req)
        
        # 生成批量信息
        batch_infos = []
        
        for file_id, file_requirements in file_groups.items():
            if not file_requirements:
                continue
                
            # 去重sheet名称
            unique_sheets = list(set(req.sheet_name for req in file_requirements))
            
            # 收集header row信息
            sheet_header_rows = {}
            for req in file_requirements:
                sheet_header_rows[req.sheet_name] = req.header_row
            
            batch_info = FileBatchInfo(
                file_id=file_id,
                file_path=file_requirements[0].file_path,  # 同一文件的路径相同
                required_sheets=unique_sheets,
                sheet_header_rows=sheet_header_rows
            )
            
            batch_infos.append(batch_info)
        
        return batch_infos
    
    def estimate_preload_benefit(
        self, 
        batch_infos: List[FileBatchInfo]
    ) -> Dict[str, int]:
        """
        估算预加载的性能收益
        
        Args:
            batch_infos: 文件批量加载信息列表
            
        Returns:
            性能收益估算信息
        """
        total_sheets = sum(len(info.required_sheets) for info in batch_infos)
        total_files = len(batch_infos)
        
        return {
            "total_files": total_files,
            "total_sheets": total_sheets,
            "estimated_io_reduction": max(0, total_sheets - total_files),  # 减少的IO次数
            "estimated_time_saving_percent": min(80, (total_sheets - total_files) / max(1, total_sheets) * 100)
        } 