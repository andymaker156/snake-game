# 简单的 Express 应用

这是一个基础的 Express.js 应用程序。

## 功能特点

- Express 服务器设置
- 基本路由示例
- JSON 和 URL 编码的请求处理
- 静态文件服务

## 安装

确保你已经安装了 Node.js，然后运行：

```bash
npm install
```

## 运行应用

开发模式（使用 nodemon）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

## API 端点

- `GET /`: 显示欢迎信息
- `GET /api/hello`: 返回 JSON 格式的问候消息

## 目录结构

```
.
├── app.js          # 主应用文件
├── package.json    # 项目配置和依赖
├── public/         # 静态文件目录
└── README.md       # 项目文档
``` 