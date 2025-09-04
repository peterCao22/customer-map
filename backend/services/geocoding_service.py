import googlemaps
from typing import Tuple, Optional, List, Dict, Any
import logging
import time
from functools import lru_cache
import hashlib
import json
from config import settings

logger = logging.getLogger(__name__)

class GeocodingService:
    """Google Maps地理编码服务"""
    
    def __init__(self, api_key: str):
        if not api_key:
            logger.warning("Google Maps API密钥未配置，地理编码功能将不可用")
            self.client = None
        else:
            self.client = googlemaps.Client(key=api_key)
            logger.info("Google Maps地理编码服务初始化成功")
        
        # 配置选项
        self.max_retries = 3
        self.retry_delay = 1.0  # 秒
        self.cache_size = 1000
    
    def _get_cache_key(self, address: str) -> str:
        """生成地址的缓存键"""
        return hashlib.md5(address.lower().encode('utf-8')).hexdigest()
    
    @lru_cache(maxsize=1000)
    def _cached_geocode(self, address_hash: str, address: str) -> Tuple[Optional[float], Optional[float]]:
        """带缓存的地理编码（内部方法）"""
        return self._geocode_with_retry(address)
    
    def _geocode_with_retry(self, address: str) -> Tuple[Optional[float], Optional[float]]:
        """带重试机制的地理编码"""
        if not self.client:
            logger.error("Google Maps客户端未初始化")
            return None, None
        
        for attempt in range(self.max_retries):
            try:
                # 调用地理编码API
                geocode_result = self.client.geocode(
                    address,
                    language='en',     # 使用英文
                    region='US'       # 优先返回美国的结果
                )
                
                if geocode_result and len(geocode_result) > 0:
                    location = geocode_result[0]['geometry']['location']
                    lat = location['lat']
                    lng = location['lng']
                    
                    # 获取格式化地址
                    formatted_address = geocode_result[0].get('formatted_address', address)
                    
                    logger.info(f"地址 '{address}' 地理编码成功: ({lat}, {lng}) - {formatted_address}")
                    return lat, lng
                else:
                    logger.warning(f"地址 '{address}' 地理编码失败：未找到结果")
                    return None, None
                    
            except googlemaps.exceptions.ApiError as e:
                logger.error(f"Google Maps API错误 (尝试 {attempt + 1}/{self.max_retries}): {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))  # 指数退避
                else:
                    return None, None
            except Exception as e:
                logger.error(f"地理编码过程中发生错误 (尝试 {attempt + 1}/{self.max_retries}): {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                else:
                    return None, None
        
        return None, None
    
    def get_coordinates(self, address: str) -> Tuple[Optional[float], Optional[float]]:
        """
        根据地址获取经纬度坐标（带缓存）
        
        Args:
            address: 地址字符串
            
        Returns:
            Tuple[lat, lng]: 纬度和经度，如果失败返回(None, None)
        """
        if not address or not address.strip():
            logger.warning("地址为空，无法进行地理编码")
            return None, None
        
        address = address.strip()
        address_hash = self._get_cache_key(address)
        
        try:
            return self._cached_geocode(address_hash, address)
        except Exception as e:
            logger.error(f"地理编码缓存处理失败: {e}")
            return self._geocode_with_retry(address)
    
    def batch_geocode(self, addresses: List[str]) -> List[Dict[str, Any]]:
        """
        批量地理编码
        
        Args:
            addresses: 地址列表
            
        Returns:
            List[Dict]: 包含地址和坐标信息的字典列表
        """
        results = []
        
        for i, address in enumerate(addresses):
            logger.info(f"批量地理编码进度: {i + 1}/{len(addresses)}")
            
            lat, lng = self.get_coordinates(address)
            
            result = {
                "address": address,
                "lat": lat,
                "lng": lng,
                "success": lat is not None and lng is not None
            }
            
            results.append(result)
            
            # 避免API限制，添加小延迟
            if i < len(addresses) - 1:
                time.sleep(0.1)
        
        success_count = sum(1 for r in results if r["success"])
        logger.info(f"批量地理编码完成: {success_count}/{len(addresses)} 成功")
        
        return results
    
    def reverse_geocode(self, lat: float, lng: float) -> Optional[str]:
        """
        根据经纬度获取地址（反向地理编码）
        
        Args:
            lat: 纬度
            lng: 经度
            
        Returns:
            地址字符串，如果失败返回None
        """
        if not self.client:
            logger.error("Google Maps客户端未初始化")
            return None
        
        for attempt in range(self.max_retries):
            try:
                reverse_geocode_result = self.client.reverse_geocode(
                    (lat, lng),
                    language='en'     # 使用英文
                )
                
                if reverse_geocode_result and len(reverse_geocode_result) > 0:
                    address = reverse_geocode_result[0]['formatted_address']
                    logger.info(f"坐标 ({lat}, {lng}) 反向地理编码成功: {address}")
                    return address
                else:
                    logger.warning(f"坐标 ({lat}, {lng}) 反向地理编码失败：未找到结果")
                    return None
                    
            except googlemaps.exceptions.ApiError as e:
                logger.error(f"Google Maps API错误 (尝试 {attempt + 1}/{self.max_retries}): {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))
                else:
                    return None
            except Exception as e:
                logger.error(f"反向地理编码过程中发生错误 (尝试 {attempt + 1}/{self.max_retries}): {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                else:
                    return None
        
        return None
    
    def get_place_details(self, address: str) -> Optional[Dict[str, Any]]:
        """
        获取地址的详细信息
        
        Args:
            address: 地址字符串
            
        Returns:
            包含详细信息的字典，如果失败返回None
        """
        if not self.client:
            logger.error("Google Maps客户端未初始化")
            return None
        
        try:
            geocode_result = self.client.geocode(
                address,
                language='en',
                region='US'
            )
            
            if geocode_result and len(geocode_result) > 0:
                result = geocode_result[0]
                
                details = {
                    "formatted_address": result.get('formatted_address'),
                    "location": result['geometry']['location'],
                    "location_type": result['geometry'].get('location_type'),
                    "viewport": result['geometry'].get('viewport'),
                    "place_id": result.get('place_id'),
                    "types": result.get('types', []),
                    "address_components": result.get('address_components', [])
                }
                
                logger.info(f"获取地址详细信息成功: {address}")
                return details
            else:
                logger.warning(f"获取地址详细信息失败：未找到结果 - {address}")
                return None
                
        except Exception as e:
            logger.error(f"获取地址详细信息时发生错误: {e}")
            return None
    
    def validate_coordinates(self, lat: float, lng: float) -> bool:
        """
        验证坐标是否有效
        
        Args:
            lat: 纬度
            lng: 经度
            
        Returns:
            bool: 坐标是否有效
        """
        return (
            -90 <= lat <= 90 and
            -180 <= lng <= 180
        )
    
    def clear_cache(self):
        """清除地理编码缓存"""
        self._cached_geocode.cache_clear()
        logger.info("地理编码缓存已清除")
    
    def get_cache_info(self) -> Dict[str, Any]:
        """获取缓存信息"""
        cache_info = self._cached_geocode.cache_info()
        return {
            "hits": cache_info.hits,
            "misses": cache_info.misses,
            "maxsize": cache_info.maxsize,
            "currsize": cache_info.currsize,
            "hit_rate": cache_info.hits / (cache_info.hits + cache_info.misses) if (cache_info.hits + cache_info.misses) > 0 else 0
        }
