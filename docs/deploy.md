# 部署到公网

这个项目用 better-sqlite3 读取本地 `data/lol.db`，所以**不能跑在 Vercel/Netlify 这类无服务器平台**，需要一台有持久文件系统的 Node 服务器。推荐国内云服务器（腾讯云轻量 / 阿里云轻量，Ubuntu 22.04+），因为数据源主要在境外，服务器还能顺便解决刷新数据时的网络问题。

## 需要准备

- 一台 Linux 服务器，建议 2C4G 以上（构建 Next.js 时吃内存）。
- 一个域名（可选，但 HTTPS 需要）。
- 服务器上装好 Docker（推荐）或 Node 20 + PM2。

## 重要：数据库不在 Git 里

`data/lol.db` 已经 gitignore，必须单独传上去。它大约 174 MB。

```bash
scp data/lol.db root@你的服务器:/opt/lol-dad-site/data/lol.db
```

或者用宝塔面板、对象存储、`rsync` 都行，只要能放到服务器的持久目录即可。

## 方案 A：Docker（推荐）

在服务器上准备代码和数据库：

```bash
mkdir -p /opt/lol-dad-site/data
cd /opt/lol-dad-site
# 把项目代码放进来。GitHub 直连不稳就用镜像前缀：
# https://ghfast.top/https://github.com/你的用户名/你的仓库.git
git clone --depth 1 https://github.com/你的用户名/你的仓库.git .
mkdir -p data
# 再上传 data/lol.db 到 /opt/lol-dad-site/data/lol.db
```

构建并启动：

```bash
cd /opt/lol-dad-site
docker build -t lol-dad-site .
docker run -d --name lol-dad-site \
  -p 127.0.0.1:3000:3000 \
  -v /opt/lol-dad-site/data/lol.db:/app/data/lol.db \
  --restart unless-stopped \
  lol-dad-site
```

然后配反向代理。以 Caddy 为例，`/etc/caddy/Caddyfile`：

```caddy
你的域名 {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy 会自动申请并续期 HTTPS。Nginx 也完全可行，只要反代到 `127.0.0.1:3000`。

## 方案 B：裸 Node + PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs python3 make g++
sudo npm i -g pm2

cd /opt/lol-dad-site
npm config set registry https://registry.npmmirror.com
npm ci
npm run build
pm2 start npm --name lol-dad-site -- start
pm2 save
```

前提同样是把 `data/lol.db` 放到 `/opt/lol-dad-site/data/lol.db`，再用 Nginx/Caddy 反代到 3000 端口。

## 上线后继续开发

部署和本地开发互不影响：

1. 本地在 `codex/lol-dad-site` 分支继续写代码、提交、push。
2. 服务器 `git pull`，然后：
   - Docker：`docker build -t lol-dad-site . && docker restart lol-dad-site`
   - PM2：`npm ci && npm run build && pm2 restart lol-dad-site`
3. 如果只更新数据，不更新代码：在本地跑 `npm run data:refresh`，再把新的 `data/lol.db` 传上去，重启容器/进程即可。

## 数据刷新

服务器上也可以直接刷新，但要能访问境外源：

```bash
cd /opt/lol-dad-site
npm run data:refresh
```

如果服务器网络拉不动 OE / Leaguepedia，就在本地刷新后再上传 `data/lol.db`，这样最稳。
