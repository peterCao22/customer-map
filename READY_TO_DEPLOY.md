# 🎯 你的环境已就绪！立即开始部署

## ✅ **环境确认**
- **服务器**: Ubuntu
- **Node.js**: v22.19.0 (通过nvm管理) ✅
- **Python**: 3.10.12 ✅ 
- **部署方式**: 自托管
- **配置方式**: config.py

## 🚀 **3步完成部署**

### 步骤1：在Ubuntu服务器准备项目
```bash
# 确保使用正确的Node版本
nvm use 22

# 进入项目目录
cd /projectRoot

# 克隆最新代码（包含部署配置）
git clone https://github.com/peterCao22/customer-map.git
cd customer-map
```

### 步骤2：运行自动部署
```bash
# 给脚本执行权限
chmod +x ubuntu_deploy.sh

# 运行部署（已适配你的环境）
./ubuntu_deploy.sh
```

**脚本会自动检测：**
- ✅ Node.js v22.19.0 - 跳过安装
- ✅ Python 3.10.12 - 满足要求
- 📦 自动安装pnpm和PM2

### 步骤3：配置Google Maps API
当脚本提示时，填写API密钥：
```bash
nano .env.production
```

填入：
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=你的API密钥
NEXT_PUBLIC_GOOGLE_MAP_ID=你的MAP_ID
NEXT_PUBLIC_API_BASE_URL=http://你的服务器IP:8000
NODE_ENV=production
```

重新运行：
```bash
./ubuntu_deploy.sh
```

## 🎉 **部署完成！**

访问地址：
- **前端**: `http://你的服务器IP:3000`
- **后端**: `http://你的服务器IP:8000`

## 📊 **管理命令**
```bash
pm2 status      # 查看服务状态
pm2 logs        # 查看日志  
pm2 restart all # 重启服务
```

## 🔧 **你的配置保持不变**

- **数据库**: `mysql+pymysql://root:wonder%402025@192.168.8.40:3306/structured`
- **Python版本**: 使用你现有的3.10.12
- **Node.js版本**: 使用你现有的v22.19.0

完全准备就绪，开始部署吧！🚀
