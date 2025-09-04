# 客户地址管理系统

基于 Google Maps API 的客户地址标注和管理系统，支持地图可视化、搜索过滤和客户信息管理。

## 项目概述

这是一个使用 Next.js 14 (App Router) 和 TypeScript 构建的现代化客户地址管理应用。系统集成了 Google Maps JavaScript API，提供直观的地图界面来展示和管理客户地址信息。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS v4 + shadcn/ui
- **地图**: Google Maps JavaScript API
- **字体**: Geist Sans & Geist Mono
- **图标**: Lucide React

## 项目结构

\`\`\`
├── backend/          #python 后端代码
├── app/
│   ├── layout.tsx          # 根布局组件
│   ├── page.tsx            # 主页面
│   └── globals.css         # 全局样式
├── components/
│   ├── customer-map-view.tsx    # 主视图组件
│   ├── google-map.tsx           # Google Maps 组件
│   ├── customer-search.tsx      # 搜索过滤组件
│   ├── customer-list.tsx        # 客户列表组件
│   └── ui/                      # shadcn/ui 组件库
├── docs/
│   └── README.md               # 项目文档
├── hooks/
│   ├── use-mobile.tsx          # 移动端检测
│   └── use-toast.ts            # Toast 通知
├── lib/
│   └── utils.ts                # 工具函数
└── types/
    └── customer.ts             # 类型定义
\`\`\`

## 核心组件

### 1. CustomerMapView (主视图组件)
- **文件**: `components/customer-map-view.tsx`
- **功能**: 
  - 管理客户数据状态
  - 处理搜索和过滤逻辑
  - 协调地图和侧边栏交互
  - 响应式布局控制

### 2. GoogleMap (地图组件)
- **文件**: `components/google-map.tsx`
- **功能**:
  - 集成 Google Maps JavaScript API
  - 渲染客户地址标记
  - 显示信息窗口
  - 自动调整地图视图范围

### 3. CustomerSearch (搜索组件)
- **文件**: `components/customer-search.tsx`
- **功能**:
  - 实时搜索客户信息
  - 标签过滤功能
  - 搜索条件管理

### 4. CustomerList (客户列表组件)
- **文件**: `components/customer-list.tsx`
- **功能**:
  - 显示过滤后的客户列表
  - 客户选择和高亮
  - 客户详细信息展示

## 数据结构

### Customer 接口
\`\`\`typescript
interface Customer {
  id: string           // 客户唯一标识
  name: string         // 客户姓名
  email: string        // 邮箱地址
  phone: string        // 电话号码
  address: string      // 详细地址
  lat: number          // 纬度
  lng: number          // 经度
  company?: string     // 公司名称（可选）
  tags: string[]       // 标签数组
  createdAt: Date      // 创建时间
}
\`\`\`

## 主要功能

### 🗺️ 地图可视化
- 在 Google Maps 上显示所有客户地址标记
- 点击标记显示客户详细信息
- 自动调整地图视图包含所有标记
- 支持地图缩放和拖拽操作

### 🔍 搜索过滤
- **文本搜索**: 支持按姓名、邮箱、公司、地址搜索
- **标签过滤**: 支持多标签组合过滤
- **实时更新**: 搜索结果实时反映在地图和列表中

### 📱 响应式设计
- 移动端友好的响应式布局
- 可折叠的侧边栏设计
- 触摸友好的交互元素

### 🎨 现代化UI
- 基于 shadcn/ui 的组件系统
- 支持明暗主题切换
- 一致的设计语言和交互体验

## 环境配置

### 必需的环境变量
\`\`\`env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
\`\`\`

### Google Maps API 配置
1. 在 Google Cloud Console 创建项目
2. 启用 Maps JavaScript API
3. 创建 API 密钥并设置限制：
   - **应用程序限制**: HTTP 引用站点
   - **API 限制**: Maps JavaScript API
   - **域名限制**: 添加您的域名

## 如何运行

### 前置要求
- Node.js 18.0 或更高版本
- npm 或 yarn 包管理器
- Google Maps API 密钥

### 安装步骤

1. **克隆项目**
   \`\`\`bash
   git clone <repository-url>
   cd customer-address-map
   \`\`\`

2. **安装依赖**
   \`\`\`bash
   npm install
   # 或
   yarn install
   \`\`\`

3. **配置环境变量**
   
   在项目根目录创建 `.env.local` 文件：
   \`\`\`env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   \`\`\`
   
   或在 Vercel 项目设置中添加环境变量。

4. **启动开发服务器**
   \`\`\`bash
   npm run dev
   # 或
   yarn dev
   \`\`\`

5. **访问应用**
   
   打开浏览器访问 [http://localhost:3000](http://localhost:3000)

### 构建和部署

#### 本地构建
\`\`\`bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
\`\`\`

#### 部署到 Vercel
1. 将代码推送到 GitHub 仓库
2. 在 Vercel 中导入项目
3. 在项目设置中添加环境变量 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
4. 部署完成后即可访问

#### 部署到其他平台
- **Netlify**: 支持 Next.js 静态导出
- **Docker**: 可使用 Next.js 官方 Docker 镜像
- **传统服务器**: 需要 Node.js 运行环境

### 开发模式功能
- 热重载 (Hot Reload)
- TypeScript 类型检查
- ESLint 代码检查
- 自动格式化

### 故障排除

#### 常见问题
1. **地图不显示**
   - 检查 Google Maps API 密钥是否正确
   - 确认 API 密钥已启用 Maps JavaScript API
   - 检查域名限制设置

2. **环境变量不生效**
   - 确保变量名以 `NEXT_PUBLIC_` 开头
   - 重启开发服务器
   - 检查 `.env.local` 文件位置

3. **构建失败**
   - 清除缓存：`rm -rf .next`
   - 重新安装依赖：`rm -rf node_modules && npm install`
   - 检查 TypeScript 类型错误

4. **依赖安装错误 (ERESOLVE)**
   - 如果遇到 React 版本冲突，使用：`npm install --legacy-peer-deps`
   - 或者删除 `package-lock.json` 后重新安装：`rm package-lock.json && npm install`
   - 确保所有依赖都支持当前 React 版本

#### 调试技巧
- 使用浏览器开发者工具查看控制台错误
- 检查网络请求是否成功
- 使用 React Developer Tools 调试组件状态

## 使用说明

### 基本操作
1. **查看客户**: 系统默认显示所有客户的地址标记
2. **搜索客户**: 在搜索框中输入关键词进行实时搜索
3. **标签过滤**: 点击标签按钮进行分类过滤
4. **选择客户**: 点击列表中的客户或地图标记查看详情
5. **切换视图**: 使用侧边栏切换按钮控制显示

### 搜索功能
- 支持中文和英文搜索
- 搜索范围包括：姓名、邮箱、公司名称、地址
- 支持部分匹配和模糊搜索
- 搜索结果实时更新

### 过滤功能
- 多标签组合过滤
- 标签状态可视化显示
- 过滤结果统计显示

## 扩展功能建议
1. **后端集成**: 连接真实数据库和 API
2. **CRUD 操作**: 添加客户增删改功能
3. **地理编码**: 自动将地址转换为坐标
4. **导入导出**: 支持 Excel/CSV 数据导入导出
5. **统计分析**: 添加客户分布统计图表

## 性能优化

- 使用 React.memo 优化组件渲染
- 实现虚拟滚动处理大量客户数据
- Google Maps API 按需加载
- 图片和资源懒加载

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 许可证

MIT License


## 后端代码开发说明
Thought for 2sThought for 0s对于Python后端开发，我有以下建议：

## 后端架构建议

**1. 技术栈选择**

- **FastAPI** 或 **Flask**：推荐FastAPI，自动生成API文档，类型检查
- **数据库**：PostgreSQL（支持地理数据）或 MySQL
- **ORM**：SQLAlchemy 或 Tortoise ORM


**2. 经纬度获取方案**
是的，`lat`和`lng`需要调用Google Maps Geocoding API获取：

```python
# 地址 -> 坐标转换
import googlemaps

def get_coordinates(address):
    gmaps = googlemaps.Client(key='YOUR_API_KEY')
    geocode_result = gmaps.geocode(address)
    if geocode_result:
        location = geocode_result[0]['geometry']['location']
        return location['lat'], location['lng']
    return None, None
```

**3. API设计建议**

```python
# 客户数据API端点
GET /api/customers          # 获取所有客户
GET /api/customers/{id}     # 获取单个客户
POST /api/customers         # 创建客户（自动获取坐标）
PUT /api/customers/{id}     # 更新客户
DELETE /api/customers/{id}  # 删除客户
GET /api/customers/search   # 搜索和过滤
```

**4. 数据处理流程**

- 客户创建时自动调用Geocoding API获取坐标
- 缓存坐标结果，避免重复调用
- 地址变更时重新获取坐标
- 错误处理：地址无法解析时的备选方案


**5. 与前端集成**

- 保持现有的客户数据结构
- 前端移除模拟数据，改为API调用
- 支持分页、搜索、标签过滤等功能