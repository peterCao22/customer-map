# 客户地址管理系统后端API

基于FastAPI开发的客户地址管理系统后端服务，提供客户信息管理和地址地理编码功能。

## 功能特性

- 🚀 基于FastAPI的高性能异步API
- 📍 集成Google Maps地理编码服务
- 🗄️ SQLAlchemy ORM数据库操作
- 🔍 支持客户搜索和标签过滤
- 📄 自动生成API文档
- 🌐 CORS跨域支持

## 快速开始

### 1. 安装依赖

\`\`\`bash
cd backend
pip install -r requirements.txt
\`\`\`

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并配置：

\`\`\`bash
cp .env.example .env
\`\`\`

编辑 `.env` 文件，设置您的Google Maps API密钥：

\`\`\`env
GOOGLE_MAPS_API_KEY=your_actual_api_key_here
\`\`\`

### 3. 启动服务

\`\`\`bash
python main.py
\`\`\`

或使用uvicorn：

\`\`\`bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
\`\`\`

### 4. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API端点

### 客户管理
- `GET /api/customers` - 获取客户列表（支持分页和搜索）
- `POST /api/customers` - 创建新客户
- `GET /api/customers/{id}` - 获取单个客户信息
- `PUT /api/customers/{id}` - 更新客户信息
- `DELETE /api/customers/{id}` - 删除客户

### 搜索和过滤
- `GET /api/customers/search` - 搜索客户（支持关键词、标签、公司过滤）

## 数据模型

### 客户信息
\`\`\`json
{
  "id": "uuid",
  "name": "客户姓名",
  "email": "email@example.com",
  "phone": "13800138000",
  "address": "详细地址",
  "lat": 23.1291,
  "lng": 113.2644,
  "company": "公司名称",
  "tags": ["VIP客户", "长期合作"],
  "sales_radius": 20,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
\`\`\`

## 开发说明

### 项目结构
\`\`\`
backend/
├── main.py              # FastAPI应用入口
├── config.py            # 配置管理
├── models.py            # Pydantic数据模型
├── database.py          # 数据库连接和ORM模型
├── services/            # 业务服务层
│   └── geocoding_service.py  # 地理编码服务
├── requirements.txt     # 依赖包列表
├── .env.example        # 环境变量示例
└── README.md           # 项目说明
\`\`\`

### 地理编码功能
系统会自动调用Google Maps Geocoding API将客户地址转换为经纬度坐标，用于前端地图显示。

### 数据库
默认使用SQLite数据库，生产环境建议使用PostgreSQL或MySQL。
