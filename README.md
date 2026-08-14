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
# 1. 下载数据（Oracle's Elixir 年度 CSV + Leaguepedia 补全 2011-2015 缺口）
npm run data:refresh

# 2. 本地开发
npm run dev

# 3. 生产构建
npm run build && npm run start
```

访问 http://localhost:3000 。

## 数据说明

- 数据源：
  - **Oracle's Elixir**（`oracleselixir.com`）：2014-2015 欧美/世界赛与 **2016 年至今**全球职业比赛（LPL / LCK / LEC / LCS / PCS 等各大赛区与 MSI、全球总决赛，2026 含 MSI/EWC 等最新赛事）。
  - **Leaguepedia**（`lol.fandom.com`）：补全 OE 缺失的历史数据——**2011-2013 全部赛事**、2014 年 LCK/LPL/LMS、2015 年 LPL。
  - **Leaguepedia 国家队/特殊赛事**：亚运会（2018 预选赛与雅加达正赛、2022 杭州主赛、2026 预选赛）、洲际对抗赛 Rift Rivals（2017-2019）、全明星（2013-2017）、LPL 全明星等——这类不以俱乐部名义参赛的国家队对局 OE 不收录，但选手交手真实存在（如 Faker vs Uzi 的 2018 亚运预选赛 3 局 + 正赛小组赛 2 局 + 决赛 4 局）。
- 下载：
  - `scripts/fetch-drive-official.ps1`：官方 [Drive 文件夹](https://drive.google.com/drive/folders/1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH) 下载 OE 各年份 CSV（断点续传、低速熔断与大小校验），需要本机代理（见 `docs/network-setup.md`）；`scripts/fetch-data.ps1` 作为 Kaggle 镜像兜底。
  - `scripts/fetch-leaguepedia.py`：通过 Leaguepedia `Special:CargoExport` 拉取 2011-2015 缺失赛事（比赛 → 赛事映射 → 选手级数据），输出与 OE 同格式的 CSV；缓存于 `tmp/leaguepedia/`，`--refresh` 可强制重拉。
    - `--events` 模式：拉取亚运会 / 洲际对抗赛 / 全明星等国家队与特殊赛事（缓存同样可复用）。
  - `scripts/build-ag2018-main.py`：补全 2018 雅加达亚运会正赛（28 场）。Leaguepedia 只有系列赛日程与国家队名单、**无逐局英雄数据**，因此逐局胜负与首发按 2018 年媒体报道核实（含决赛第 4 局韩国 Peanut 上场），`champion` 留空；系列赛日程每次运行自动从 Leaguepedia 同步。
  - 文件均落盘 `data/raw/`，`scripts/build_db.py` 统一建库。
- 覆盖范围：**2011 年至今**。年份明细：2011-2013（Leaguepedia）、2014（OE 欧美 + Leaguepedia 的 LCK/LPL/LMS）、2015（OE 全赛区 + Leaguepedia 的 LPL）、2016-2026（OE 官方数据）+ 亚运会/洲际对抗赛/全明星等国家队赛事。
- 建库：`scripts/build_db.py` 清洗、归一化选手名、合并别名（`scripts/seed_aliases.json` 可扩展），生成 `data/lol.db`。
- 口径：
  - 「交手」= 两名选手同一小局互为对手（不同队伍）且均上场；同队不算。
  - 判定默认按小局总胜率（可配置），页面同时展示系列赛战绩作为参考。
  - 默认最少 10 局才下结论；不足时显示「样本不足，爹位待定」。
- 更新：每月数据发布后执行 `npm run data:refresh`（自动包含亚运正赛脚本）或手动执行 `powershell -File scripts/fetch-drive-official.ps1 && python scripts/fetch-leaguepedia.py && python scripts/build-ag2018-main.py && npm run data:build` 即可。

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
