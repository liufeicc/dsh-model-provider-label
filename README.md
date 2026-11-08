English | [中文](README.zh-CN.md)

# dsh-model-provider-label — show the provider in the "current model" button

> **2.0 (2026-10-21): rewritten as a slot plugin.** DSH 0.2.1 exposes the
> `conversation.input.model.label` render slot, so this plugin now registers a
> renderer instead of patching the compiled `dsh-client-ui-model-selection`
> bundle. The old `patch.mjs` is deprecated and kept only for historical
> reference — do not run it against 0.2.1, where its anchors no longer match.

## 1. The problem

DSH's model selector **already** groups models by provider: once you expand the
list, every group has the provider name above it (the `MenuGroup` title, taken
from the provider's display name). But **after you select a model**, the button
above the input box shows only the model name:

```text
deepseek-v4.1-flash           ← is this 「阿里云(公司)」 or 「阿里云(个人)」?
```

When several providers offer a model with the **same name** (for example, both
`阿里云(公司)` and `阿里云(个人)` expose `deepseek-v4.1-flash`, and both
`llm-deepseek` and `和仁平台` expose `deepseek-flash`), the group title cannot
help once the selection is made — it is gone.

With this plugin:

```text
和仁平台 · deepseek-flash · Default
└─ dimmed ─┘   └─ normal ─┘   └─ effort ┘
```

The value of the "Model" row in the menu root panel carries the provider as
well.

## 2. How it works

The plugin registers a renderer for the official render slot
`conversation.input.model.label`:

- `client.js` — registers the renderer through `ctx.slots.inject(...)`, so it
  mounts only while the plugin that declares the slot
  (`@deepseek-ai/dsh-client-ui-model-selection`) is active, and rolls back when
  this plugin unloads.
- `index.js` — a no-op host entry. A profile bundle row is a host plugin row, so
  the package must be insertable as a Cordis plugin; all the work happens in the
  browser.
- `cordis.patch.yml` — inserts that host row.
- `package.json` — declares `dsh.bundle` and injects the model-selection client
  package through `dsh.client.inject`, so the slot provider is loaded first.

The renderer puts the provider name in a dimmer caption color **before** the
model name. Because the provider comes first, ellipsis truncation drops the tail
of the model name first and never swallows the provider. Rows in the expanded
model list (`placement: "option"`) keep the bare model name: that list is
already grouped by provider, so repeating the name there would only add noise.

## 3. Install

Requires DSH 0.2.1 or newer (the slot was introduced in 0.2.1).

```sh
dsh plugin --profile web add github:liufeicc/dsh-model-provider-label
```

Restart the host (`dsh web`) after adding the package. For local development,
link the directory instead:

```sh
dsh plugin --profile web add link:/path/to/dsh-model-provider-label
```

## 4. Upgrading DSH

Nothing under `node_modules` is patched, so upgrading `dsh` does not remove the
plugin. Only a future change to the slot API would require updating `client.js`.

## 5. History: the 1.0 patch

1.0 edited
`<dsh-install>/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js`
in place, inserting five anchored changes marked `LOCAL-PATCH:provider-label`.
Every `dsh` upgrade overwrote them, and the anchors drifted. `patch.mjs` is
still in the repository for reference; it is not part of the published files and
must not be run against 0.2.1.

## 6. Known limitations

- Only the current selection (the button and the menu's "Model" value) is
  changed. The expanded list and the `/model` command popup keep their bare
  model names; they already show the provider in their group titles.
- The accessibility text (aria) keeps the default model name.

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for
details.
