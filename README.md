English | [中文](README.zh-CN.md)

# dsh-model-provider-label —— show the provider in the "current model" button

## 1. What problem does it solve

DSH's model selector **already** groups models by provider: once you expand the list, every group has the provider name above it (the `MenuGroup` group title, taken from the provider's `displayName`).
But **after you select a model**, the button above the input box shows only the model name:

```
deepseek-v4.1-flash           ← cannot tell whether this is 「阿里云(公司)」 or 「阿里云(个人)」
```

When several providers offer a model with the **same name** (in one profile, for example, both `阿里云(公司)` and `阿里云(个人)` are `deepseek-v4.1-flash`,
and both `llm-deepseek` and `和仁平台` are `deepseek-flash`), however clear the group title is, it does not help — **it disappears as soon as you select something**.

After applying this patch:

```
和仁平台 · deepseek-flash · Default
└─ dimmed ─┘   └─ normal ─┘   └─ effort ┘
```

The value of the "Model" row in the menu root panel, and the accessibility reading text (aria), carry the provider as well.

## 2. What it changes

The target file is the compiled artifact that dsh actually loads (not the source repository):

```
<dsh-install>/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js
# for a global npm install, for example: $(npm root -g)/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js
```

The absolute path as resolved on your own machine can be printed with `readlink -f ~/.dsh/profiles/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js`.

5 changes in total, all anchored on uniquely identifiable code fragments:

| # | Location | Change |
|---|---|---|
| 1 | before `triggerLabel` | adds `providerLabel` (the display name of the provider the current selection belongs to; `deepseek-account` uses a localized string, consistent with the list group titles) and `modelAriaLabel` |
| 2 | `triggerLabel` | changed from "model name · effort" to "provider · model name · effort", skipping missing parts automatically |
| 3 | the button's text JSX | the provider becomes its own segment using `--dsw-alias-label-caption` (dimmer) and is placed **before the model name**, so when the ellipsis truncates the text the tail of the model name is dropped first and the provider is never swallowed |
| 4 | the value of the "Model" row in the menu root panel | shows the provider as well |
| 5 | `triggerAria` | the aria reading text carries the provider |

The patch text contains the `LOCAL-PATCH:provider-label` marker, which the script uses to decide idempotency.

## 3. How to use it

```bash
cd dsh-model-provider-label   # the directory that contains patch.mjs

node patch.mjs            # apply the patch (skipped if already applied); locates the target file from the profile automatically
node patch.mjs --check    # show the status only
node patch.mjs --revert   # revert (strictly the inverse of applying; does not rely on the backup file)
node patch.mjs --target /path/to/other/lib/client.js   # point at another install location
```

- Before patching, an original copy is kept as `client.js.orig-provider-label` (the file name does not end in `.js`,
  so the client's chunk scanning rule `^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$` does not match it).
- **No restart is needed** after the change: `dsh-client-hmr` stats the client bundle once every 500ms,
  and as soon as mtime/ctime/size change it recomputes the rev and pushes it to the browser over SSE for hot reload. Refreshing the page once is the safest.

## 4. After a dsh upgrade

Upgrading `dsh` overwrites `node_modules`, and the patch is lost with it (back to "model name only"). Run it once more:

```bash
node patch.mjs
```

If the upgrade also rewrote this piece of code, the script **exits with an error instead of editing blindly**, for example:

```
锚点「triggerLabel 定义」匹配到 0 处，期望恰好 1 处；DSH 可能已升级并改写了这段代码，请重新核对补丁
```

In that case you need to re-check the anchors against the new `client.js` and then update the constants in this script. You can run `node patch.mjs --check` first to confirm the status.

## 5. How to verify that the patch is really in effect

Besides eyeballing the button, you can ask the server for the bundle it actually sends out
(the `/plugins/events` SSE endpoint needs no authentication and pushes the complete client module graph):

```bash
timeout 4 curl -s -N http://127.0.0.1:<port>/plugins/events > /tmp/sse.txt
# take the rev and url of model-selection from the graph, then fetch that url and look for the marker
```

`<port>` is the port your DSH Web GUI listens on. If the package's `rev` in the graph has changed, and the fetched bundle contains `LOCAL-PATCH:provider-label`,
then what the server sends out is the patched code (this is also the acceptance path this patch was verified through).

## 6. Known limitations

- **Only the display of the "currently selected model" is changed.** The expanded model list is still "group title + bare model name",
  and the `/model` command popup is the same — they already carry the provider information, it is just not in a prominent place. If you also want every row to carry its own provider,
  you have to patch the list row as well (the `ModelSelect_module_css_default.modelName` spot).
- The patch is applied to the **compiled artifact**, which means "editing node_modules". The reason the other two approaches were not taken:
  - *Changing the model display name in the configuration* (writing `name` as "provider · model name" in `cordis.patch.yml`):
    zero code and it survives upgrades, but the list would then show the provider both in the group title and inside the model name, which is redundant and ugly.
  - *Writing a local client plugin that takes over the `conversation.input.model` slot*: the most legitimate option, but that slot is `single` and
    `replaceRisk: shadows-shipped-ui`, so taking it over means reimplementing the entire selector (catalog loading, search, keyboard navigation,
    effort panel), a cost out of proportion to the benefit.

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.
