# 撸啊撸职业父与子

输入两名英雄联盟职业选手的 ID，查看他们全部历史交手数据与总胜率，并输出一份「谁是谁的爹」的整活鉴定报告。

## 功能

- **父子鉴定**：双搜索框输入两名选手（支持英文 ID 与中文昵称，如 `JKL` / `阿水` / `晒哥`），查看全部小局与系列赛交手记录、双向胜率，以及搞笑结论。
- **时间轴（阶段二）**：结果页与排行榜支持「全部 / 近一年 / 近两年 / 自定义区间」筛选，看某一个时期谁是谁的爹。
- **爹榜 / 儿榜（阶段二）**：查看任意选手的「一爹 / 二爹 / 三爹」与「一儿 / 二儿 / 三儿」，按胜率排序，可调最少交手局数。
- 结果页与排行榜均支持 URL 分享（如 `/h2h/123/456?from=2023-01-01`）。

## 技术栈

- Next.js 15（App Router）+ React 19 + TypeScript
- better-sqlite3（只读查询本地 SQLite 数据库）
- Python 3 + pandas（数据下载与建库管线）
- Vitest（判定逻辑单元测试）

## 快速开始

```bash
# 1. 下载数据（Oracle's Elixir 年度 CSV，国内网络会自动多连接并行下载）
npm run data:refresh

# 2. 本地开发
npm run dev

# 3. 生产构建
npm run build && npm run start
```

访问 http://localhost:3000 。

## 数据说明

- 数据源：Oracle's Elixir（`oracleselixir.com`）全球职业比赛数据（LPL / LCK / LEC / LCS / PCS 等各大赛区与 MSI、全球总决赛）。
- 下载：`scripts/fetch-data.ps1` 通过 Kaggle 官方 API 免登录下载年度 CSV 压缩包，用 8 条并行 Range 连接加速；文件落盘 `data/raw/`。
- 覆盖范围：当前自动下载的数据为 **2020 年至今**（含最新赛季）。2014–2019 年的历史文件官方只放在 Google Drive（国内网络通常不可达）；如需补全，可自行从 [Oracle's Elixir 下载页](https://oracleselixir.com/tools/downloads)（或 [Drive 文件夹](https://drive.google.com/drive/folders/1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH)）下载 `YYYY_LoL_esports_match_data_from_OraclesElixir.csv`（或 `.xlsx`）放入 `data/raw/`，然后执行 `npm run data:build` 即可合并进数据库。
- 建库：`scripts/build_db.py` 清洗、归一化选手名、合并别名（`scripts/seed_aliases.json` 可扩展），生成 `data/lol.db`。
- 口径：
  - 「交手」= 两名选手同一小局互为对手（不同队伍）且均上场；同队不算。
  - 判定默认按小局总胜率（可配置），页面同时展示系列赛战绩作为参考。
  - 默认最少 10 局才下结论；不足时显示「样本不足，爹位待定」。
- 更新：每月数据发布后重新执行 `npm run data:refresh` 即可。

## 目录结构

```text
app/            页面与 API 路由
components/     前端组件（搜索、鉴定结果、排行榜）
lib/            数据库访问、查询与判定逻辑
scripts/        数据下载、建库、核对脚本
data/           原始 CSV 与生成的 lol.db（已 gitignore）
```

## 测试

```bash
npm test                              # 判定逻辑单元测试
python scripts/check.py "Bin" "Zeus"  # 核对任意两名选手的交手数据
```

## 部署

v1 以本地/自托管运行为主：在任意 Node 服务器上 `npm run build && npm run start` 即可。
注意 better-sqlite3 是文件型数据库，**不适用 Vercel 无服务器环境**；如需上云，可改用国内云服务器，或后续迁移到托管数据库。

## 免责声明

本站结论仅供娱乐，任何「父子关系」均不代表选手真实水平与实力评价。
