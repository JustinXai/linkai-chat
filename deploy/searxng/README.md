# SearXNG 搜索服务部署指南

Link-AI Chat 的联网搜索功能依赖 SearXNG 自建搜索服务。

## 目录结构

```
deploy/searxng/
├── docker-compose.yml    # Docker Compose 配置
├── .env.example         # 环境变量示例
├── searxng/
│   └── settings.yml     # SearXNG 配置
└── README.md            # 本文件
```

## 快速部署

### 1. 进入目录

```bash
cd deploy/searxng
```

### 2. 启动服务

```bash
docker compose up -d
```

### 3. 验证服务

```bash
curl "http://127.0.0.1:8888/search?q=OpenAI最新模型&format=json"
```

预期返回 JSON 格式的搜索结果。

## 配置说明

### 关键配置

1. **JSON 格式支持** (必须)
   ```yaml
   search:
     formats:
       - html
       - json  # 必须包含 json，否则 API 返回 403
   ```

2. **中文语言偏好**
   ```yaml
   search:
     default_lang: zh-CN
     default_locale: zh-CN
   ```

3. **安全搜索**
   ```yaml
   search:
     safe_search: 1  # 0=关闭, 1=中等, 2=严格
   ```

4. **搜索引擎**
   - 启用: google, bing, duckduckgo, brave, baidu, sogou, 360search
   - 禁用: 图片、视频、新闻等非必要源

5. **网络隔离**
   - 只绑定 `127.0.0.1:8888`
   - Docker 端口映射为 `127.0.0.1:8888:8080`
   - 不对外暴露

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SEARXNG_BASE_URL` | 实例 URL | `http://127.0.0.1:8888/` |
| `SEARXNG_SECRET_KEY` | 密钥 | 生产环境请修改 |

## 常见问题

### 1. 返回 403 Forbidden

**原因**: `settings.yml` 中没有启用 `json` 格式

**解决**: 确保 `search.formats` 包含 `json`:

```yaml
search:
  formats:
    - html
    - json  # 必须有这一行
```

### 2. 返回空结果

**可能原因**:
- 网络问题，搜索引擎无法访问
- 引擎配置错误
- `safe_search` 过于严格

**排查步骤**:

```bash
# 1. 检查容器状态
docker compose ps

# 2. 查看日志
docker compose logs -f searxng

# 3. 访问 SearXNG 管理界面 (容器内)
docker exec -it linkai-searxng bash
curl "http://localhost:8080/config"
```

### 3. 搜索结果质量差

**解决**: 在 `settings.yml` 中调整搜索引擎优先级

### 4. 需要添加更多搜索引擎

编辑 `searxng/settings.yml` 中的 `engines` 部分，参考 [SearXNG 官方引擎列表](https://docs.searxng.org/admin/engines/engines.html)

## 运维命令

```bash
# 查看状态
docker compose ps

# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新镜像
docker compose pull && docker compose up -d

# 进入容器调试
docker exec -it linkai-searxng bash
```

## 安全说明

1. **不暴露公网**: SearXNG 只监听 `127.0.0.1:8888`
2. **API 密钥**: 生产环境请修改 `secret_key`
3. **安全搜索**: 默认开启中等安全搜索
4. **日志审计**: 建议定期检查日志

## 与 Link-AI Chat 集成

确保 `librechat.yaml` 或 `.env` 中配置了正确的 SearXNG 地址:

```yaml
endpoints:
  custom:
    - name: 'Link-AI'
      # ...
```

环境变量:
```bash
SEARXNG_INSTANCE_URL=http://127.0.0.1:8888
```
