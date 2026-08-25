# 亲手把项目上传到 GitHub（操作指南）

按顺序做，每一步都说明「做什么、为什么、怎么确认成功」。全程由你自己敲命令，
遇到和预期不符的地方停下来问即可。

## 0. 先说清楚会上传什么、不会上传什么

会被上传（源码仓库）：

- 网站源码（src/、scripts/、docs/、设计系统 design.md、tokens.css、CI 工作流等）
- 代码历史（.git 里的所有提交）

不会被上传（已被 `.gitignore` 排除）：

- `node_modules/`（依赖，别人 clone 后 `npm ci` 自动装）
- `.next/`（构建产物）
- `data/*.db`（174MB 数据库，别人用数据脚本自己生成）
- `release/`（便携版安装包，改挂 GitHub Releases，不走仓库）

## 1. 注册账号并新建空仓库（网页操作）

1. 打开 https://github.com 注册/登录。
2. 右上角 + → **New repository**。
3. 仓库名建议 `lol-dad-site`（可改，后面命令里的名字要跟着改）。
4. **不要勾选** "Add a README" / ".gitignore" / "license"——保持空仓库，
   避免和本地已有的提交冲突。
5. 公开还是私有？公开仓库 Actions 完全免费；私有仓库每月 2000 分钟也够用。
   随便选，以后可改。
6. 创建后页面会显示一段 `git remote add origin ...` 的命令，先别急着点，
   照下面第 3 步来。

## 2. 本机先确认身份（第一次用 git 才需要）

```powershell
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

## 3. 连接远程仓库并推送

在项目根目录（`C:\Users\ASUS\Documents\ChatGPT\撸啊撸职业父与子`）打开 PowerShell：

```powershell
# 1) 先看看本地有没有未提交的改动（应当看到我们做的所有修改）
git status

# 2) 把本地分支改名为 main（GitHub 默认主分支名）
git branch -M main

# 3) 添加远程地址，把下面两处替换成你自己的用户名/仓库名
git remote add origin https://github.com/你的用户名/lol-dad-site.git

# 4) 推送到 GitHub（第一次要登录，见第 4 步）
git push -u origin main
```

确认成功：网页上仓库里出现了全部源码文件。

## 4. 登录方式（二选一）

**方式 A：GitHub CLI（推荐，后面发布版本也用得上）**

```powershell
gh auth login
```

按提示选：GitHub.com → HTTPS → 用浏览器登录 → 回车确认。
登录成功后再执行一次 `git push -u origin main`。

**方式 B：个人访问令牌（PAT）**

1. GitHub 网页：右上角头像 → Settings → Developer settings → Personal access
   tokens → Tokens (classic) → Generate new token。
2. 勾选 `repo` 权限，有效期建议 30 天（用完可撤销）。
3. 复制令牌，推送时用户名填你的 GitHub 用户名，密码填令牌。

## 5. 触发第一次自动发布（Actions）

仓库里已经放好了 CI 工作流 `.github/workflows/refresh-data.yml`，
它每周一自动跑一次，也可以手动跑：

1. 仓库网页 → **Actions** 标签页。
2. 左侧选 **Refresh data and publish** → 右侧 **Run workflow** → 绿色按钮确认。
3. 第一次跑大约 15-30 分钟（下载数据 + 构建 + 打包）。
4. 结束后 **Releases** 标签页会出现 `v2026.xx.xx.x`，里面挂着
   `lol-dad-site-portable-版本.zip` 和 `version.json`。

确认成功：Releases 里有 zip + version.json 两个附件。

## 6. 让便携包连上更新源（最后一步）

便携包里的 `updates.json` 现在写的是占位符 `OWNER/REPO`，改成你的仓库：

```powershell
# 项目根目录运行（替换成你的仓库）
powershell -ExecutionPolicy Bypass -File scripts\publish.ps1 -Repo "你的用户名/lol-dad-site"
```

这条命令会重新打包并生成带正确更新源的便携包 + 新的 version.json。
如果第 5 步的 Release 已经存在，你手动上传一次新 zip 即可
（Releases 页 → Edit → 替换附件），或者以后用：

```powershell
gh release create v2026.xx.xx.x "release\lol-dad-site-portable-2026.xx.xx.x.zip" "release\version.json" --repo 你的用户名/lol-dad-site --title v2026.xx.xx.x --notes 更新
```

## 7. 验证自动更新

1. 打开便携包，双击 `启动网站.bat`：如果 GitHub 上有比本地新的版本，
   会自动下载 → 校验 → 替换 → 启动（首次下载 182MB，之后每次只下新版）。
2. 也可以双击 `检查更新.bat` 手动看。
3. 更新失败（网络/校验失败）会自动回滚到旧版，不会弄坏本地。

## 常见问题

- **推送被拒（non-fast-forward）**：`git pull --rebase origin main` 后再 `git push`。
- **Actions 失败**：点进失败任务看日志；数据源偶发失败可直接
  **Run workflow** 重跑一次。
- **`gh` 未登录**：先 `gh auth login`。
- **不想每周自动跑**：编辑 `.github/workflows/refresh-data.yml` 里的
  `cron`（或删掉 `schedule` 只留手动），推送后生效。
- **存储**：工作流发布新版前会自动删除旧 Release，仓库永远只留最新版，不占空间。
