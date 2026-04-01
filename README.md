# Pet Memorial API

宠物纪念品独立站后端 API

## 技术栈
- Node.js + Express
- PostgreSQL (Neon)
- Cloudinary (图片存储)

## API 端点

### 用户系统
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 产品管理
- `GET /api/products` - 获取产品列表
- `GET /api/products/:id` - 获取产品详情
- `POST /api/products` - 创建产品 (需认证)
- `PUT /api/products/:id` - 更新产品 (需认证)
- `DELETE /api/products/:id` - 删除产品 (需认证)

### 订单管理
- `POST /api/orders` - 创建订单
- `GET /api/orders` - 获取用户订单列表
- `GET /api/orders/:id` - 获取订单详情

## 环境变量
```
DATABASE_URL=postgresql://...
CLOUDINARY_URL=cloudinary://...
JWT_SECRET=your-secret-key
```
