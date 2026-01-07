
# 部署说明 / Deployment Guide

本应用已配置好生产环境打包与 Docker 部署方案。

## 1. 使用 Docker 部署 (推荐)

这是最简单的方法，只需在您的云服务器上运行：

```bash
# 构建镜像
docker build -t manju-ai-director .

# 运行容器 (请替换 YOUR_API_KEY)
docker run -d -p 80:80 -e API_KEY=YOUR_API_KEY manju-ai-director
```

## 2. 手动构建部署

如果您想使用传统的 Nginx 或静态托管服务：

```bash
# 安装依赖
npm install

# 构建项目 (API_KEY 可以在构建时注入)
API_KEY=your_key_here npm run build

# 部署
# 将生成的 'dist' 文件夹上传到您的 Web 服务器即可
```

## 环境变量说明

- `API_KEY`: 您的 Google Gemini API Key 或 OpenAI 兼容 API Key。
