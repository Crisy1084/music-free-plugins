---
name: update-channel
description: music-free-plugins 仓库音源插件更新流程：下载上游 JS 替换 dist 文件、改写元数据（author 固定小趴菜）、同步 plugins.json、校验、按惯例提交并推送 gitee/github 双远端。用户要求更新某个音源时使用。
---

# 音源插件更新（update channel）

把上游音源 JS 更新到本仓库 `dist/<源>/index.js`，并同步索引、提交推送。

## 必要输入（缺失时先询问用户）

| 输入 | 说明 | 缺省 |
|---|---|---|
| 源名 | 见下方映射表 | 必填 |
| 上游 URL | 上游音源 JS 的 raw 直链 | 必填 |
| version | 惯例为当天日期 `YYYYMMDD` | 当天日期 |
| author | **固定 `"小趴菜"`**，覆盖上游作者 | 固定值，不询问 |

## 源名映射

| plugins.json name | dist 目录 | platform 值 |
| --- | --- | --- |
| QQ音乐 | `dist/qq` | `"QQ音乐"` |
| 酷狗 | `dist/kugou` | `"酷狗"` |
| 酷我 | `dist/kuwo` | `"酷我"` |
| 网易云 | `dist/netease` | `"网易云"` |
| 咪咕 | `dist/migu` | `"咪咕"` |
| bilibili | `dist/bilibili` | `"bilibili"` |

其余源（5sing、千千、喜马拉雅等）按 `plugins.json` 条目对应；platform 一律用仓库现值，不采纳上游名称（如上游"弥音QQ(128k)"→仓库 `"QQ音乐"`）。

## 更新步骤

### 1. 下载上游并识别形态

下载到 `/tmp`（不落在仓库内），然后确认元数据块形态，三种情况处理方式不同：

- **干净打包**（parcel bundle）：`pluginInstance = { platform: "xxx", ... }` 字段明文，直接字符串替换
- **压缩混淆**：字段名明文但值可能 `\u` 转义（如 `platform:"\u54AA\u5495..."`）。grep 定位时注意转义形式
- **字符串表混淆**（Unicode 标识符 + 解码函数）：形如 `module[dec(0x1d3,'KZ7p')]={'platform':<变量>,'author':dec(0x331,'A]hA'),'version':dec('fwa^',0x63d),'srcUrl':<变量>,...}`，值为表达式，需正则替换值表达式为字符串字面量
- **TypeScript 源码**（.ts）：走仓库构建管线，见下方「TS 源码更新流程」

### 2. 整文件替换 dist 文件，改写元数据

四个字段必须改成仓库标准值：

```js
platform: "<仓库 platform 名>",
author: "小趴菜",
version: "<版本号>",
srcUrl: "https://github.com/Crisy1084/music-free-plugins/raw/release/dist/<目录>/index.js",
```

其余字段（cacheControl/hints/primaryKey/supportedSearchType/appVersion 等）保留上游原值。

混淆文件的安全改法（Python，断言恰好命中一次，防止改错位置）：

```python
import re
s = open(f, encoding='utf-8').read()
assert s.count('module[') == 1
i = s.find('module[')
seg = s[i:i+1500]
# 值为纯标识符的（platform/srcUrl）：
seg, n = re.subn(r"('platform':)[^,]+(,)", lambda m: m.group(1)+'"酷狗"'+m.group(2), seg, count=1); assert n==1
# 值为解码函数调用的（author/version）：
seg, n = re.subn(r"('author':)[^(]+\([^)]*\)(,)", lambda m: m.group(1)+'"小趴菜"'+m.group(2), seg, count=1); assert n==1
s = s[:i] + seg + s[i+1500:]
```

注意坑：`str.count()` 是字面子串匹配，别传带 `\.` 正则转义的模式进去。

### 3. 同步 plugins.json

只改对应源条目的 `"version"`，其他源不动。

### 4. 校验（三关全过才算完成）

```bash
node --check dist/<源>/index.js              # 语法
python3 -c "import json; json.load(open('plugins.json'))"  # 索引合法
```

require 冒烟测试（stub 掉 MusicFree 环境依赖），确认元数据与函数导出：

```js
// /tmp/mfp-smoke/smoke.js
const Module = require('module');
const orig = Module._load;
Module._load = (req, p, m) => req==='axios'?{default:{}}
  : req==='crypto-js'?{default:{},AES:{},MD5:{},enc:{}}
  : req==='he'?{default:{}}
  : orig(req,p,m);
const mod = require(process.argv[2]);
const plug = mod.default || mod;
console.log(JSON.stringify({platform:plug.platform,author:plug.author,version:plug.version,srcUrl:plug.srcUrl,search:typeof plug.search,getMediaSource:typeof plug.getMediaSource}));
```

`node /tmp/mfp-smoke/smoke.js dist/<源>/index.js` —— platform/author/version/srcUrl 四值正确且 search/getMediaSource 为 `"function"`。混淆包改完能 require 说明未触发防篡改。

## 提交与推送（仅在用户明确要求时执行）

分支固定 `release`。

```bash
git add dist/<源>/index.js ... plugins.json
git commit -m "更新版本: 1.qq: 更新到<ver> 2.酷狗: 更新到<ver> ..."   # 多源按 f0775c0 风格编号列出；单源按 327fae6 风格
git push origin release    # gitee（跟踪远端）
git push github release    # 必推！plugins.json/srcUrl 的下载地址指向 GitHub raw
```

推送后验证线上生效：

```bash
curl -sL "https://raw.githubusercontent.com/Crisy1084/music-free-plugins/release/plugins.json" | grep version
curl -sL "https://github.com/Crisy1084/music-free-plugins/raw/release/dist/<源>/index.js" | grep -o 'version[:= ]*"[^"]*"'
```

`aliyun` 远端是滞后镜像，默认不推，用户要求才同步。

## TS 源码更新流程（上游给 .ts 时）

1. 改好元数据后写入 `plugins/<源>/index.ts`（仓库源码目录，`tsc` 会编译它到 `dist/`）
2. `npm install`（node_modules 为空时）后运行 `npx tsc`
3. **高危，必做**：`tsc` 会编译 `plugins/` 下**全部** TS，把手工更新的上游 dist 产物（qq/kugou/kuwo/migu 等）覆盖回旧版。编译后立即：
   ```bash
   git checkout -- $(git diff --name-only -- dist | grep -v 'dist/<目标源>')
   ```
   恢复被误覆盖的文件，只留目标源产物
4. **绝不运行 `npm run build` / `scripts/generate.js`**：它会从 dist 重新生成 plugins.json，混淆文件匹配不到 `module.exports\s*=` 正则会被整条丢弃，手工维护的索引全毁
5. 校验同三关；编译产物是 CommonJS，require 依赖（axios/dayjs/he/cheerio 等）由 MusicFree 环境提供（cheerio 已有 netease/5sing 等 8 个在线插件在用）

## 新增源（区别于更新的额外步骤）

1. `mkdir dist/<新目录>/`（目录名用小写英文，如 `aliyundrive`），写入改好元数据的上游文件
2. **platform 用上游值**（新源没有仓库现值；混淆文件通过冒烟测试的 require 解出真实值）
3. 索引二选一：主流音源加 `plugins.json`；个人云盘/三方源（WebDAV、Navidrome、阿里云盘类）加 `plugins-more.json`（见 be08d3d 惯例），条目含 name/url/version
4. 其余（元数据四字段、校验、提交推送）同更新流程

## 已知上游来源（历史记录，新 URL 以用户当次提供为准）

- QQ：`https://raw.gitcode.com/Crystim/mfp/raw/main/弥音QQ.js`（2025-11-03）
- 酷狗/酷我：`https://music.nairocy.com/file/酷狗_onemusic.js`、`..._onemusic.js`（2025-11-03）
- 咪咕：`https://raw.giteeusercontent.com/Domdkw/MusicFree-migu/raw/master/dist/migu-plugin.js`（2025-11-03）
- 阿里云盘：`https://raw.githubusercontent.com/Ppangling/musicfree-aliyundrive-plugin/refs/heads/main/aliyundrive.js`（2025-11-03 新增）
