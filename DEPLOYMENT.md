# 生产环境部署指南

## 📋 部署前准备

### 1. 确保所有代码已提交
```bash
git add .
git commit -m "准备生产部署"
git push origin main
```

### 2. 环境变量配置

创建生产环境变量文件：

**前端环境变量 (`.env.production`)**
```env
# Google Maps 配置
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=你的真实Google_Maps_API密钥
NEXT_PUBLIC_GOOGLE_MAP_ID=你的真实Google_Map_ID

# API 配置
NEXT_PUBLIC_API_BASE_URL=https://你的后端域名.com

# 其他生产配置
NODE_ENV=production
```

**后端环境变量 (`.env`)**
```env
# 数据库配置
DATABASE_URL=你的生产数据库连接串

# Google Maps API
GOOGLE_MAPS_API_KEY=你的Google_Maps_API密钥

# 安全配置
SECRET_KEY=你的安全密钥
ALLOWED_ORIGINS=https://你的前端域名.com

# FastAPI配置
PORT=8000
HOST=0.0.0.0
```

## 🎯 前端部署 (Next.js)

### 方案一：Vercel 部署 (推荐)

1. **安装 Vercel CLI**
```bash
npm install -g vercel
```

2. **登录并部署**
```bash
vercel login
vercel --prod
```

3. **配置环境变量**
在 Vercel Dashboard 中设置：
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAP_ID`
- `NEXT_PUBLIC_API_BASE_URL`

### 方案二：自托管部署

1. **构建生产版本**
```bash
pnpm install
pnpm build
```

2. **启动生产服务器**
```bash
pnpm start
```

3. **使用 PM2 进程管理 (推荐)**
```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start "pnpm start" --name "customer-map-frontend"

# 设置开机自启
pm2 startup
pm2 save
```

### 方案三：Docker 部署

**创建 Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json pnpm-lock.yaml ./

# 安装 pnpm 和依赖
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["pnpm", "start"]
```

**构建和运行:**
```bash
docker build -t customer-map-frontend .
docker run -p 3000:3000 --env-file .env.production customer-map-frontend
```

## 🔧 后端部署 (FastAPI)

### 方案一：传统服务器部署

1. **安装依赖**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **配置生产环境**
```bash
# 安装额外的生产依赖
pip install gunicorn
```

3. **启动生产服务器**
```bash
# 使用 Gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# 或使用 Uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

4. **使用 PM2 管理 (推荐)**
```bash
pm2 start "gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000" --name "customer-map-backend"
```

### 方案二：Docker 部署

**创建后端 Dockerfile (backend/Dockerfile):**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动应用
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

**构建和运行:**
```bash
cd backend
docker build -t customer-map-backend .
docker run -p 8000:8000 --env-file .env customer-map-backend
```

## 🚀 云平台部署

### Vercel + Railway 组合 (推荐)

**前端 → Vercel:**
- 自动 CI/CD
- 全球 CDN
- 无服务器架构

**后端 → Railway:**
```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录并部署
railway login
railway link
railway up
```

### AWS 部署

**前端 → AWS Amplify**
**后端 → AWS ECS/Lambda**

### 阿里云/腾讯云部署

**使用云服务器 + Nginx 反向代理**

## 📊 Nginx 配置 (反向代理)

**创建 /etc/nginx/sites-available/customer-map:**
```nginx
server {
    listen 80;
    server_name 你的域名.com;

    # 前端静态文件
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔒 SSL 证书配置

**使用 Let's Encrypt:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名.com
```

## 📈 性能优化

### 前端优化
1. **启用 Gzip 压缩**
2. **配置 CDN**
3. **优化图片和静态资源**
4. **启用缓存策略**

### 后端优化
1. **数据库连接池**
2. **Redis 缓存**
3. **API 响应缓存**
4. **日志配置**

## 🔍 监控和日志

### 应用监控
```bash
# PM2 监控
pm2 monit

# 查看日志
pm2 logs customer-map-frontend
pm2 logs customer-map-backend
```

### 健康检查
**添加健康检查端点:**
```python
# backend/main.py
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}
```

## ✅ 部署验证清单

- [ ] 环境变量正确配置
- [ ] Google Maps API 正常工作
- [ ] 数据库连接成功
- [ ] 前后端通信正常
- [ ] SSL 证书配置
- [ ] 域名解析正确
- [ ] 性能测试通过
- [ ] 监控和日志配置

## 🆘 故障排查

### 常见问题
1. **Google Maps 不显示** → 检查 API 密钥和域名限制
2. **API 请求失败** → 检查 CORS 配置
3. **静态文件 404** → 检查 Nginx 配置
4. **数据库连接失败** → 检查数据库配置和网络

### 调试命令
```bash
# 检查端口占用
netstat -tlnp | grep :3000
netstat -tlnp | grep :8000

# 检查进程状态
ps aux | grep node
ps aux | grep python

# 检查日志
tail -f /var/log/nginx/error.log
```

---

**需要具体帮助？**
请根据你选择的部署方案，我可以提供更详细的操作指导！
