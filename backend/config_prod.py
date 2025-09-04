from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    """Ubuntu服务器生产环境配置"""
    
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False  # 生产环境关闭调试模式
    
    # 数据库配置 (保持你的MySQL配置)
    DATABASE_URL: str = "mysql+pymysql://root:wonder%402025@192.168.8.40:3306/structured"
    
    # Google Maps API配置 (建议从环境变量读取以提高安全性)
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "AIzaSyBMkDXChYggBlWNUOOA7ysyf24eWRgf8sg")
    
    # CORS配置 - 生产环境安全设置
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",                    # 本地前端
        "http://127.0.0.1:3000",                   # 本地前端(备用)
        f"http://{os.popen('hostname -I').read().strip().split()[0] if os.popen('hostname -I').read().strip() else 'localhost'}:3000",  # 服务器IP前端
        "*"  # 如需更高安全性，请替换为具体的域名或IP
    ]
    
    # 分页配置
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    
    # 日志配置
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# 创建全局设置实例
settings = Settings()

# 生产环境启动时的配置验证
def validate_production_config():
    """验证生产环境配置"""
    import sys
    
    print("🔍 验证生产环境配置...")
    
    # 检查关键配置
    if not settings.DATABASE_URL:
        print("❌ 数据库URL未配置")
        return False
        
    if not settings.GOOGLE_MAPS_API_KEY or settings.GOOGLE_MAPS_API_KEY == "your-api-key":
        print("⚠️  Google Maps API密钥可能未正确配置")
    
    if settings.DEBUG:
        print("⚠️  生产环境建议关闭DEBUG模式")
    
    print(f"✅ 服务器: {settings.HOST}:{settings.PORT}")
    print(f"✅ 数据库: {settings.DATABASE_URL[:30]}...")
    print(f"✅ 调试模式: {settings.DEBUG}")
    print(f"✅ CORS域名数量: {len(settings.ALLOWED_ORIGINS)}")
    
    return True

if __name__ == "__main__":
    # 当直接运行此文件时，显示配置信息
    validate_production_config()
