[English](README.md) | 中文

# dsh-model-provider-label —— 让「当前模型」按钮显示供应商

## 一、解决什么问题

DSH 的模型选择器**已经**按供应商分组：展开列表后，每组上方都有供应商名（`MenuGroup` 的组标题，取的是 provider 的 `displayName`）。
但**选中之后**，输入框上方那颗按钮只显示模型名：

```
deepseek-v4.1-flash           ← 看不出是「阿里云(公司)」还是「阿里云(个人)」
```

当多个供应商提供**同名模型**时（例如某个 profile 里 `阿里云(公司)` 和 `阿里云(个人)` 都是 `deepseek-v4.1-flash`，
`llm-deepseek` 和 `和仁平台` 都是 `deepseek-flash`），组标题再清楚也没用——**选中之后它就消失了**。

打上本补丁后：

```
和仁平台 · deepseek-flash · Default
└─ 淡色 ─┘   └─ 正常色 ─┘   └─ effort ┘
```

菜单根面板里「模型」那一行的值、以及无障碍朗读文案（aria）也同步带上供应商。

## 二、改了什么

目标文件是 dsh 实际加载的编译产物（不是源码仓库）：

```
<dsh 安装目录>/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js
# 例如全局 npm 安装时：$(npm root -g)/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js
```

在你自己机器上解析出来的绝对路径可以用 `readlink -f ~/.dsh/profiles/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js` 查看。

一共 5 处改动，全部锚定在唯一可识别的代码片段上：

| # | 位置 | 改动 |
|---|---|---|
| 1 | `triggerLabel` 之前 | 新增 `providerLabel`（当前选中项所属供应商的显示名，`deepseek-account` 走本地化文案，与列表组标题保持一致）与 `modelAriaLabel` |
| 2 | `triggerLabel` | 由「模型名 · 推理等级」改为「供应商 · 模型名 · 推理等级」，缺失部分自动跳过 |
| 3 | 按钮文案 JSX | 供应商单独一段、用 `--dsw-alias-label-caption`（更淡）并**排在模型名之前**，被省略号截断时先丢模型名尾部，供应商不会被吃掉 |
| 4 | 菜单根面板「模型」行的值 | 同步显示供应商 |
| 5 | `triggerAria` | aria 朗读文案带上供应商 |

补丁文本里带 `LOCAL-PATCH:provider-label` 标记，脚本靠它判断幂等。

## 三、怎么用

```bash
cd dsh-model-provider-label   # 含 patch.mjs 的目录

node patch.mjs            # 打补丁（已打过会跳过）；自动从 profile 定位目标文件
node patch.mjs --check    # 只看状态
node patch.mjs --revert   # 撤销（与打补丁严格互逆，不依赖备份文件）
node patch.mjs --target /别的/路径/lib/client.js   # 指定其它安装位置
```

- 打补丁前会留一份原始副本 `client.js.orig-provider-label`（文件名不以 `.js` 结尾，
  不会被客户端的 chunk 扫描规则 `^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$` 命中）。
- 改完**不需要重启**：`dsh-client-hmr` 每 500ms stat 轮询一次客户端 bundle，
  mtime/ctime/size 变了就重算 rev 并通过 SSE 推给浏览器热加载。刷新一次页面最稳妥。

## 四、dsh 升级之后

`dsh` 升级会覆盖 `node_modules`，补丁随之丢失（回到「只有模型名」）。重新跑一次：

```bash
node patch.mjs
```

如果升级同时改写了这段代码，脚本会**报错退出而不是瞎改**，例如：

```
锚点「triggerLabel 定义」匹配到 0 处，期望恰好 1 处；DSH 可能已升级并改写了这段代码，请重新核对补丁
```

这时需要照着新版 `client.js` 重新核对锚点，再更新本脚本里的常量。可以先 `node patch.mjs --check` 确认状态。

## 五、怎么验证补丁真的生效

除了肉眼看按钮，还可以直接问服务器要它实际发出去的 bundle
（`/plugins/events` 这个 SSE 端点不需要鉴权，会推送完整的客户端模块图谱）：

```bash
timeout 4 curl -s -N http://127.0.0.1:<端口>/plugins/events > /tmp/sse.txt
# 从图谱里取出 model-selection 的 rev 与 url，再抓这个 url 查标记
```

`<端口>` 就是你的 DSH Web GUI 监听的端口。图谱里该包的 `rev` 变过、且抓下来的 bundle 里能搜到 `LOCAL-PATCH:provider-label`，
就说明服务器发出去的就是打补丁后的代码（这也是本补丁验收时走过的路径）。

## 六、已知限制

- **只改了「当前选中模型」的显示**。展开后的模型列表仍然是「分组标题 + 纯模型名」，
  `/model` 命令弹窗同理——它们本来就有供应商信息，只是位置不显眼。若也要让每一行自带供应商，
  得再改列表行（`ModelSelect_module_css_default.modelName` 那一处）。
- 补丁打在**编译产物**上，属于「改 node_modules」。之所以没走另外两条路：
  - *改配置里的模型显示名*（`cordis.patch.yml` 里把 `name` 写成「供应商 · 模型名」）：
    零代码、升级不丢，但列表里会同时出现组标题和模型名里的供应商，重复难看。
  - *写本地客户端插件接管 `conversation.input.model` 槽位*：最正规，但该槽位是 `single` 且
    `replaceRisk: shadows-shipped-ui`，接管等于把整个选择器（目录加载、搜索、键盘导航、
    推理等级面板）复刻一遍，代价与收益不成比例。

## 许可证

本项目采用 MIT 协议发布，详见 [LICENSE](LICENSE)。
