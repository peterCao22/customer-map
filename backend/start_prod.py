#!/usr/bin/env python3
"""
Ubuntu服务器生产环境启动脚本
专门针对config_prod.py配置文件
支持Python 3.8+ (测试环境: Python 3.10.12)
"""

import uvicorn
import sys
import os
from datetime import datetime

def main():
    try:
        # 添加当前目录到Python路径
        current_dir = os.path.dirname(os.path.abspath(__file__))
        sys.path.insert(0, current_dir)
        
        print(f"🕒 启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("🚀 正在启动客户地址管理系统后端服务...")
        
        # 导入生产配置
        from config_prod import settings, validate_production_config
        
        # 验证配置
        if not validate_production_config():
            print("❌ 配置验证失败，请检查config_prod.py")
            sys.exit(1)
        
        print("📡 启动FastAPI服务器...")
        
        # 启动服务器
        uvicorn.run(
            "main:app",
            host=settings.HOST,
            port=settings.PORT,
            workers=1,  # Ubuntu服务器资源考虑，使用单进程
            log_level=settings.LOG_LEVEL.lower(),
            access_log=True,
            reload=False,  # 生产环境禁用自动重载
            server_header=False,  # 隐藏服务器信息提升安全性
        )
        
    except ImportError as e:
        print(f"❌ 模块导入失败: {e}")
        print("请确保所有依赖已安装: pip install -r requirements.txt")
        print("请确保config_prod.py文件存在")
        sys.exit(1)
        
    except Exception as e:
        print(f"❌ 服务器启动失败: {e}")
        print("请检查:")
        print("1. 端口8000是否被占用: netstat -tlnp | grep 8000")
        print("2. 数据库连接是否正常")
        print("3. 配置文件是否正确")
        sys.exit(1)

if __name__ == "__main__":
    main()
