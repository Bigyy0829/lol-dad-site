# 撸啊撸职业父与子

输入两名英雄联盟职业选手的 ID，查看他们全部历史交手数据与总胜率，
输出一份「谁是谁的爹」的整活鉴定报告。数据覆盖 2011 年至今的全球职业比赛
（LPL / LCK / LEC / LCS / PCS / MSI / 全球总决赛 / 亚运会 / 洲际对抗赛等）。

![Release](https://img.shields.io/github/v/release/Bigyy0829/lol-dad-site)

---

## 🎮 想直接玩？下载便携版（不用懂任何代码）

👉 **下载地址：[GitHub Releases 最新版](https://github.com/Bigyy0829/lol-dad-site/releases/latest)**

打开后下载 `lol-dad-site-portable-版本号.zip`，然后：

1. 解压到一个文件夹（比如桌面）
2. 双击里面的 **「启动网站.bat」**
3. 等 1-2 秒，浏览器会自动打开网站，开玩
4. 不想玩了，双击 **「停止网站.bat」** 即可，不残留后台进程

**对玩家的承诺：**

- 不需要安装任何东西（不用装 Node、Python、数据库）
- 不需要 VPN、不需要联网才能玩（网站数据就在包里）
- 每次双击启动时自动检查更新：有新版自动下载替换，失败自动回滚，绝不弄坏
- 数据每周一自动刷新（由 GitHub 云端流水线完成），玩家永远拿到最新版

> 朋友之间分享：把上面的下载链接发给对方即可。

---

## 👨‍💻 开发者：克隆源码自己跑

前置：Node.js 18+、Python 3.10+（数据刷新用）。

```bash
git clone https://github.com/Bigyy0829/lol-dad-site.git
cd lol-dad-site

pip install -r requirements.txt   # 数据脚本依赖（pandas、requests）
npm ci                            # 前端依赖
npm run data:refresh              # 下载全量比赛数据并建库（联网，约 10-30 分钟）
npm run dev                       # 本地开发模式，浏览器打开 http://localhost:3000
```

生产模式：`npm run build && npm run start`。

> 想让网站作为后台服务**常驻运行**（开机自启、崩了自动拉起）？
> 这是可选项，普通玩不需要。见 [docs/run-local-always.md](docs/run-local-always.md)。
> 更省事的方式是直接用上方的便携版，双击即用。

## 功能

- **父子鉴定**：双搜索框输入两名选手（支持英文 ID 与中文昵称，如 `JKL` / `阿水` / `晒哥`），查看全部小局与系列赛交手记录、双向胜率，以及搞笑结论。
- **时间轴筛选**：结果页与排行榜支持「全部 / 近一年 / 近两年 / 自定义区间」筛选，看某一个时期谁是谁的爹。
- **爹榜 / 儿榜**：查看任意选手的「一爹 / 二爹 / 三爹」与「一儿 / 二儿 / 三儿」，按胜率排序，可调最少交手局数。
- 结果页与排行榜均支持 URL 分享（如 `/h2h/123/456?from=2023-01-01`）。

## 数据说明

- 数据源：
  - **Oracle's Elixir**：2014 年至今全球职业比赛（2014-2015 欧美/世界赛 + 2016 年起全赛区）。
  - **Leaguepedia**：补全 2011-2015 历史数据（2011-2013 全部赛事、2014 LCK/LPL/LMS、2015 LPL）。
  - **国家队/特殊赛事**：亚运会、洲际对抗赛 Rift Rivals 等（如 Faker vs Uzi 的 2018 亚运对决）。
  - 全明星等表演赛不计入统计。
- 建库脚本：`scripts/build_db.py`（清洗、归一化选手名、合并别名、生成 `data/lol.db`）。
- 数据更新：**已自动化**——GitHub Actions 每周一自动刷新并发布新版；手动刷新仍可执行 `npm run data:refresh`。

## 技术栈

- Next.js 15（App Router）+ React 19 + TypeScript
- better-sqlite3（只读查询本地 SQLite 数据库）
- Python 3 + pandas + requests（数据下载与建库管线）
- Vitest（判定逻辑单元测试）

## 目录结构

```text
src/            页面、组件与 API 路由
scripts/        数据下载、建库、打包、发布脚本
data/           原始 CSV 与生成的 lol.db（已 gitignore，不提交）
release/        便携版构建产物（已 gitignore，随 GitHub Releases 分发）
.github/        CI 自动刷新与发布工作流
```

## 测试

```bash
npm test                              # 判定逻辑单元测试
python scripts/check.py "Bin" "Zeus"  # 核对任意两名选手的交手数据
```

## 便携版与自动更新（面向维护者）

- `scripts\build-portable.ps1`：把网站打成绿色便携版（内置 Node + 构建产物 + 数据库）。
- `scripts\publish.ps1`：打包并生成更新清单（SHA256），可选 `-Upload` 直接发 GitHub Release。
- 便携包启动器会读取 `updates.json` 里的仓库名，启动时自动检查更新。
- 自动流水线 `.github/workflows/refresh-data.yml`：每周一自动 刷新数据 → 构建 → 打包 → 发 Release，并只保留最新版。
- GitHub 上传/发布手把手教程见 [docs/github-upload.md](docs/github-upload.md)。

## 免责声明

本站结论仅供娱乐，任何「父子关系」均不代表选手真实水平与实力评价。
