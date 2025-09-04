from sqlalchemy import create_engine, Column, String, Float, Integer, Text, or_, and_, BigInteger
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.sql import func as sql_func
from typing import Generator, List, Optional, Tuple
from fastapi import Depends
import math

from config import settings
from models import CustomerDirectoryCreate, CustomerDirectoryUpdate, SearchFilters, LocationSearchFilters, SortField, SortOrder, SearchSuggestion

# 创建数据库引擎
engine = create_engine(settings.DATABASE_URL)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基础模型类
Base = declarative_base()

class CustomerDirectoryDB(Base):
    """客户地址目录数据库模型"""
    __tablename__ = "customer_directory"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    customer_id = Column(String(50), nullable=False, index=True)
    customer_name = Column(String(255), nullable=False, index=True)
    address_id = Column(String(50), nullable=False, index=True)
    country = Column(String(255), nullable=False, index=True)
    country_db = Column(String(10), nullable=True)
    address_line1 = Column(Text, nullable=False)
    address_line2 = Column(Text, nullable=True)
    zip_code = Column(String(50), nullable=False, index=True)
    city = Column(String(255), nullable=False, index=True)
    state = Column(String(255), nullable=False, index=True)
    full_address = Column(String(255), nullable=False)
    full_description = Column(String(255), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    tags = Column(Text, nullable=True)  # JSON格式存储标签
    sales_radius = Column(Integer, default=10)
    total_amount = Column(Integer, nullable=True)  # 客户销售总额

def create_tables():
    """创建数据库表"""
    Base.metadata.create_all(bind=engine)

def get_db() -> Generator[Session, None, None]:
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class CustomerDirectoryRepository:
    """客户地址目录数据库操作类"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_customer_address(self, address_data: CustomerDirectoryCreate, lat: Optional[float] = None, lng: Optional[float] = None) -> CustomerDirectoryDB:
        """创建新客户地址记录"""
        import json
        db_address = CustomerDirectoryDB(
            customer_id=address_data.customer_id,
            customer_name=address_data.customer_name,
            address_id=address_data.address_id,
            country=address_data.country,
            country_db=address_data.country_db,
            address_line1=address_data.address_line1,
            address_line2=address_data.address_line2,
            zip_code=address_data.zip_code,
            city=address_data.city,
            state=address_data.state,
            full_address=address_data.full_address,
            full_description=address_data.full_description,
            tags=json.dumps(address_data.tags) if address_data.tags else None,
            sales_radius=address_data.sales_radius or 10,
            lat=lat,
            lng=lng
        )
        self.db.add(db_address)
        self.db.commit()
        self.db.refresh(db_address)
        return db_address
    
    def get_address_by_id(self, record_id: int) -> Optional[CustomerDirectoryDB]:
        """根据记录ID获取地址"""
        return self.db.query(CustomerDirectoryDB).filter(CustomerDirectoryDB.id == record_id).first()
    
    def get_addresses_by_customer_id(self, customer_id: str) -> List[CustomerDirectoryDB]:
        """根据客户ID获取所有地址"""
        return self.db.query(CustomerDirectoryDB).filter(CustomerDirectoryDB.customer_id == customer_id).all()
    
    def get_address_by_address_id(self, customer_id: str, address_id: str) -> Optional[CustomerDirectoryDB]:
        """根据客户ID和地址ID获取特定地址"""
        return self.db.query(CustomerDirectoryDB).filter(
            and_(
                CustomerDirectoryDB.customer_id == customer_id,
                CustomerDirectoryDB.address_id == address_id
            )
        ).first()
    
    def get_customer_addresses(self, skip: int = 0, limit: int = 20) -> List[CustomerDirectoryDB]:
        """获取客户地址列表（分页）"""
        return self.db.query(CustomerDirectoryDB).offset(skip).limit(limit).all()
    
    def get_addresses_count(self) -> int:
        """获取地址总数"""
        return self.db.query(CustomerDirectoryDB).count()
    
    def update_customer_address(self, record_id: int, address_data: CustomerDirectoryUpdate, lat: Optional[float] = None, lng: Optional[float] = None) -> Optional[CustomerDirectoryDB]:
        """更新客户地址信息"""
        db_address = self.get_address_by_id(record_id)
        if not db_address:
            return None
        
        import json
        update_data = address_data.model_dump(exclude_unset=True)
        
        # 如果提供了新的坐标，更新坐标
        if lat is not None:
            update_data['lat'] = lat
        if lng is not None:
            update_data['lng'] = lng
        
        # 特殊处理tags字段
        if 'tags' in update_data:
            update_data['tags'] = json.dumps(update_data['tags']) if update_data['tags'] else None
        
        for field, value in update_data.items():
            setattr(db_address, field, value)
        
        self.db.commit()
        self.db.refresh(db_address)
        return db_address
    
    def delete_customer_address(self, record_id: int) -> bool:
        """删除客户地址记录"""
        db_address = self.get_address_by_id(record_id)
        if not db_address:
            return False
        
        self.db.delete(db_address)
        self.db.commit()
        return True
    
    def search_customer_addresses(self, filters: SearchFilters) -> Tuple[List[CustomerDirectoryDB], int]:
        """搜索和过滤客户地址"""
        query = self.db.query(CustomerDirectoryDB)
        
        # 关键词搜索
        if filters.query:
            search_term = f"%{filters.query}%"
            query = query.filter(
                or_(
                    CustomerDirectoryDB.customer_id.ilike(search_term),      # 添加客户ID搜索
                    CustomerDirectoryDB.customer_name.ilike(search_term),
                    CustomerDirectoryDB.full_address.ilike(search_term),
                    CustomerDirectoryDB.address_line1.ilike(search_term),
                    CustomerDirectoryDB.city.ilike(search_term),
                    CustomerDirectoryDB.state.ilike(search_term),
                    CustomerDirectoryDB.zip_code.ilike(search_term),
                    CustomerDirectoryDB.tags.ilike(search_term)
                )
            )
        
        # 客户ID过滤
        if filters.customer_id:
            query = query.filter(CustomerDirectoryDB.customer_id == filters.customer_id)
        
        # 国家过滤
        if filters.country:
            query = query.filter(CustomerDirectoryDB.country.ilike(f"%{filters.country}%"))
        
        # 州/省过滤
        if filters.state:
            query = query.filter(CustomerDirectoryDB.state.ilike(f"%{filters.state}%"))
        
        # 城市过滤
        if filters.city:
            query = query.filter(CustomerDirectoryDB.city.ilike(f"%{filters.city}%"))
        
        # 邮编过滤
        if filters.zip_code:
            query = query.filter(CustomerDirectoryDB.zip_code.ilike(f"%{filters.zip_code}%"))
        
        # 标签过滤
        if filters.tags:
            for tag in filters.tags:
                query = query.filter(CustomerDirectoryDB.tags.ilike(f"%{tag}%"))
        
        # 销售范围过滤
        if filters.min_sales_radius:
            query = query.filter(CustomerDirectoryDB.sales_radius >= filters.min_sales_radius)
        
        if filters.max_sales_radius:
            query = query.filter(CustomerDirectoryDB.sales_radius <= filters.max_sales_radius)
        
        # 排序
        if filters.sort_by:
            sort_column = getattr(CustomerDirectoryDB, filters.sort_by.value)
            if filters.sort_order == SortOrder.DESC:
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
        
        # 获取总数
        total = query.count()
        
        # 分页
        skip = (filters.page - 1) * filters.page_size
        addresses = query.offset(skip).limit(filters.page_size).all()
        
        return addresses, total
    
    def search_addresses_by_location(self, filters: LocationSearchFilters) -> Tuple[List[Tuple[CustomerDirectoryDB, float]], int]:
        """根据地理位置搜索客户地址"""
        # 使用Haversine公式计算距离
        # 注意：这是一个简化的实现，生产环境建议使用PostGIS等专业的地理数据库扩展
        
        query = self.db.query(CustomerDirectoryDB).filter(
            and_(
                CustomerDirectoryDB.lat.isnot(None),
                CustomerDirectoryDB.lng.isnot(None)
            )
        )
        
        # 国家过滤
        if filters.country:
            query = query.filter(CustomerDirectoryDB.country.ilike(f"%{filters.country}%"))
        
        # 州/省过滤
        if filters.state:
            query = query.filter(CustomerDirectoryDB.state.ilike(f"%{filters.state}%"))
        
        # 城市过滤
        if filters.city:
            query = query.filter(CustomerDirectoryDB.city.ilike(f"%{filters.city}%"))
        
        # 获取所有地址并计算距离
        all_addresses = query.all()
        addresses_with_distance = []
        
        for address in all_addresses:
            distance = self._calculate_distance(
                filters.center_lat, filters.center_lng,
                address.lat, address.lng
            )
            
            if distance <= filters.radius_km:
                addresses_with_distance.append((address, distance))
        
        # 按距离排序
        addresses_with_distance.sort(key=lambda x: x[1])
        
        # 分页
        total = len(addresses_with_distance)
        skip = (filters.page - 1) * filters.page_size
        paginated_addresses = addresses_with_distance[skip:skip + filters.page_size]
        
        return paginated_addresses, total
    
    def _calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """使用Haversine公式计算两点间距离（公里）"""
        R = 6371  # 地球半径（公里）
        
        lat1_rad = math.radians(lat1)
        lng1_rad = math.radians(lng1)
        lat2_rad = math.radians(lat2)
        lng2_rad = math.radians(lng2)
        
        dlat = lat2_rad - lat1_rad
        dlng = lng2_rad - lng1_rad
        
        a = (math.sin(dlat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def get_search_suggestions(self, query: str, limit: int = 10) -> List[SearchSuggestion]:
        """获取搜索建议"""
        suggestions = []
        search_term = f"%{query}%"
        
        # 客户姓名建议
        name_results = self.db.query(CustomerDirectoryDB.customer_name, sql_func.count(CustomerDirectoryDB.id).label('count')) \
            .filter(CustomerDirectoryDB.customer_name.ilike(search_term)) \
            .group_by(CustomerDirectoryDB.customer_name) \
            .order_by(sql_func.count(CustomerDirectoryDB.id).desc()) \
            .limit(limit).all()
        
        for name, count in name_results:
            suggestions.append(SearchSuggestion(type="customer_name", value=name, count=count))
        
        # 城市建议
        city_results = self.db.query(CustomerDirectoryDB.city, sql_func.count(CustomerDirectoryDB.id).label('count')) \
            .filter(CustomerDirectoryDB.city.ilike(search_term)) \
            .group_by(CustomerDirectoryDB.city) \
            .order_by(sql_func.count(CustomerDirectoryDB.id).desc()) \
            .limit(limit).all()
        
        for city, count in city_results:
            suggestions.append(SearchSuggestion(type="city", value=city, count=count))
        
        # 州/省建议
        state_results = self.db.query(CustomerDirectoryDB.state, sql_func.count(CustomerDirectoryDB.id).label('count')) \
            .filter(CustomerDirectoryDB.state.ilike(search_term)) \
            .group_by(CustomerDirectoryDB.state) \
            .order_by(sql_func.count(CustomerDirectoryDB.id).desc()) \
            .limit(limit).all()
        
        for state, count in state_results:
            suggestions.append(SearchSuggestion(type="state", value=state, count=count))
        
        # 国家建议
        country_results = self.db.query(CustomerDirectoryDB.country, sql_func.count(CustomerDirectoryDB.id).label('count')) \
            .filter(CustomerDirectoryDB.country.ilike(search_term)) \
            .group_by(CustomerDirectoryDB.country) \
            .order_by(sql_func.count(CustomerDirectoryDB.id).desc()) \
            .limit(limit).all()
        
        for country, count in country_results:
            suggestions.append(SearchSuggestion(type="country", value=country, count=count))
        
        return suggestions[:limit]
    
    def get_all_tags(self) -> List[str]:
        """获取所有使用过的标签"""
        import json
        all_addresses = self.db.query(CustomerDirectoryDB.tags).filter(CustomerDirectoryDB.tags.isnot(None)).all()
        tag_set = set()
        
        for address in all_addresses:
            if address.tags:
                try:
                    tags = json.loads(address.tags)
                    if isinstance(tags, list):
                        tag_set.update(tags)
                except:
                    continue
        
        return sorted(list(tag_set))
    
    def get_statistics(self) -> dict:
        """获取客户地址统计信息"""
        total_addresses = self.db.query(CustomerDirectoryDB).count()
        unique_customers = self.db.query(CustomerDirectoryDB.customer_id).distinct().count()
        
        # 按国家统计
        country_stats = self.db.query(CustomerDirectoryDB.country, sql_func.count(CustomerDirectoryDB.id).label('count')) \
            .group_by(CustomerDirectoryDB.country) \
            .order_by(sql_func.count(CustomerDirectoryDB.id).desc()) \
            .limit(10).all()
        
        # 按州/省统计
        state_stats = self.db.query(CustomerDirectoryDB.state, sql_func.count(CustomerDirectoryDB.id).label('count')) \
            .group_by(CustomerDirectoryDB.state) \
            .order_by(sql_func.count(CustomerDirectoryDB.id).desc()) \
            .limit(10).all()
        
        # 按城市统计
        city_stats = self.db.query(CustomerDirectoryDB.city, sql_func.count(CustomerDirectoryDB.id).label('count')) \
            .group_by(CustomerDirectoryDB.city) \
            .order_by(sql_func.count(CustomerDirectoryDB.id).desc()) \
            .limit(10).all()
        
        return {
            "total_addresses": total_addresses,
            "unique_customers": unique_customers,
            "top_countries": [{"country": country, "count": count} for country, count in country_stats],
            "top_states": [{"state": state, "count": count} for state, count in state_stats],
            "top_cities": [{"city": city, "count": count} for city, count in city_stats],
            "addresses_with_coordinates": self.db.query(CustomerDirectoryDB).filter(
                and_(CustomerDirectoryDB.lat.isnot(None), CustomerDirectoryDB.lng.isnot(None))
            ).count()
        }

def get_customer_directory_repository(db: Session = Depends(get_db)) -> CustomerDirectoryRepository:
    """获取客户地址目录仓库实例"""
    return CustomerDirectoryRepository(db)

def init_sample_data():
    """初始化示例数据"""
    db = SessionLocal()
    try:
        # 检查是否已有数据
        if db.query(CustomerDirectoryDB).count() > 0:
            print("数据库中已有数据，跳过示例数据初始化")
            return
        
        # 创建美国/加拿大客户地址示例数据
        import json
        sample_addresses = [
            CustomerDirectoryDB(
                customer_id="CUST001",
                customer_name="John Smith",
                address_id="ADDR001",
                country="United States",
                country_db="US",
                address_line1="123 Main Street",
                address_line2="Suite 456",
                zip_code="10001",
                city="New York",
                state="New York",
                full_address="123 Main Street, Suite 456, New York, NY 10001",
                full_description="Primary office location",
                tags=json.dumps(["VIP客户", "长期合作"]),
                sales_radius=15,
                lat=40.7128,
                lng=-74.0060
            ),
            CustomerDirectoryDB(
                customer_id="CUST001",
                customer_name="John Smith",
                address_id="ADDR002",
                country="United States",
                country_db="US",
                address_line1="789 Oak Avenue",
                address_line2=None,
                zip_code="90210",
                city="Beverly Hills",
                state="California",
                full_address="789 Oak Avenue, Beverly Hills, CA 90210",
                full_description="West Coast branch",
                tags=json.dumps(["西海岸", "分支机构"]),
                sales_radius=25,
                lat=34.0736,
                lng=-118.4004
            ),
            CustomerDirectoryDB(
                customer_id="CUST002",
                customer_name="Sarah Johnson",
                address_id="ADDR001",
                country="Canada",
                country_db="CA",
                address_line1="456 Maple Street",
                address_line2="Unit 12",
                zip_code="M5H 2N2",
                city="Toronto",
                state="Ontario",
                full_address="456 Maple Street, Unit 12, Toronto, ON M5H 2N2",
                full_description="Canadian headquarters",
                tags=json.dumps(["加拿大总部", "重要客户"]),
                sales_radius=20,
                lat=43.6532,
                lng=-79.3832
            )
        ]
        
        for address in sample_addresses:
            db.add(address)
        
        db.commit()
        print(f"✅ 成功初始化 {len(sample_addresses)} 条示例地址数据")
        
    except Exception as e:
        print(f"❌ 初始化示例数据失败: {e}")
        db.rollback()
    finally:
        db.close()
