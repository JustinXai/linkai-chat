# SearXNG 配置指南

本文档说明如何为 Link-AI Chat 配置 SearXNG 搜索服务。

## 1. 安装 SearXNG

### Docker 方式（推荐）

```bash
# 创建 SearXNG 目录
mkdir -p /opt/searxng
cd /opt/searxng

# 创建 docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  searxng:
    container_name: searxng
    image: searxng/searxng:latest
    restart: unless-stopped
    ports:
      - "8888:8080"
    volumes:
      - ./searxng:/etc/searxng:rw
    environment:
      - SEARXNG_BASE_URL=http://localhost:8888/
      - SEARXNG_SECRET=your-secret-key-here
    cap_add:
      - SYS_ADMIN
    network_mode: bridge
```

### 系统安装

```bash
# Ubuntu/Debian
sudo add-apt-repository ppa:searxng/stable
sudo apt update
sudo apt install searxng

# 配置并启动
sudo systemctl edit searxng
sudo systemctl enable searxng
sudo systemctl start searxng
```

## 2. 配置 settings.yml

SearXNG 配置文件位于 `searxng/settings.yml`。以下是 Link-AI 所需的配置：

### 基础配置

```yaml
# searxng/settings.yml

use_default_settings: true

general:
  debug: false
  instance_name: "Link-AI Search"
  privacypolicy_url: false
  donation_url: false
  contact_url: false
  enable_metrics: false

search:
  # 必须启用 json format，否则 Link-AI 无法解析搜索结果
  formats:
    - html
    - json

server:
  secret_key: "your-secret-key-change-this"
  bind_address: "0.0.0.0"
  port: 8080
  limiter: false
  public_instance: false

ui:
  static_use_hash: true
  default_theme: simple
  results_on_new_tab: false

outgoing:
  request_timeout: 10.0
  max_request_timeout: 30.0
  useragent_suffix: ""
  pool_connections: 100
  pool_maxsize: 20

engines:
  - name: google
    engine: google
    shortcut: g
    disabled: false

  - name: bing
    engine: bing
    shortcut: b
    disabled: false

  - name: duckduckgo
    engine: duckduckgo
    shortcut: ddg
    disabled: false

  - name: wikipedia
    engine: wikipedia
    shortcut: w
    disabled: false

  - name: github
    engine: github
    shortcut: gh
    disabled: false

  - name: youtube
    engine: youtube
    shortcut: yt
    disabled: false
```

### 关键配置说明

**必须启用 JSON 格式**：

```yaml
search:
  formats:
    - html
    - json  # 必须包含此选项
```

这是 Link-AI 与 SearXNG 通信的必要条件，否则无法获取结构化搜索结果。

### 禁用不必要的引擎（可选）

为提高性能，可以禁用不需要的搜索引擎：

```yaml
engines:
  - name: google images
    engine: google_images
    shortcut: gi
    disabled: true  # 禁用图片搜索
```

## 3. 验证配置

### 使用 curl 测试

```bash
# 测试 JSON 格式搜索
curl -X GET "http://localhost:8888/search?q=test&format=json" \
  -H "Accept: application/json"

# 预期返回 JSON 格式结果
```

### 预期返回格式

```json
{
  "query": "test",
  "results": [
    {
      "title": "Example Result",
      "url": "https://example.com",
      "content": "Result description...",
      "engine": "google",
      "template": "default.html"
    }
  ],
  "number_of_results": 10,
  "infoboxes": [],
  "suggestions": [],
  "answers": []
}
```

### 测试 SearXNG UI

1. 打开浏览器访问 `http://localhost:8888`
2. 进行一次搜索测试
3. 确认搜索结果正常显示

## 4. 配置 Link-AI

在 Link-AI 的环境变量或配置文件中设置 SearXNG 地址：

```bash
# .env 文件
SEARXNG_ENDPOINT=http://localhost:8888
```

或在 `librechat.yaml` 中配置：

```yaml
search:
  SearXNG:
    endpoint: "http://localhost:8888"
```

## 5. Docker 部署完整示例

```yaml
# docker-compose.yml
version: '3.8'

services:
  searxng:
    container_name: searxng
    image: searxng/searxng:latest
    restart: unless-stopped
    ports:
      - "8888:8080"
    volumes:
      - ./searxng:/etc/searxng:rw
      - ./searxng/searxng:/usr/local/searxng/searxng:rw
    environment:
      - SEARXNG_BASE_URL=http://localhost:8888/
      - SEARXNG_SECRET=change-this-secret-key-in-production
    cap_add:
      - SYS_ADMIN
    network_mode: bridge
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 6. Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name search.your-domain.com;

    location / {
        proxy_pass http://localhost:8888;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 增大超时时间
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## 常见问题排查

### 1. 搜索结果为空

**问题**: 返回的 JSON 中 results 数组为空

**解决方案**:
- 检查 `search.formats` 是否包含 `json`
- 检查搜索引擎是否被禁用
- 查看 SearXNG 日志: `docker logs searxng`

### 2. 连接被拒绝

**问题**: `Connection refused` 或 `ECONNREFUSED`

**解决方案**:
- 确认 SearXNG 服务正在运行: `docker ps | grep searxng`
- 检查端口映射: `netstat -tlnp | grep 8888`
- 重启服务: `docker-compose restart`

### 3. CORS 错误

**问题**: 浏览器控制台显示 CORS 相关错误

**解决方案**:
- 确保 Link-AI 和 SearXNG 使用相同的域名
- 或在 SearXNG 配置中启用跨域支持

### 4. 搜索超时

**问题**: 搜索请求超时

**解决方案**:
- 增加 `outgoing.request_timeout` 值
- 禁用不需要的搜索引擎以减少请求数量
- 检查网络连接

### 5. JSON 解析错误

**问题**: Link-AI 无法解析 SearXNG 返回的数据

**解决方案**:
- 确认 URL 中包含 `format=json` 参数
- 检查 `search.formats` 配置包含 `json`
- 测试直接访问 SearXNG API

### 调试命令

```bash
# 查看 SearXNG 容器日志
docker logs -f searxng

# 检查 SearXNG 健康状态
curl http://localhost:8888/healthz

# 测试搜索 API
curl "http://localhost:8888/search?q=test&format=json&engines=google"

# 重启 SearXNG
docker-compose restart searxng
```

## 安全建议

1. **修改默认密钥**: 务必更改 `server.secret_key` 为随机字符串
2. **限制访问**: 生产环境建议使用 Nginx 反向代理并配置 HTTPS
3. **定期更新**: 关注 SearXNG 官方更新，及时升级版本
4. **日志监控**: 定期检查 SearXNG 日志，发现异常访问

## 相关链接

- [SearXNG 官方文档](https://docs.searxng.org/)
- [SearXNG GitHub](https://github.com/searxng/searxng)
- [Link-AI Chat 官方文档](https://linkai.chat)
