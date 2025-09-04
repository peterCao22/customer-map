# Ubuntu 服务器快速部署指南

## 🎯 适用场景
- Ubuntu 服务器
- 自托管部署
- config.py 配置方式
- 单服务器部署前后端

## ⚡ 快速开始（3分钟部署）

### 1. 准备工作
```bash
# SSH连接到你的Ubuntu服务器
ssh username@your-server-ip

# 克隆项目（如果还没有的话）
git clone https://github.com/peterCao22/customer-map.git
cd customer-map
```

### 2. 一键部署
```bash
# 给脚本执行权限
chmod +x ubuntu_deploy.sh

# 运行部署脚本
./ubuntu_deploy.sh
```

**第一次运行会提示配置Google Maps API：**
1. 脚本会创建 `.env.production` 模板文件
2. 你需要填入真实的 Google Maps API 密钥
3. 重新运行脚本即可

### 3. 配置 Google Maps API
```bash
# 编辑前端环境变量
nano .env.production
```

填入你的真实配置：
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=你的Google_Maps_API密钥
NEXT_PUBLIC_GOOGLE_MAP_ID=你的Google_Map_ID
NEXT_PUBLIC_API_BASE_URL=http://你的服务器IP:8000
NODE_ENV=production
```

### 4. 重启服务
```bash
pm2 restart all
```

## 🎉 完成！

访问你的应用：
- **前端**: `http://你的服务器IP:3000`
- **后端**: `http://你的服务器IP:8000`

## 📊 管理命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs

# 重启服务
pm2 restart all

# 停止服务
pm2 stop all

# 实时监控
pm2 monit
```

## 🔧 手动配置（如果自动脚本有问题）

### 后端配置
你的后端配置在 `backend/config_prod.py`，主要配置：

```python
class Settings(BaseSettings):
    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    
    # 你的数据库配置（已保留）
    DATABASE_URL: str = "mysql+pymysql://root:wonder%402025@192.168.8.40:3306/structured"
    
    # Google Maps API
    GOOGLE_MAPS_API_KEY: str = "你的API密钥"
    
    # CORS配置（允许前端访问）
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://你的服务器IP:3000",
        "*"
    ]
```

### 手动启动服务

**后端：**
```bash
cd backend
source venv/bin/activate
python start_prod.py
```

**前端：**
```bash
pnpm build
pnpm start
```

## 🚨 故障排查

### 常见问题

**1. 端口被占用**
```bash
# 查看端口占用
netstat -tlnp | grep :3000
netstat -tlnp | grep :8000

# 杀死占用进程
sudo kill -9 PID
```

**2. 防火墙阻挡**
```bash
# 检查防火墙
sudo ufw status

# 开放端口
sudo ufw allow 3000
sudo ufw allow 8000
```

**3. Google Maps不显示**
- 检查API密钥是否正确
- 检查域名/IP是否在API限制中
- 检查浏览器控制台错误

**4. 后端连不上**
```bash
# 测试后端
curl http://localhost:8000/health

# 查看后端日志
pm2 logs customer-map-backend
```

**5. 数据库连接失败**
- 检查MySQL服务是否运行
- 检查IP 192.168.8.40:3306 是否可访问
- 检查用户名密码是否正确

## 🔄 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新构建前端
pnpm build

# 重启服务
pm2 restart all
```

## 📱 移动端访问

确保防火墙允许外部访问，然后可以通过手机浏览器访问：
`http://你的服务器IP:3000`

## 🔒 安全建议

1. **修改默认端口**（可选）
2. **配置SSL证书**（如果有域名）
3. **限制CORS域名**（生产环境）
4. **定期备份数据库**
5. **监控服务状态**

需要帮助？随时问我！ 🚀
