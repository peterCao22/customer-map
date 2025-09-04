#!/bin/bash

# Ubuntu 服务器自托管部署脚本
# 专门针对config.py配置方式

echo "🚀 开始在Ubuntu服务器上部署客户地址管理系统..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_title() { echo -e "${BLUE}[STEP]${NC} $1"; }

# 检查运行权限
if [[ $EUID -eq 0 ]]; then
    print_error "请不要使用root用户运行此脚本"
    exit 1
fi

# 检查必要工具
check_requirements() {
    print_title "检查系统环境..."
    
    # 检查Node.js (支持nvm管理的Node.js)
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_status "✅ 检测到Node.js版本: $NODE_VERSION"
        
        # 检查版本是否满足要求 (>= 16.x)
        NODE_MAJOR=$(echo $NODE_VERSION | sed 's/v\([0-9]*\).*/\1/')
        if [ "$NODE_MAJOR" -ge 16 ]; then
            print_status "✅ Node.js版本满足要求 (>= 16.x)"
        else
            print_error "❌ Node.js版本过低，需要 >= 16.x"
            exit 1
        fi
    else
        print_error "❌ Node.js 未安装或未在PATH中"
        print_status "请确保已安装Node.js并且在当前shell中可用"
        print_status "如果使用nvm，请运行: nvm use 22"
        exit 1
    fi
    
    # 检查pnpm
    if ! command -v pnpm &> /dev/null; then
        print_status "安装pnpm..."
        npm install -g pnpm
    fi
    
    # 检查Python
    if ! command -v python3.11 &> /dev/null; then
        print_error "Python 3.11 未安装"
        print_status "安装Python 3.11..."
        sudo apt update
        sudo apt install python3.11 python3.11-venv python3-pip -y
    fi
    
    # 检查PM2
    if ! command -v pm2 &> /dev/null; then
        print_status "安装PM2..."
        npm install -g pm2
    fi
    
    print_status "环境检查完成 ✅"
}

# 部署前端
deploy_frontend() {
    print_title "部署前端应用..."
    
    # 检查环境变量文件
    if [ ! -f ".env.production" ]; then
        print_warning "创建前端环境变量模板..."
        cat > .env.production << 'EOF'
# Google Maps 配置 (必填)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
NEXT_PUBLIC_GOOGLE_MAP_ID=your_google_map_id_here

# API 配置 - 后端地址
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# 生产环境配置
NODE_ENV=production
EOF
        print_error "❗ 请编辑 .env.production 文件，填入真实的 Google Maps API 密钥"
        print_error "❗ 完成后重新运行此脚本"
        echo
        print_status "获取Google Maps API密钥："
        print_status "1. 访问 https://console.cloud.google.com/"
        print_status "2. 创建项目并启用 Maps JavaScript API"
        print_status "3. 创建API密钥和Map ID"
        exit 1
    fi
    
    # 验证API密钥是否已填写
    if grep -q "your_google_maps_api_key_here" .env.production; then
        print_error "请先在 .env.production 中填入真实的 Google Maps API 密钥"
        exit 1
    fi
    
    # 安装依赖
    print_status "安装前端依赖..."
    pnpm install --frozen-lockfile
    
    # 构建应用
    print_status "构建前端应用..."
    pnpm build
    
    print_status "前端部署完成 ✅"
}

# 部署后端
deploy_backend() {
    print_title "部署后端应用..."
    
    cd backend
    
    # 备份原配置
    if [ ! -f "config.py.backup" ]; then
        cp config.py config.py.backup
        print_status "已备份原配置文件"
    fi
    
    # 修改config.py为生产环境配置
    print_status "配置生产环境设置..."
    
    # 创建生产环境配置
    cat > config_prod.py << 'EOF'
from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    """生产环境配置"""
    
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False  # 生产环境关闭调试
    
    # 数据库配置 (保持原有配置)
    DATABASE_URL: str = "mysql+pymysql://root:wonder%402025@192.168.8.40:3306/structured"
    
    # Google Maps API配置 (从环境变量读取，提供后备值)
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "AIzaSyBMkDXChYggBlWNUOOA7ysyf24eWRgf8sg")
    
    # CORS配置 - 生产环境限制域名
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        f"http://{os.popen('hostname -I').read().strip().split()[0]}:3000",  # 自动获取服务器IP
        "*"  # 如果需要更严格的安全性，请替换为具体域名
    ]
    
    # 分页配置
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# 创建全局设置实例
settings = Settings()
EOF
    
    # 创建生产启动脚本
    cat > start_prod.py << 'EOF'
#!/usr/bin/env python3
"""
生产环境启动脚本
使用生产配置启动FastAPI应用
"""

import uvicorn
import sys
import os

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 导入生产配置
try:
    from config_prod import settings
    print(f"🚀 启动生产服务器...")
    print(f"📍 地址: {settings.HOST}:{settings.PORT}")
    print(f"🔧 调试模式: {settings.DEBUG}")
    print(f"🗄️  数据库: {settings.DATABASE_URL[:20]}...")
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=1,  # Ubuntu服务器可能资源有限，使用1个进程
        log_level="info",
        access_log=True,
        reload=False  # 生产环境不启用热重载
    )
except ImportError as e:
    print(f"❌ 配置文件导入失败: {e}")
    print("请确保 config_prod.py 文件存在且配置正确")
    sys.exit(1)
except Exception as e:
    print(f"❌ 服务器启动失败: {e}")
    sys.exit(1)
EOF
    
    chmod +x start_prod.py
    
    # 创建虚拟环境
    if [ ! -d "venv" ]; then
        print_status "创建Python虚拟环境..."
        python3.11 -m venv venv
    fi
    
    # 安装依赖
    print_status "安装后端依赖..."
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    pip install gunicorn  # 生产WSGI服务器
    
    # 测试配置
    print_status "测试后端配置..."
    python3 -c "from config_prod import settings; print('✅ 配置文件正常')" || {
        print_error "配置文件有错误，请检查"
        exit 1
    }
    
    cd ..
    print_status "后端部署完成 ✅"
}

# 配置PM2进程管理
setup_pm2() {
    print_title "配置进程管理..."
    
    # 停止现有进程
    pm2 stop customer-map-frontend customer-map-backend 2>/dev/null || true
    pm2 delete customer-map-frontend customer-map-backend 2>/dev/null || true
    
    # 启动后端
    print_status "启动后端服务..."
    cd backend
    source venv/bin/activate
    pm2 start start_prod.py --name "customer-map-backend" --interpreter python3
    cd ..
    
    # 启动前端
    print_status "启动前端服务..."
    pm2 start "pnpm start" --name "customer-map-frontend"
    
    # 保存PM2配置并设置开机自启
    pm2 save
    
    # 生成开机启动命令
    STARTUP_CMD=$(pm2 startup | grep "sudo env" | tail -1)
    if [ ! -z "$STARTUP_CMD" ]; then
        print_status "设置开机自启动..."
        eval $STARTUP_CMD
    fi
    
    print_status "进程管理配置完成 ✅"
}

# 配置防火墙
setup_firewall() {
    print_title "配置防火墙..."
    
    # 检查ufw是否安装
    if ! command -v ufw &> /dev/null; then
        print_status "安装ufw防火墙..."
        sudo apt install ufw -y
    fi
    
    # 配置防火墙规则
    sudo ufw --force reset  # 重置规则
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # 允许SSH
    sudo ufw allow ssh
    sudo ufw allow 22/tcp
    
    # 允许应用端口
    sudo ufw allow 3000/tcp comment 'Customer Map Frontend'
    sudo ufw allow 8000/tcp comment 'Customer Map Backend'
    
    # 启用防火墙
    sudo ufw --force enable
    
    print_status "防火墙配置完成 ✅"
}

# 显示部署结果
show_results() {
    print_title "🎉 部署完成！"
    echo
    
    # 获取服务器IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo -e "${GREEN}📍 服务访问地址:${NC}"
    echo -e "   🌐 前端: ${BLUE}http://$SERVER_IP:3000${NC}"
    echo -e "   ⚙️  后端: ${BLUE}http://$SERVER_IP:8000${NC}"
    echo -e "   ❤️  健康检查: ${BLUE}http://$SERVER_IP:8000/docs${NC}"
    echo
    echo -e "${GREEN}📊 管理命令:${NC}"
    echo "   pm2 status          # 查看服务状态"
    echo "   pm2 logs            # 查看所有日志"
    echo "   pm2 logs backend    # 查看后端日志"
    echo "   pm2 logs frontend   # 查看前端日志"
    echo "   pm2 restart all     # 重启所有服务"
    echo "   pm2 stop all        # 停止所有服务"
    echo "   pm2 monit           # 实时监控"
    echo
    echo -e "${GREEN}🔧 配置文件位置:${NC}"
    echo "   前端环境变量: $(pwd)/.env.production"
    echo "   后端配置: $(pwd)/backend/config_prod.py"
    echo "   后端启动脚本: $(pwd)/backend/start_prod.py"
    echo
    echo -e "${GREEN}🔍 故障排查:${NC}"
    echo "   检查端口占用: netstat -tlnp | grep :3000"
    echo "   查看防火墙: sudo ufw status"
    echo "   测试后端: curl http://localhost:8000/health"
    echo
    
    # 显示PM2状态
    print_status "当前服务状态:"
    pm2 status
}

# 健康检查
health_check() {
    print_title "运行健康检查..."
    
    sleep 3  # 等待服务启动
    
    # 检查前端
    if curl -f http://localhost:3000 >/dev/null 2>&1; then
        print_status "✅ 前端服务正常"
    else
        print_warning "⚠️  前端服务可能未正常启动"
    fi
    
    # 检查后端
    if curl -f http://localhost:8000/health >/dev/null 2>&1; then
        print_status "✅ 后端服务正常"
    else
        print_warning "⚠️  后端服务可能未正常启动"
    fi
}

# 主执行流程
main() {
    echo
    print_title "🚀 Ubuntu 服务器部署开始"
    echo
    
    check_requirements
    echo
    
    deploy_frontend
    echo
    
    deploy_backend
    echo
    
    setup_pm2
    echo
    
    setup_firewall
    echo
    
    health_check
    echo
    
    show_results
    echo
    
    print_status "🎊 恭喜！部署已完成"
    print_status "💡 如果遇到问题，请检查 pm2 logs 获取详细错误信息"
}

# 运行部署
main
