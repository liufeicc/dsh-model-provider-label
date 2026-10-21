/**
 * 纯客户端插件的 Host 端空壳。
 *
 * 为什么需要它：profile 的 bundle 行是「Host 插件行」，`@local/dsh-model-provider-label`
 * 必须能作为 Cordis 插件被插入一次；真正的工作全部在 `client.js`（浏览器端）完成 ——
 * 它注册 `conversation.input.model.label` 这个 slot，接管模型标签的渲染。
 *
 * 与旧版「改 client.js 的补丁」相比，这一层的价值就在于此：Host 侧不做任何文本注入，
 * 升级替换 node_modules 不会影响本插件。
 */
export function apply() {}
