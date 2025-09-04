# Ubuntu 服务器自托管部署指南

## 🚀 专门针对你的部署需求

### 环境信息
- **服务器**: Ubuntu 服务器
- **部署方式**: 本地自托管
- **后端配置**: config.py 文件管理
- **前端**: Next.js 
- **后端**: FastAPI + Python

## 📋 部署前准备

### 1. 服务器环境检查
```bash
# 检查Ubuntu版本
lsb_release -a

# 更新系统包
sudo apt update && sudo apt upgrade -y

# 检查防火墙状态
sudo ufw status
```

### 2. 安装必要软件

```bash
# 安装Node.js (推荐使用NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装pnpm
npm install -g pnpm

# 安装Python 3.11
sudo apt install python3.11 python3.11-venv python3-pip -y

# 安装PM2 (进程管理器)
npm install -g pm2

# 安装Nginx (可选，用于反向代理)
sudo apt install nginx -y
```

## 🔧 后端部署配置

### 1. 修改 backend/config.py 生产配置

创建生产环境配置文件：
```bash
# 创建生产环境配置
cp backend/config.py backend/config_prod.py
```

**编辑 `backend/config_prod.py`：**
```python
from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    """生产环境配置"""
    
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False  # 生产环境关闭调试
    
    # 数据库配置 (你的MySQL配置)
    DATABASE_URL: str = "mysql+pymysql://root:wonder%402025@192.168.8.40:3306/structured"
    
    # Google Maps API配置 (建议从环境变量读取)
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "AIzaSyBMkDXChYggBlWNUOOA7ysyf24eWRgf8sg")
    
    # CORS配置 - 生产环境应该限制域名
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://your-server-ip:3000",  # 替换为你的服务器IP
        "https://your-domain.com",     # 如果有域名的话
    ]
    
    # 分页配置
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# 创建全局设置实例
settings = Settings()
```

### 2. 创建后端启动脚本

**创建 `backend/start_prod.py`：**
```python
import uvicorn
from config_prod import settings

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        workers=4,  # 4个工作进程
        log_level="info",
        access_log=True,
    )
```

## 🎯 前端部署配置

### 1. 创建生产环境变量

**创建 `.env.production`：**
```env
# Google Maps 配置
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=你的真实Google_Maps_API密钥
NEXT_PUBLIC_GOOGLE_MAP_ID=你的真实Google_Map_ID

# API 配置 (指向你的Ubuntu服务器)
NEXT_PUBLIC_API_BASE_URL=http://your-server-ip:8000

# 生产环境配置
NODE_ENV=production
```

## 🚀 Ubuntu 一键部署脚本

**创建 `ubuntu_deploy.sh`：**
```bash
#!/bin/bash

echo "🚀 开始部署到Ubuntu服务器..."

# 设置项目目录
PROJECT_DIR="/opt/customer-map"
FRONTEND_DIR="$PROJECT_DIR"
BACKEND_DIR="$PROJECT_DIR/backend"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "请不要使用root用户运行此脚本"
        exit 1
    fi
}

# 创建项目目录
setup_directories() {
    print_status "设置项目目录..."
    sudo mkdir -p $PROJECT_DIR
    sudo chown -R $USER:$USER $PROJECT_DIR
    
    if [ ! -d "$PROJECT_DIR/.git" ]; then
        print_status "克隆项目代码..."
        git clone https://github.com/peterCao22/customer-map.git $PROJECT_DIR
    else
        print_status "更新项目代码..."
        cd $PROJECT_DIR
        git pull origin main
    fi
}

# 部署前端
deploy_frontend() {
    print_status "部署前端..."
    cd $FRONTEND_DIR
    
    # 检查环境变量文件
    if [ ! -f ".env.production" ]; then
        print_warning "创建 .env.production 模板文件"
        cat > .env.production << 'EOF'
# Google Maps 配置 (请填入真实值)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
NEXT_PUBLIC_GOOGLE_MAP_ID=your_google_map_id_here

# API 配置
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# 生产环境配置
NODE_ENV=production
EOF
        print_error "请编辑 $PROJECT_DIR/.env.production 文件，填入真实的API密钥！"
        print_error "编辑完成后重新运行脚本"
        exit 1
    fi
    
    # 安装依赖并构建
    print_status "安装前端依赖..."
    pnpm install --frozen-lockfile
    
    print_status "构建前端..."
    pnpm build
    
    print_status "前端构建完成"
}

# 部署后端
deploy_backend() {
    print_status "部署后端..."
    cd $BACKEND_DIR
    
    # 创建Python虚拟环境
    if [ ! -d "venv" ]; then
        print_status "创建Python虚拟环境..."
        python3.11 -m venv venv
    fi
    
    # 激活虚拟环境并安装依赖
    source venv/bin/activate
    print_status "安装后端依赖..."
    pip install --upgrade pip
    pip install -r requirements.txt
    pip install gunicorn  # 生产环境WSGI服务器
    
    # 检查配置文件
    if [ ! -f "config_prod.py" ]; then
        print_status "创建生产配置文件..."
        cp config.py config_prod.py
        
        # 修改生产配置
        sed -i 's/DEBUG: bool = True/DEBUG: bool = False/' config_prod.py
        print_warning "请检查 $BACKEND_DIR/config_prod.py 中的配置是否正确"
    fi
    
    print_status "后端准备完成"
}

# 配置PM2启动
setup_pm2() {
    print_status "配置PM2进程管理..."
    
    # 停止现有进程
    pm2 stop customer-map-frontend customer-map-backend 2>/dev/null || true
    pm2 delete customer-map-frontend customer-map-backend 2>/dev/null || true
    
    # 启动后端
    cd $BACKEND_DIR
    source venv/bin/activate
    pm2 start "python start_prod.py" --name "customer-map-backend" --cwd $BACKEND_DIR
    
    # 启动前端
    cd $FRONTEND_DIR
    pm2 start "pnpm start" --name "customer-map-frontend" --cwd $FRONTEND_DIR
    
    # 保存PM2配置
    pm2 save
    
    # 设置开机自启
    pm2 startup | grep -E "sudo env PATH" | bash
    
    print_status "PM2配置完成"
}

# 配置防火墙
setup_firewall() {
    print_status "配置防火墙..."
    
    # 允许SSH
    sudo ufw allow ssh
    
    # 允许应用端口
    sudo ufw allow 3000/tcp  # 前端
    sudo ufw allow 8000/tcp  # 后端
    
    # 如果使用Nginx，允许HTTP/HTTPS
    # sudo ufw allow 'Nginx Full'
    
    # 启用防火墙
    sudo ufw --force enable
    
    print_status "防火墙配置完成"
}

# 显示部署结果
show_results() {
    print_status "部署完成！"
    echo
    echo "📍 服务访问地址:"
    echo "   前端: http://$(hostname -I | awk '{print $1}'):3000"
    echo "   后端: http://$(hostname -I | awk '{print $1}'):8000"
    echo
    echo "📊 管理命令:"
    echo "   查看状态: pm2 status"
    echo "   查看日志: pm2 logs"
    echo "   重启服务: pm2 restart all"
    echo "   停止服务: pm2 stop all"
    echo
    echo "🔧 配置文件位置:"
    echo "   项目目录: $PROJECT_DIR"
    echo "   前端环境变量: $PROJECT_DIR/.env.production"
    echo "   后端配置: $BACKEND_DIR/config_prod.py"
}

# 主执行流程
main() {
    check_root
    setup_directories
    deploy_frontend
    deploy_backend
    setup_pm2
    setup_firewall
    show_results
}

# 运行部署
main
```

## 📊 Nginx 反向代理配置 (可选)

如果你想通过80端口访问，配置Nginx：

**创建 `/etc/nginx/sites-available/customer-map`：**
```nginx
server {
    listen 80;
    server_name your-server-ip;  # 替换为你的服务器IP或域名
    
    # 前端
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 后端API
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 健康检查
    location /health {
        proxy_pass http://localhost:8000/health;
    }
}
```

**启用配置：**
```bash
sudo ln -s /etc/nginx/sites-available/customer-map /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔧 使用方法

### 1. 准备服务器
```bash
# 上传项目到服务器（如果还没有的话）
scp -r /path/to/customer-map ubuntu@your-server:/tmp/

# SSH到服务器
ssh ubuntu@your-server-ip
```

### 2. 运行部署脚本
```bash
# 使脚本可执行
chmod +x ubuntu_deploy.sh

# 运行部署
./ubuntu_deploy.sh
```

### 3. 配置Google Maps API
```bash
# 编辑前端环境变量
nano /opt/customer-map/.env.production

# 编辑后端配置（如果需要）
nano /opt/customer-map/backend/config_prod.py
```

### 4. 重启服务生效
```bash
pm2 restart all
```

## 🔍 故障排查

### 常用命令
```bash
# 查看服务状态
pm2 status

# 查看实时日志
pm2 logs

# 查看端口占用
netstat -tlnp | grep :3000
netstat -tlnp | grep :8000

# 检查防火墙
sudo ufw status

# 测试后端API
curl http://localhost:8000/health
```

### 常见问题
1. **端口被占用** → 修改config_prod.py中的端口
2. **数据库连接失败** → 检查DATABASE_URL配置
3. **Google Maps不显示** → 检查API密钥和域名限制
4. **前端无法访问后端** → 检查CORS配置和防火墙

这个配置专门针对你的需求优化，有什么问题随时告诉我！
