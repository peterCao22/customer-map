# 🚀 Ubuntu服务器快速部署 - 适配你的环境

## 当前状态确认
✅ Ubuntu服务器已准备  
✅ nvm已安装  
✅ Node.js v22.19.0 已安装  
✅ 项目代码已推送到GitHub  

## 🎯 现在开始部署（5分钟完成）

### 1. 在Ubuntu服务器上克隆项目
```bash
# 确保在项目目录（你已经在 /projectRoot）
cd /projectRoot

# 克隆最新代码（包含Ubuntu部署配置）
git clone https://github.com/peterCao22/customer-map.git
cd customer-map

# 确保使用Node.js 22
nvm use 22
node --version  # 应该显示 v22.19.0
```

### 2. 运行自动部署脚本
```bash
# 给脚本执行权限
chmod +x ubuntu_deploy.sh

# 运行部署（脚本已适配你的Node.js v22环境）
./ubuntu_deploy.sh
```

## 📝 **脚本会自动处理**

脚本已优化，会：
- ✅ 检测你的Node.js v22.19.0（跳过Node.js安装）
- ✅ 自动安装pnpm
- ✅ 自动安装Python 3.11和PM2
- ✅ 保持你的MySQL数据库配置
- ✅ 创建生产环境配置
- ✅ 配置防火墙和进程管理

## 🔑 **第一次运行时的提示**

脚本会在第一次运行时停止并提示：

```
❗ 请编辑 .env.production 文件，填入真实的 Google Maps API 密钥
❗ 完成后重新运行此脚本
```

这时你需要：
```bash
# 编辑配置文件
nano .env.production
```

填入你的Google Maps配置：
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=你的真实API密钥
NEXT_PUBLIC_GOOGLE_MAP_ID=你的真实MAP_ID
NEXT_PUBLIC_API_BASE_URL=http://你的服务器IP:8000
NODE_ENV=production
```

保存后重新运行：
```bash
./ubuntu_deploy.sh
```

## 🎉 **部署完成后**

访问你的应用：
- **前端**: `http://你的服务器IP:3000`
- **后端API**: `http://你的服务器IP:8000/docs`

查看服务状态：
```bash
pm2 status
pm2 logs
```

## 🔧 **如果遇到问题**

1. **pnpm安装失败**：
   ```bash
   npm install -g pnpm
   ```

2. **权限问题**：
   ```bash
   sudo chown -R $USER:$USER /projectRoot/customer-map
   ```

3. **端口被占用**：
   ```bash
   # 查看端口占用
   netstat -tlnp | grep :3000
   netstat -tlnp | grep :8000
   
   # 如需要，修改backend/config_prod.py中的端口
   ```

4. **防火墙问题**：
   ```bash
   # 检查防火墙状态
   sudo ufw status
   
   # 手动开放端口
   sudo ufw allow 3000
   sudo ufw allow 8000
   ```

现在你可以直接在Ubuntu服务器上开始部署了！有任何问题随时告诉我 🚀
