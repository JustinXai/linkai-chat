# Link-AI Chat 部署指南

本文档提供 Link-AI Chat 的部署、更新、回滚操作指南，以及 MongoDB 和 SearXNG 的运维说明。

## 目录

- [首次部署](#首次部署)
- [更新部署](#更新部署)
- [回滚部署](#回滚部署)
- [MongoDB 备份](#mongodb-备份)
- [MongoDB 恢复](#mongodb-恢复)
- [SearXNG 启动](#searxng-启动)
- [Nginx/HTTPS 检查](#nginxhttps-检查)
- [常见故障排查](#常见故障排查)

---

## 首次部署

### 前置要求

- Docker 和 Docker Compose 已安装
- Node.js 18+ (用于本地构建)
- MongoDB 4.4+ (或使用 Docker Compose 部署)
- 域名已配置 DNS 解析

### 部署步骤

#### 1. 克隆项目

```bash
git clone https://github.com/your-repo/linkai-chat.git
cd linkai-chat
```

#### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件
nano .env
```

关键配置项：

```bash
# MongoDB 连接
MONGO_URI=mongodb://localhost:27017/linkai

# 应用配置
APP_TITLE=Link-AI Chat
DOMAIN_CLIENT=http://localhost:3080
DOMAIN_API=http://localhost:3080/api

# 安全密钥
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_ACCESS_SECRET=your-access-secret-key

# AI 模型配置 (根据需要启用)
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

#### 3. 启动服务

使用 Docker Compose 启动所有服务：

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 4. 验证部署

1. 访问 `http://your-domain.com:3080`
2. 检查页面标题显示 "Link-AI"
3. 尝试注册/登录
4. 测试发送消息

---

## 更新部署

### 自动更新

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose up -d --build

# 清理旧镜像 (可选)
docker image prune -f
```

### 使用部署脚本

```bash
# 给脚本添加执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh
```

### 更新特定服务

```bash
# 只更新 API 服务
docker-compose up -d --build api

# 只更新前端
docker-compose up -d --build client
```

---

## 回滚部署

### 查看历史镜像

```bash
# 列出 API 镜像历史
docker images linkai-api --format "{{.ID}} {{.CreatedAt}}"

# 列出 Client 镜像历史
docker images linkai-client --format "{{.ID}} {{.CreatedAt}}"
```

### 回滚到指定版本

```bash
# 回滚 API 服务
docker tag linkai-api:<previous-tag> linkai-api:latest
docker-compose up -d api

# 回滚前端
docker tag linkai-client:<previous-tag> linkai-client:latest
docker-compose up -d client
```

### 使用 Docker 镜像标签

```bash
# 给当前镜像打标签
docker tag linkai-api:latest linkai-api:backup-$(date +%Y%m%d)

# 回滚时使用备份标签
docker tag linkai-api:backup-20240101 linkai-api:latest
docker-compose up -d api
```

### 回滚数据库（谨慎操作）

```bash
# 停止服务
docker-compose down

# 从备份恢复 MongoDB
docker volume ls | grep mongo
docker run --rm -v linkai-chat_mongo-data:/data/db -v $(pwd)/backup:/backup mongo:latest mongorestore --drop --archive=/backup/linkai-$(date +%Y%m%d).archive

# 重启服务
docker-compose up -d
```

---

## MongoDB 备份

### 自动备份脚本

创建 `backup-mongodb.sh`:

```bash
#!/bin/bash
# backup-mongodb.sh

BACKUP_DIR="/opt/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="linkai-mongodb"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 执行备份
docker exec $CONTAINER_NAME mongodump --archive=$BACKUP_DIR/dump-$DATE.archive --gzip

# 删除 7 天前的备份
find $BACKUP_DIR -name "dump-*.archive" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/dump-$DATE.archive"
```

### 设置定时备份 (cron)

```bash
# 编辑 crontab
crontab -e

# 添加每日凌晨 3 点备份
0 3 * * * /opt/scripts/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1
```

### 手动备份

```bash
# 备份到本地文件
docker exec linkai-mongodb mongodump --archive=/dump/backup-$(date +%Y%m%d).archive --gzip
docker cp linkai-mongodb:/dump/backup-$(date +%Y%m%d).archive /opt/backups/

# 备份到远程服务器
docker exec linkai-mongodb mongodump --archive=/dump/backup-$(date +%Y%m%d).archive --gzip
rsync -avz /opt/backups/backup-$(date +%Y%m%d).archive user@remote-server:/backups/
```

### 备份验证

```bash
# 查看备份文件
ls -lh /opt/backups/mongodb/

# 验证备份可恢复 (不覆盖原数据)
docker run --rm -v linkai-chat_mongo-data:/data/db -v $(pwd):/backup mongo:latest mongorestore --dry-run --archive=/backup/dump-20240101.archive --gzip
```

---

## MongoDB 恢复

### 从本地备份恢复

```bash
# 停止应用服务
docker-compose down

# 恢复数据
docker exec -i linkai-mongodb mongorestore --archive=/dump/backup-20240101.archive --gzip --drop

# 重启服务
docker-compose up -d
```

### 从远程备份恢复

```bash
# 下载备份
rsync user@remote-server:/backups/dump-20240101.archive /tmp/

# 恢复数据
docker cp /tmp/dump-20240101.archive linkai-mongodb:/dump/
docker exec linkai-mongodb mongorestore --archive=/dump/dump-20240101.archive --gzip --drop
```

### 恢复单个集合

```bash
# 只恢复 users 集合
docker exec -i linkai-mongodb mongorestore --nsInclude=linkai.users --archive=/dump/backup.archive --gzip --drop
```

### 恢复到指定时间点

```bash
# 使用 oplog 恢复 (需要启用 oplog)
docker exec linkai-mongodb mongorestore --oplogReplay --pointInTimeRecovery --timestamp "2024-01-01T12:00:00"
```

---

## SearXNG 启动

### 启动 SearXNG 服务

```bash
# 进入 SearXNG 目录
cd /opt/searxng

# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 验证 SearXNG

```bash
# 检查健康状态
curl http://localhost:8888/healthz

# 测试搜索
curl "http://localhost:8888/search?q=test&format=json" | jq .

# 检查响应格式
curl -s "http://localhost:8888/search?q=hello&format=json" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"Results: {len(data.get('results', []))}\")"
```

### SearXNG 与 Link-AI 集成

确保 `.env` 中配置正确：

```bash
SEARXNG_ENDPOINT=http://localhost:8888
```

### SearXNG 日志分析

```bash
# 查看错误日志
docker-compose logs searxng | grep -i error

# 实时查看请求日志
docker-compose logs -f --tail=100 searxng
```

---

## Nginx/HTTPS 检查

### 检查 Nginx 配置

```bash
# 测试 Nginx 配置
nginx -t

# 查看配置
cat /etc/nginx/sites-available/linkai
cat /etc/nginx/conf.d/linkai.conf
```

### HTTPS 证书检查

```bash
# 检查证书有效期
openssl x509 -in /etc/ssl/certs/linkai.crt -noout -dates

# 使用 certbot 检查
certbot certificates

# 测试 Let's Encrypt 续期
certbot renew --dry-run
```

### 自动续期设置

```bash
# 检查 cron 任务
crontab -l | grep certbot

# 手动续期
certbot renew
```

### 强制 HTTPS 重定向

```nginx
server {
    listen 80;
    server_name linkai.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name linkai.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/linkai.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/linkai.your-domain.com/privkey.pem;

    # ... 其他配置
}
```

### 常见 Nginx 错误

```bash
# 502 Bad Gateway
# - 检查后端服务是否运行
# - 检查 socket 文件权限
# - 查看 Nginx 错误日志

# 504 Gateway Timeout
# - 增加 proxy_timeout 配置
# - 检查后端服务响应速度

# 413 Request Entity Too Large
# - 增加 client_max_body_size 配置
```

---

## 常见故障排查

### 服务无法启动

```bash
# 1. 检查 Docker 状态
systemctl status docker

# 2. 检查端口占用
netstat -tlnp | grep 3080

# 3. 查看详细日志
docker-compose logs --tail=100

# 4. 检查配置文件
docker-compose config
```

### 数据库连接问题

```bash
# 1. 检查 MongoDB 状态
docker-compose ps mongodb

# 2. 测试 MongoDB 连接
docker exec -it linkai-api mongosh --eval "db.adminCommand('ping')"

# 3. 检查连接日志
docker-compose logs api | grep -i mongo
```

### 前端加载问题

```bash
# 1. 检查前端构建
docker-compose logs client

# 2. 清除缓存重建
docker-compose down
docker system prune -f
docker-compose up -d --build

# 3. 检查静态资源
curl -I http://localhost:3080/assets/index.js
```

### 内存不足

```bash
# 检查内存使用
free -h
docker stats --no-stream

# 增加 Docker 内存限制
# 编辑 /etc/docker/daemon.json
{
  "default-ulimits": {
    "memlock": {
      "Name": "memlock",
      "Soft": -1,
      "Hard": -1
    }
  }
}
```

### 磁盘空间不足

```bash
# 查看磁盘使用
df -h

# 清理 Docker
docker system prune -a
docker volume prune -f

# 清理旧日志
find /var/lib/docker/containers -name "*.log" -exec truncate -s 0 {} \;
```

### 日志分析

```bash
# API 错误日志
docker-compose logs api --tail=500 | grep -E "(ERROR|FATAL|Exception)"

# 认证问题
docker-compose logs api | grep -i "auth\|token\|jwt"

# 数据库慢查询
docker-compose logs mongodb | grep -i "slow\|timeout"
```

### 网络问题

```bash
# 检查容器网络
docker network ls
docker network inspect linkai-chat_default

# 测试服务间连通性
docker exec linkai-api ping mongodb
docker exec linkai-api curl http://localhost:3080/api/config

# DNS 解析
docker exec linkai-api nslookup mongodb
```

### 健康检查

```bash
# 创建健康检查脚本 check-health.sh
#!/bin/bash

echo "=== Docker Containers ==="
docker-compose ps

echo -e "\n=== API Health ==="
curl -s http://localhost:3080/api/health || echo "API: DOWN"

echo -e "\n=== MongoDB ==="
docker exec linkai-mongodb mongosh --eval "db.adminCommand('ping')" 2>/dev/null || echo "MongoDB: DOWN"

echo -e "\n=== Redis ==="
docker exec linkai-redis redis-cli ping 2>/dev/null || echo "Redis: DOWN"

echo -e "\n=== Disk Space ==="
df -h /

echo -e "\n=== Memory ==="
free -h
```

### 紧急恢复

```bash
# 1. 停止所有服务
docker-compose down

# 2. 备份当前数据
docker run --rm -v linkai-chat_mongo-data:/data/db -v $(pwd):/backup mongo:latest tar czf /backup/emergency-backup.tar.gz /data/db

# 3. 清除所有数据卷 (谨慎!)
docker-compose down -v

# 4. 重新创建数据卷
docker-compose up -d

# 5. 从备份恢复
docker run --rm -v linkai-chat_mongo-data:/data/db -v $(pwd):/backup mongo:latest tar xzf /backup/emergency-backup.tar.gz -C /

# 6. 重启服务
docker-compose up -d
```

---

## 联系支持

- 文档问题: 提交 Issue 到 GitHub
- 紧急故障: 联系运维团队
- 监控面板: http://your-monitoring-domain.com

---

*最后更新: 2024年*
