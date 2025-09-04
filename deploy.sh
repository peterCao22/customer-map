#!/bin/bash

# 客户地址管理系统 - 快速部署脚本
# 使用方法: chmod +x deploy.sh && ./deploy.sh

echo "🚀 开始部署客户地址管理系统..."

# 检查必要工具
check_requirements() {
    echo "📋 检查部署环境..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        echo "📦 安装 pnpm..."
        npm install -g pnpm
    fi
    
    if ! command -v python3 &> /dev/null; then
        echo "❌ Python3 未安装，请先安装 Python3"
        exit 1
    fi
    
    echo "✅ 环境检查完成"
}

# 部署前端
deploy_frontend() {
    echo "🎨 部署前端..."
    
    # 检查环境变量
    if [ ! -f ".env.production" ]; then
        echo "⚠️  创建 .env.production 文件模板..."
        cat > .env.production << EOF
# Google Maps 配置 (必填)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
NEXT_PUBLIC_GOOGLE_MAP_ID=your_google_map_id_here

# API 配置
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# 生产环境配置
NODE_ENV=production
EOF
        echo "❗ 请编辑 .env.production 文件，填入真实的 API 密钥"
        echo "❗ 填写完成后重新运行此脚本"
        exit 1
    fi
    
    # 安装依赖
    echo "📦 安装前端依赖..."
    pnpm install
    
    # 构建生产版本
    echo "🔨 构建前端..."
    pnpm build
    
    echo "✅ 前端构建完成"
}

# 部署后端
deploy_backend() {
    echo "⚙️  部署后端..."
    
    cd backend
    
    # 检查环境变量
    if [ ! -f ".env" ]; then
        echo "⚠️  创建后端 .env 文件模板..."
        cat > .env << EOF
# 数据库配置 (根据实际情况修改)
DATABASE_URL=sqlite:///./customer_directory.db

# Google Maps API (与前端保持一致)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# 安全配置
SECRET_KEY=your-super-secret-key-here
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# FastAPI配置
PORT=8000
HOST=0.0.0.0
EOF
        echo "❗ 请编辑 backend/.env 文件，填入真实配置"
        echo "❗ 填写完成后重新运行此脚本"
        exit 1
    fi
    
    # 创建虚拟环境
    if [ ! -d "venv" ]; then
        echo "🐍 创建 Python 虚拟环境..."
        python3 -m venv venv
    fi
    
    # 激活虚拟环境并安装依赖
    echo "📦 安装后端依赖..."
    source venv/bin/activate
    pip install -r requirements.txt
    pip install gunicorn
    
    cd ..
    echo "✅ 后端准备完成"
}

# 启动服务
start_services() {
    echo "🚀 启动服务..."
    
    # 检查 PM2
    if ! command -v pm2 &> /dev/null; then
        echo "📦 安装 PM2..."
        npm install -g pm2
    fi
    
    # 启动后端
    echo "⚙️  启动后端服务..."
    cd backend
    source venv/bin/activate
    pm2 start "gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000" --name "customer-map-backend"
    cd ..
    
    # 启动前端
    echo "🎨 启动前端服务..."
    pm2 start "pnpm start" --name "customer-map-frontend"
    
    # 保存 PM2 配置
    pm2 save
    
    echo "✅ 服务启动完成"
    echo ""
    echo "🎉 部署成功！"
    echo "📍 前端地址: http://localhost:3000"
    echo "📍 后端地址: http://localhost:8000"
    echo ""
    echo "📊 查看服务状态: pm2 status"
    echo "📝 查看日志: pm2 logs"
    echo "🔄 重启服务: pm2 restart all"
    echo "🛑 停止服务: pm2 stop all"
}

# 主函数
main() {
    check_requirements
    deploy_frontend
    deploy_backend
    start_services
}

# 运行部署
main
