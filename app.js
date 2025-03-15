const express = require('express');
const app = express();
const port = 3000;

// 中间件设置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static('public'));

// 路由
app.get('/', (req, res) => {
  res.send('欢迎来到 Express 应用！');
});

// API 示例
app.get('/api/hello', (req, res) => {
  res.json({ message: '你好，世界！' });
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}); 