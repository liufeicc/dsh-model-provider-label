[English](README.md) | 中文

# dsh-model-provider-label —— 让「当前模型」按钮显示供应商

> **2.0（2026-10-21）：已改为 slot 插件。** DSH 0.2.1 开放了
> `conversation.input.model.label` 渲染 slot，本包现在注册一个渲染器，
> 不再修改编译后的 `dsh-client-ui-model-selection` bundle。旧的 `patch.mjs`
> 已弃用，仅作历史参考保留——不要在 0.2.1 上运行它，锚点已经匹配不到。

## 一、解决什么问题

DSH 的模型选择器**已经**按供应商分组：展开列表后，每组上方都有供应商名
（`MenuGroup` 的组标题，取的是 provider 的显示名）。但**选中之后**，输入框
上方那颗按钮只显示模型名：

```text
deepseek-v4.1-flash           ← 看不出是「阿里云(公司)」还是「阿里云(个人)」
```

当多个供应商提供**同名模型**时（例如 `阿里云(公司)` 和 `阿里云(个人)` 都有
`deepseek-v4.1-flash`，`llm-deepseek` 和 `和仁平台` 都有 `deepseek-flash`），
选中之后组标题就消失了，帮不上忙。

装上本插件后：

```text
和仁平台 · deepseek-flash · Default
└─ 淡色 ─┘   └─ 正常色 ─┘   └─ effort ┘
```

菜单根面板里「模型」那一行的值也会带上供应商。

## 二、实现方式

插件为官方渲染 slot `conversation.input.model.label` 注册渲染器：

- `client.js` —— 通过 `ctx.slots.inject(...)` 注册渲染器，只在声明该 slot 的插件
  （`@deepseek-ai/dsh-client-ui-model-selection`）挂载期间生效，本插件卸载时自动回卷。
- `index.js` —— 空的 Host 入口。profile 的 bundle 行是 Host 插件行，包必须能作为
  Cordis 插件插入一次；真正的工作全部在浏览器端。
- `cordis.patch.yml` —— 插入这条 Host 行。
- `package.json` —— 声明 `dsh.bundle`，并通过 `dsh.client.inject` 依赖
  model-selection 客户端包，保证声明 slot 的一方先加载。

渲染器把供应商名用更淡的 caption 色放在模型名**之前**。因为供应商在前，文案被
省略号截断时先丢的是模型名尾部，供应商不会被吃掉。展开列表里的行
（`placement: "option"`）保持纯模型名：那个列表本来已按供应商分组，再重复一遍
只会增加噪音。

## 三、安装

需要 DSH 0.2.1 或更新版本（slot 从 0.2.1 起提供）。

```sh
dsh plugin --profile web add github:liufeicc/dsh-model-provider-label
```

装完重启宿主（`dsh web`）。本地开发可以直接链接目录：

```sh
dsh plugin --profile web add link:/path/to/dsh-model-provider-label
```

## 四、DSH 升级之后

本插件不修改 `node_modules` 下的任何文件，升级 `dsh` 不会把它弄丢。只有将来
slot API 本身变了，才需要更新 `client.js`。

## 五、历史：1.0 的补丁

1.0 直接修改
`<dsh 安装目录>/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js`，
插入 5 处带 `LOCAL-PATCH:provider-label` 标记的改动。每次升级 `dsh` 都会覆盖掉，
锚点也会漂移。`patch.mjs` 仍留在仓库里供参考；它不在发布文件中，且不要在
0.2.1 上运行。

## 六、已知限制

- 只改「当前选中」的显示（按钮与菜单里的「模型」值）。展开的模型列表和
  `/model` 命令弹窗保持纯模型名——它们的组标题里已经有供应商。
- 无障碍朗读文案（aria）保持默认模型名。

## 许可证

本项目采用 MIT 协议发布，详见 [LICENSE](LICENSE)。
