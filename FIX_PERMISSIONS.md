# 🛠️ 立即修复Ubuntu服务器权限问题

## ❗ **权限错误解决方案**

你遇到的是典型的目录权限问题，以下是立即修复方法：

### 🚀 **方法一：快速修复（推荐）**

在Ubuntu服务器上执行：

```bash
# 1. 修复项目目录权限
sudo chown -R ubuntu:ubuntu /projectRoot/customer-map
chmod -R 755 /projectRoot/customer-map

# 2. 清理之前失败的安装
cd /projectRoot/customer-map
rm -rf node_modules
rm -rf backend/venv
rm -rf backend/__pycache__
rm -f package-lock.json

# 3. 确保使用正确环境
nvm use 22
node --version  # 确认v22.19.0

# 4. 重新运行部署脚本（已优化）
git pull origin main  # 获取最新脚本
./ubuntu_deploy.sh
```

### 🔧 **方法二：手动逐步部署**

如果自动脚本仍有问题，手动执行：

#### **前端部署：**
```bash
cd /projectRoot/customer-map

# 确保权限正确
sudo chown -R ubuntu:ubuntu .

# 安装pnpm (如果需要)
npm install -g pnpm

# 安装依赖
pnpm install

# 创建环境变量文件
cat > .env.production << 'EOF'
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=你的API密钥
NEXT_PUBLIC_GOOGLE_MAP_ID=你的MAP_ID
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NODE_ENV=production
EOF

# 编辑配置
nano .env.production

# 构建应用
pnpm build
```

#### **后端部署：**
```bash
cd backend

# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
pip install --upgrade pip
pip install -r requirements.txt

# 复制生产配置（从GitHub已有的文件）
# config_prod.py 应该已存在，如果没有：
cp ../backend/config_prod.py .
cp ../backend/start_prod.py .

# 测试配置
python3 -c "from config_prod import settings; print('✅ 配置正常')"
```

#### **启动服务：**
```bash
# 安装PM2 (如果需要)
npm install -g pm2

# 启动后端
cd /projectRoot/customer-map/backend
source venv/bin/activate
pm2 start start_prod.py --name "customer-map-backend" --interpreter python3

# 启动前端
cd /projectRoot/customer-map
pm2 start "pnpm start" --name "customer-map-frontend"

# 保存配置
pm2 save
pm2 startup
```

### 🔍 **如果还有问题**

#### **检查权限：**
```bash
# 检查目录权限
ls -la /projectRoot/
ls -la /projectRoot/customer-map/

# 检查用户
whoami
id
```

#### **检查磁盘空间：**
```bash
df -h
du -sh /projectRoot/customer-map/
```

#### **检查Node.js路径：**
```bash
which node
which npm  
which pnpm
```

### 🎯 **完成后验证**

```bash
# 检查服务状态
pm2 status

# 查看日志
pm2 logs

# 测试前端
curl http://localhost:3000

# 测试后端
curl http://localhost:8000/health
```

## 💡 **权限问题的根本原因**

通常是因为：
1. `/projectRoot` 目录是root创建的
2. 用户没有写入权限
3. npm/pnpm缓存权限问题

修复权限后，重新运行脚本应该就能成功！🚀

马上试试第一种方法，应该能立即解决问题！
