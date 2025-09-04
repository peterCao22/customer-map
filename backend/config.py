from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    """应用配置"""
    
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    
    # 数据库配置 
    DATABASE_URL: str = "mysql+pymysql://root:wonder%402025@192.168.8.40:3306/structured"
    
    # Google Maps API配置
    GOOGLE_MAPS_API_KEY: str = "AIzaSyBMkDXChYggBlWNUOOA7ysyf24eWRgf8sg"
    
    # CORS配置 - 允许任何IP访问（适用于内网环境）
    ALLOWED_ORIGINS: List[str] = ["*"]
    
    # 分页配置
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# 创建全局设置实例
settings = Settings()
