window.__ModuleLoader__.load({
	id: "@local/dsh-model-provider-label",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");

		/** 模型标签的 slot 名（官方在 0.2.1 开放，fallback 只渲染 model.name）。 */
		const SLOT = "conversation.input.model.label";

		/**
		 * 在模型名前显示供应商名。
		 *
		 * 为什么这么做：输入框上方那颗「当前模型」按钮只显示模型名，而
		 * `deepseek-v4.1-flash` 在「阿里云(公司)」「阿里云(个人)」「和仁」下都有同名条目，
		 * 看不出当前用的是哪一路。渲染时把 provider.name 以更淡的 caption 色排在前面，
		 * 文案被省略号截断时先丢的也是模型名尾部，供应商不被吃掉。
		 *
		 * 只在非 option 位置加前缀：模型下拉列表本身已按供应商分组（组标题就是供应商名），
		 * 每一项再加一遍纯属噪音。
		 *
		 * @param props - slot 提供的 { provider, model, placement, selected }。
		 * @returns 供应商 + 模型名的组合，或纯模型名。
		 */
		function ProviderModelLabel({ provider, model, placement }) {
			const modelName = model === undefined ? "" : model.name;
			const providerName = provider === undefined ? undefined : provider.name;
			if (providerName === undefined || placement === "option") return modelName;
			return react_jsx_runtime.jsxs("span", {
				title: `${providerName} · ${modelName}`,
				children: [
					react_jsx_runtime.jsx("span", {
						style: { color: "var(--dsw-alias-label-caption)", marginRight: "4px" },
						children: providerName
					}),
					modelName
				]
			});
		}

		/** 只需要 slots 服务；组件的其它数据由 slot 调用方通过 props 传进来。 */
		const inject = ["slots"];

		/**
		 * 在声明该 slot 的插件挂载期间注册渲染器。
		 *
		 * 用 `ctx.slots.inject` 而不是直接 `register`：slot 由
		 * `@deepseek-ai/dsh-client-ui-model-selection` 声明，未挂载时注册会失败；
		 * inject 等到它可用再挂，插件卸载时自动回卷。
		 *
		 * @param ctx - 客户端插件上下文。
		 */
		function apply(ctx) {
			ctx.slots.inject(SLOT, () => ctx.slots.register({
				name: SLOT
			}, ProviderModelLabel));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
