# 客户地址管理系统 - Windows 快速部署脚本
# 使用方法: powershell -ExecutionPolicy Bypass -File deploy.ps1

Write-Host "🚀 开始部署客户地址管理系统..." -ForegroundColor Green

# 检查必要工具
function Check-Requirements {
    Write-Host "📋 检查部署环境..." -ForegroundColor Yellow
    
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Node.js 未安装，请先安装 Node.js" -ForegroundColor Red
        exit 1
    }
    
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Host "📦 安装 pnpm..." -ForegroundColor Yellow
        npm install -g pnpm
    }
    
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Python 未安装，请先安装 Python" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ 环境检查完成" -ForegroundColor Green
}

# 部署前端
function Deploy-Frontend {
    Write-Host "🎨 部署前端..." -ForegroundColor Cyan
    
    # 检查环境变量
    if (-not (Test-Path ".env.production")) {
        Write-Host "⚠️  创建 .env.production 文件模板..." -ForegroundColor Yellow
        @"
# Google Maps 配置 (必填)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
NEXT_PUBLIC_GOOGLE_MAP_ID=your_google_map_id_here

# API 配置
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# 生产环境配置
NODE_ENV=production
"@ | Out-File -FilePath ".env.production" -Encoding UTF8
        
        Write-Host "❗ 请编辑 .env.production 文件，填入真实的 API 密钥" -ForegroundColor Red
        Write-Host "❗ 填写完成后重新运行此脚本" -ForegroundColor Red
        exit 1
    }
    
    # 安装依赖
    Write-Host "📦 安装前端依赖..." -ForegroundColor Yellow
    pnpm install
    
    # 构建生产版本
    Write-Host "🔨 构建前端..." -ForegroundColor Yellow
    pnpm build
    
    Write-Host "✅ 前端构建完成" -ForegroundColor Green
}

# 部署后端
function Deploy-Backend {
    Write-Host "⚙️  部署后端..." -ForegroundColor Cyan
    
    Set-Location backend
    
    # 检查环境变量
    if (-not (Test-Path ".env")) {
        Write-Host "⚠️  创建后端 .env 文件模板..." -ForegroundColor Yellow
        @"
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
"@ | Out-File -FilePath ".env" -Encoding UTF8
        
        Write-Host "❗ 请编辑 backend\.env 文件，填入真实配置" -ForegroundColor Red
        Write-Host "❗ 填写完成后重新运行此脚本" -ForegroundColor Red
        exit 1
    }
    
    # 创建虚拟环境
    if (-not (Test-Path "venv")) {
        Write-Host "🐍 创建 Python 虚拟环境..." -ForegroundColor Yellow
        python -m venv venv
    }
    
    # 激活虚拟环境并安装依赖
    Write-Host "📦 安装后端依赖..." -ForegroundColor Yellow
    .\venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    pip install gunicorn uvicorn[standard]
    
    Set-Location ..
    Write-Host "✅ 后端准备完成" -ForegroundColor Green
}

# 启动服务
function Start-Services {
    Write-Host "🚀 启动服务..." -ForegroundColor Cyan
    
    # 检查 PM2
    if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
        Write-Host "📦 安装 PM2..." -ForegroundColor Yellow
        npm install -g pm2
        npm install -g pm2-windows-startup
        pm2-startup install
    }
    
    # 启动后端
    Write-Host "⚙️  启动后端服务..." -ForegroundColor Yellow
    Set-Location backend
    .\venv\Scripts\Activate.ps1
    pm2 start --name "customer-map-backend" --interpreter python -- -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
    Set-Location ..
    
    # 启动前端
    Write-Host "🎨 启动前端服务..." -ForegroundColor Yellow
    pm2 start --name "customer-map-frontend" "pnpm start"
    
    # 保存 PM2 配置
    pm2 save
    
    Write-Host ""
    Write-Host "✅ 服务启动完成" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 部署成功！" -ForegroundColor Green
    Write-Host "📍 前端地址: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "📍 后端地址: http://localhost:8000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📊 查看服务状态: pm2 status" -ForegroundColor Yellow
    Write-Host "📝 查看日志: pm2 logs" -ForegroundColor Yellow
    Write-Host "🔄 重启服务: pm2 restart all" -ForegroundColor Yellow
    Write-Host "🛑 停止服务: pm2 stop all" -ForegroundColor Yellow
}

# 主函数
function Main {
    Check-Requirements
    Deploy-Frontend
    Deploy-Backend
    Start-Services
}

# 运行部署
Main
