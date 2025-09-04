from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class SortOrder(str, Enum):
    """排序方向"""
    ASC = "asc"
    DESC = "desc"

class SortField(str, Enum):
    """排序字段"""
    NAME = "customer_name"
    COUNTRY = "country"
    CITY = "city"
    STATE = "state"
    ZIP_CODE = "zip_code"
    SALES_RADIUS = "sales_radius"

class CustomerDirectoryBase(BaseModel):
    """客户地址目录基础模型"""
    customer_id: str = Field(..., max_length=50, description="客户ID")
    customer_name: str = Field(..., max_length=255, description="客户姓名")
    address_id: str = Field(..., max_length=50, description="地址ID")
    country: str = Field(..., max_length=255, description="国家")
    country_db: Optional[str] = Field(None, max_length=10, description="国家代码")
    address_line1: str = Field(..., description="地址第一行")
    address_line2: Optional[str] = Field(None, description="地址第二行")
    zip_code: Optional[str] = Field(None, max_length=50, description="邮政编码")
    city: Optional[str] = Field(None, max_length=255, description="城市")
    state: Optional[str] = Field(None, max_length=255, description="州/省")
    full_address: str = Field(..., max_length=255, description="完整地址")
    full_description: Optional[str] = Field(None, max_length=255, description="地址描述")
    tags: List[str] = Field(default_factory=list, description="客户标签")
    sales_radius: Optional[int] = Field(default=10, ge=1, le=100, description="销售范围半径(公里)")

class CustomerDirectoryCreate(CustomerDirectoryBase):
    """创建客户地址记录模型"""
    pass

class CustomerDirectoryUpdate(BaseModel):
    """更新客户地址记录模型"""
    customer_name: Optional[str] = Field(None, max_length=255)
    country: Optional[str] = Field(None, max_length=255)
    country_db: Optional[str] = Field(None, max_length=10)
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    zip_code: Optional[str] = Field(None, max_length=50)
    city: Optional[str] = Field(None, max_length=255)
    state: Optional[str] = Field(None, max_length=255)
    full_address: Optional[str] = Field(None, max_length=255)
    full_description: Optional[str] = Field(None, max_length=255)
    tags: Optional[List[str]] = None
    sales_radius: Optional[int] = Field(None, ge=1, le=100)

class CustomerDirectoryResponse(CustomerDirectoryBase):
    """客户地址响应模型"""
    id: int = Field(..., description="记录ID")
    lat: Optional[float] = Field(None, description="纬度")
    lng: Optional[float] = Field(None, description="经度")
    total_amount: Optional[int] = Field(None, description="总金额")
    
    class Config:
        from_attributes = True
    
    @classmethod
    def model_validate(cls, obj, **kwargs):
        """自定义验证方法，处理tags字段的JSON反序列化"""
        if hasattr(obj, 'tags'):
            if obj.tags is None:
                obj.tags = []
            elif isinstance(obj.tags, str):
                import json
                try:
                    # 尝试JSON解析
                    obj.tags = json.loads(obj.tags) if obj.tags else []
                except:
                    # 如果JSON解析失败，将字符串作为单个标签处理
                    obj.tags = [obj.tags.strip()] if obj.tags.strip() else []
        return super().model_validate(obj, **kwargs)

# 客户信息聚合模型（用于前端兼容）
class CustomerSummary(BaseModel):
    """客户摘要信息"""
    customer_id: str
    customer_name: str
    addresses: List[CustomerDirectoryResponse]
    total_addresses: int
    
class Customer(CustomerDirectoryResponse):
    """客户模型（向后兼容）"""
    @property
    def name(self) -> str:
        return self.customer_name
    
    @property
    def address(self) -> str:
        return self.full_address

class PaginatedResponse(BaseModel):
    """分页响应模型"""
    items: List[CustomerDirectoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class SearchFilters(BaseModel):
    """搜索过滤器"""
    query: Optional[str] = Field(None, description="搜索关键词")
    customer_id: Optional[str] = Field(None, description="客户ID过滤")
    country: Optional[str] = Field(None, description="国家过滤")
    state: Optional[str] = Field(None, description="州/省过滤")
    city: Optional[str] = Field(None, description="城市过滤")
    zip_code: Optional[str] = Field(None, description="邮编过滤")
    tags: Optional[List[str]] = Field(None, description="标签过滤")
    min_sales_radius: Optional[int] = Field(None, ge=1, le=100, description="最小销售范围")
    max_sales_radius: Optional[int] = Field(None, ge=1, le=100, description="最大销售范围")
    sort_by: Optional[SortField] = Field(SortField.NAME, description="排序字段")
    sort_order: Optional[SortOrder] = Field(SortOrder.ASC, description="排序方向")
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")

class LocationSearchFilters(BaseModel):
    """地理位置搜索过滤器"""
    center_lat: float = Field(..., ge=-90, le=90, description="中心点纬度")
    center_lng: float = Field(..., ge=-180, le=180, description="中心点经度")
    radius_km: float = Field(..., gt=0, le=1000, description="搜索半径(公里)")
    country: Optional[str] = Field(None, description="国家过滤")
    state: Optional[str] = Field(None, description="州/省过滤")
    city: Optional[str] = Field(None, description="城市过滤")
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")

class SearchSuggestion(BaseModel):
    """搜索建议"""
    type: str = Field(..., description="建议类型: customer_name, city, state, country")
    value: str = Field(..., description="建议值")
    count: int = Field(..., description="匹配数量")

class LocationSearchResult(CustomerDirectoryResponse):
    """地理位置搜索结果"""
    distance_km: float = Field(..., description="距离中心点的距离(公里)")
