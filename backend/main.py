from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
import uvicorn
from datetime import datetime
import math

from config import settings
from models import CustomerDirectoryCreate, CustomerDirectoryUpdate, CustomerDirectoryResponse, PaginatedResponse, SearchFilters, LocationSearchFilters
from database import get_db, create_tables, get_customer_directory_repository, CustomerDirectoryRepository, init_sample_data
from services.geocoding_service import GeocodingService
from sqlalchemy import or_, and_

app = FastAPI(
    title="客户地址管理系统 API",
    description="提供客户信息管理和地址地理编码功能的后端API",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化地理编码服务
geocoding_service = GeocodingService(settings.GOOGLE_MAPS_API_KEY)

@app.on_event("startup")
async def startup_event():
    """应用启动时创建数据库表"""
    create_tables()
    init_sample_data()
    print("✅ 数据库表创建完成")
    print(f"🚀 服务器启动成功，访问地址: http://localhost:{settings.PORT}")

@app.get("/")
async def root():
    """根路径健康检查"""
    return {
        "message": "客户地址管理系统 API",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/api/customers", response_model=PaginatedResponse)
async def get_customer_addresses(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """获取客户地址列表（分页）"""
    try:
        skip = (page - 1) * page_size
        addresses = repo.get_customer_addresses(skip=skip, limit=page_size)
        total = repo.get_addresses_count()
        total_pages = math.ceil(total / page_size)
        
        return PaginatedResponse(
            items=[CustomerDirectoryResponse.model_validate(address) for address in addresses],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取客户地址列表失败: {str(e)}")

@app.get("/api/customers/search", response_model=PaginatedResponse)
async def search_customer_addresses(
    query: Optional[str] = Query(None, description="搜索关键词"),
    customer_id: Optional[str] = Query(None, description="客户ID过滤"),
    country: Optional[str] = Query(None, description="国家过滤"),
    state: Optional[str] = Query(None, description="州/省过滤"),
    city: Optional[str] = Query(None, description="城市过滤"),
    zip_code: Optional[str] = Query(None, description="邮编过滤"),
    tags: Optional[List[str]] = Query(None, description="标签过滤"),
    min_sales_radius: Optional[int] = Query(None, ge=1, le=100, description="最小销售范围"),
    max_sales_radius: Optional[int] = Query(None, ge=1, le=100, description="最大销售范围"),
    sort_by: Optional[str] = Query("customer_name", description="排序字段"),
    sort_order: Optional[str] = Query("asc", description="排序方向"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """搜索和过滤客户地址"""
    try:
        filters = SearchFilters(
            query=query,
            customer_id=customer_id,
            country=country,
            state=state,
            city=city,
            zip_code=zip_code,
            tags=tags,
            min_sales_radius=min_sales_radius,
            max_sales_radius=max_sales_radius,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            page_size=page_size
        )
        
        addresses, total = repo.search_customer_addresses(filters)
        total_pages = math.ceil(total / page_size)
        
        return PaginatedResponse(
            items=[CustomerDirectoryResponse.model_validate(address) for address in addresses],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索客户地址失败: {str(e)}")

@app.get("/api/customers/search/location")
async def search_addresses_by_location(
    center_lat: float = Query(..., ge=-90, le=90, description="中心点纬度"),
    center_lng: float = Query(..., ge=-180, le=180, description="中心点经度"),
    radius_km: float = Query(..., gt=0, le=1000, description="搜索半径(公里)"),
    country: Optional[str] = Query(None, description="国家过滤"),
    state: Optional[str] = Query(None, description="州/省过滤"),
    city: Optional[str] = Query(None, description="城市过滤"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """根据地理位置搜索客户地址"""
    try:
        filters = LocationSearchFilters(
            center_lat=center_lat,
            center_lng=center_lng,
            radius_km=radius_km,
            country=country,
            state=state,
            city=city,
            page=page,
            page_size=page_size
        )
        
        addresses_with_distance, total = repo.search_addresses_by_location(filters)
        total_pages = math.ceil(total / page_size)
        
        # 构建响应，包含距离信息
        items = []
        for address, distance in addresses_with_distance:
            address_data = CustomerDirectoryResponse.model_validate(address).model_dump()
            address_data['distance_km'] = round(distance, 2)
            items.append(address_data)
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "search_center": {
                "lat": center_lat,
                "lng": center_lng,
                "radius_km": radius_km
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"地理位置搜索失败: {str(e)}")

@app.post("/api/customers", response_model=CustomerDirectoryResponse)
async def create_customer_address(
    address_data: CustomerDirectoryCreate,
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """创建新客户地址记录"""
    try:
        # 检查客户ID和地址ID的组合是否已存在
        existing_address = repo.get_address_by_address_id(address_data.customer_id, address_data.address_id)
        if existing_address:
            raise HTTPException(status_code=400, detail="该客户的此地址ID已存在")
        
        # 获取地址的经纬度坐标
        lat, lng = geocoding_service.get_coordinates(address_data.full_address)
        
        # 创建客户地址记录
        db_address = repo.create_customer_address(address_data, lat=lat, lng=lng)
        
        return CustomerDirectoryResponse.model_validate(db_address)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建客户地址记录失败: {str(e)}")

@app.get("/api/customers/by-customer/{customer_id}")
async def get_addresses_by_customer(
    customer_id: str,
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """根据客户ID获取所有地址"""
    try:
        addresses = repo.get_addresses_by_customer_id(customer_id)
        return {
            "customer_id": customer_id,
            "addresses": [CustomerDirectoryResponse.model_validate(addr) for addr in addresses],
            "total_addresses": len(addresses)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取客户地址失败: {str(e)}")

@app.get("/api/customers/{record_id}", response_model=CustomerDirectoryResponse)
async def get_customer_address(
    record_id: int,
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """获取单个客户地址记录"""
    try:
        address = repo.get_address_by_id(record_id)
        if not address:
            raise HTTPException(status_code=404, detail="地址记录不存在")
        
        return CustomerDirectoryResponse.model_validate(address)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取客户地址信息失败: {str(e)}")

@app.put("/api/customers/{record_id}", response_model=CustomerDirectoryResponse)
async def update_customer_address(
    record_id: int,
    address_data: CustomerDirectoryUpdate,
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """更新客户地址信息"""
    try:
        # 检查地址记录是否存在
        existing_address = repo.get_address_by_id(record_id)
        if not existing_address:
            raise HTTPException(status_code=404, detail="地址记录不存在")
        
        # 如果地址有变更，重新获取坐标
        lat, lng = None, None
        if address_data.full_address and address_data.full_address != existing_address.full_address:
            lat, lng = geocoding_service.get_coordinates(address_data.full_address)
        
        # 更新客户地址信息
        updated_address = repo.update_customer_address(record_id, address_data, lat=lat, lng=lng)
        
        return CustomerDirectoryResponse.model_validate(updated_address)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新客户地址信息失败: {str(e)}")

@app.delete("/api/customers/{record_id}")
async def delete_customer_address(
    record_id: int,
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """删除客户地址记录"""
    try:
        success = repo.delete_customer_address(record_id)
        if not success:
            raise HTTPException(status_code=404, detail="地址记录不存在")
        
        return {"message": "客户地址记录删除成功", "record_id": record_id}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除客户地址记录失败: {str(e)}")

@app.get("/api/search/suggestions")
async def get_search_suggestions(
    query: str = Query(..., min_length=1, description="搜索查询"),
    limit: int = Query(10, ge=1, le=50, description="建议数量限制"),
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """获取搜索建议"""
    try:
        suggestions = repo.get_search_suggestions(query, limit)
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取搜索建议失败: {str(e)}")

@app.get("/api/statistics")
async def get_statistics(
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """获取客户地址统计信息"""
    try:
        stats = repo.get_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")

@app.get("/api/countries", response_model=List[str])
async def get_all_countries(
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """获取所有国家"""
    try:
        from database import CustomerDirectoryDB
        countries = repo.db.query(CustomerDirectoryDB.country).distinct().all()
        return [country[0] for country in countries if country[0]]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取国家列表失败: {str(e)}")

@app.get("/api/states", response_model=List[str])
async def get_all_states(
    country: Optional[str] = Query(None, description="按国家过滤"),
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """获取所有州/省"""
    try:
        from database import CustomerDirectoryDB
        query = repo.db.query(CustomerDirectoryDB.state).distinct()
        if country:
            query = query.filter(CustomerDirectoryDB.country == country)
        states = query.all()
        return [state[0] for state in states if state[0]]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取州/省列表失败: {str(e)}")

@app.get("/api/tags", response_model=List[str])
async def get_all_tags(
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """获取所有使用过的标签"""
    try:
        tags = repo.get_all_tags()
        return tags
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取标签失败: {str(e)}")


@app.post("/api/geocode")
async def geocode_address(address: str):
    """地址地理编码"""
    try:
        lat, lng = geocoding_service.get_coordinates(address)
        if lat is None or lng is None:
            raise HTTPException(status_code=404, detail="无法找到该地址的坐标")
        
        return {
            "address": address,
            "lat": lat,
            "lng": lng
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"地理编码失败: {str(e)}")

@app.post("/api/reverse-geocode")
async def reverse_geocode_coordinates(lat: float, lng: float):
    """反向地理编码"""
    try:
        address = geocoding_service.reverse_geocode(lat, lng)
        if not address:
            raise HTTPException(status_code=404, detail="无法找到该坐标对应的地址")
        
        return {
            "lat": lat,
            "lng": lng,
            "address": address
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"反向地理编码失败: {str(e)}")

@app.post("/api/batch-geocode")
async def batch_geocode_addresses(addresses: List[str]):
    """批量地址地理编码"""
    try:
        if len(addresses) > 100:
            raise HTTPException(status_code=400, detail="批量地理编码最多支持100个地址")
        
        results = geocoding_service.batch_geocode(addresses)
        
        return {
            "results": results,
            "total": len(addresses),
            "success_count": sum(1 for r in results if r["success"]),
            "failure_count": sum(1 for r in results if not r["success"])
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量地理编码失败: {str(e)}")

@app.get("/api/geocode/cache-info")
async def get_geocode_cache_info():
    """获取地理编码缓存信息"""
    try:
        cache_info = geocoding_service.get_cache_info()
        return cache_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取缓存信息失败: {str(e)}")

@app.post("/api/geocode/clear-cache")
async def clear_geocode_cache():
    """清除地理编码缓存"""
    try:
        geocoding_service.clear_cache()
        return {"message": "地理编码缓存已清除"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清除缓存失败: {str(e)}")

@app.post("/api/geocode/batch-update")
async def batch_update_coordinates(
    limit: Optional[int] = Query(50, ge=1, le=100, description="每次处理的地址数量"),
    offset: Optional[int] = Query(0, ge=0, description="跳过的记录数"),
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """批量更新地址坐标"""
    try:
        from database import CustomerDirectoryDB
        
        # 获取没有坐标的地址记录
        addresses_without_coords = repo.db.query(CustomerDirectoryDB).filter(
            or_(
                CustomerDirectoryDB.lat.is_(None),
                CustomerDirectoryDB.lng.is_(None)
            )
        ).offset(offset).limit(limit).all()
        
        if not addresses_without_coords:
            return {
                "message": "没有需要更新坐标的地址",
                "processed": 0,
                "successful": 0,
                "failed": 0
            }
        
        results = {
            "processed": 0,
            "successful": 0, 
            "failed": 0,
            "details": []
        }
        
        for address in addresses_without_coords:
            try:
                # 使用full_address获取坐标
                lat, lng = geocoding_service.get_coordinates(address.full_address)
                
                if lat is not None and lng is not None:
                    # 更新数据库
                    address.lat = lat
                    address.lng = lng
                    repo.db.commit()
                    
                    results["successful"] += 1
                    results["details"].append({
                        "id": address.id,
                        "customer_name": address.customer_name,
                        "address": address.full_address,
                        "lat": lat,
                        "lng": lng,
                        "status": "success"
                    })
                else:
                    results["failed"] += 1
                    results["details"].append({
                        "id": address.id,
                        "customer_name": address.customer_name,
                        "address": address.full_address,
                        "status": "failed",
                        "error": "无法获取坐标"
                    })
                
                results["processed"] += 1
                
                # 避免API限制，添加延迟
                import time
                time.sleep(0.2)
                
            except Exception as e:
                results["failed"] += 1
                results["details"].append({
                    "id": address.id,
                    "customer_name": address.customer_name,
                    "address": address.full_address,
                    "status": "error",
                    "error": str(e)
                })
                results["processed"] += 1
        
        return {
            "message": f"批量地理编码完成",
            "processed": results["processed"],
            "successful": results["successful"],
            "failed": results["failed"],
            "details": results["details"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量地理编码失败: {str(e)}")

@app.get("/api/geocode/status")
async def get_geocode_status(
    repo: CustomerDirectoryRepository = Depends(get_customer_directory_repository)
):
    """获取地理编码状态"""
    try:
        from database import CustomerDirectoryDB
        
        total_addresses = repo.db.query(CustomerDirectoryDB).count()
        
        addresses_with_coords = repo.db.query(CustomerDirectoryDB).filter(
            and_(
                CustomerDirectoryDB.lat.isnot(None),
                CustomerDirectoryDB.lng.isnot(None)
            )
        ).count()
        
        addresses_without_coords = total_addresses - addresses_with_coords
        
        return {
            "total_addresses": total_addresses,
            "with_coordinates": addresses_with_coords,
            "without_coordinates": addresses_without_coords,
            "completion_rate": round((addresses_with_coords / total_addresses * 100), 2) if total_addresses > 0 else 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取地理编码状态失败: {str(e)}")

@app.get("/api/place-details")
async def get_place_details(address: str):
    """获取地址详细信息"""
    try:
        details = geocoding_service.get_place_details(address)
        if not details:
            raise HTTPException(status_code=404, detail="无法找到该地址的详细信息")
        
        return details
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取地址详细信息失败: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
