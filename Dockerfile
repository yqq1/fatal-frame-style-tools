# 1. 使用 Node 运行已构建好的 dist 和笔记 API
FROM node:18-alpine

# 2. 设置容器工作目录
WORKDIR /app

# 3. 复制已构建好的前端产物、API 服务和初始笔记
COPY dist ./dist
COPY server.mjs ./server.mjs
COPY data/notes ./seed-notes

# 4. 创建运行时笔记目录，实际部署时建议挂载 volume
RUN mkdir -p /app/data/notes

# 5. 暴露容器内端口
EXPOSE 3001

# 6. 启动 Node 服务
CMD ["node", "server.mjs"]
