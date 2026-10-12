#!/usr/bin/env node
/**
 * 给 DSH 的「模型选择」客户端插件打一个小补丁：
 * 让输入框上的「当前模型」按钮也显示供应商，形如
 *
 *     和仁平台 · deepseek-flash · Default
 *
 * ## 为什么需要它
 * DSH 的模型列表本身已经按供应商分组（组标题就是供应商 displayName），
 * 但按钮和菜单根面板里的「模型」那一行只显示模型名。当两个供应商提供同名模型
 * （例如 `阿里云(公司)` 与 `阿里云(个人)` 都是 `deepseek-v4.1-flash`）时，
 * 选中之后屏幕上完全看不出当前用的是哪一个供应商。
 *
 * ## 改了什么
 * 目标文件（已安装的编译产物）：
 *   <...>/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js
 * 五处改动，全部挂在下面这些锚点上；锚点找不到或不止一处就报错退出，绝不瞎改：
 *   1. 新增 providerLabel / modelAriaLabel 两个常量
 *   2. triggerLabel 改成 `${供应商} · ${模型名} · ${推理等级}`（缺失的部分自动跳过）
 *   3. 「当前模型」按钮文案：供应商用更淡的 caption 色单独成段，且排在模型名之前
 *      —— 文案被省略号截断时，先丢的是模型名尾部，供应商不会被吃掉
 *   4. 菜单根面板「模型」行的值同样带上供应商
 *   5. aria 朗读文案带上供应商
 *
 * ## 用法
 *   node patch.mjs              # 打补丁（幂等：已打过会跳过）
 *   node patch.mjs --check      # 只看状态，不写文件
 *   node patch.mjs --revert     # 撤销补丁
 *   node patch.mjs --target <client.js 的绝对路径>   # 指定别的安装位置
 *
 * dsh 升级会覆盖 node_modules，升级后重新跑一次本脚本即可。
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** 幂等标记：文件里出现它就说明补丁已生效。 */
const MARKER = 'LOCAL-PATCH:provider-label';
/** 目标包名与其客户端入口（相对包根）。 */
const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-model-selection';
const CLIENT_ENTRY = join('lib', 'client.js');
/** 首次打补丁时留的原始副本后缀。 */
const BACKUP_SUFFIX = '.orig-provider-label';

/** 按钮文案：供应商单独一段、用 caption 色，排在模型名之前。 */
const TRIGGER_CHILDREN_PATCHED =
  'children: providerLabel === void 0 ? modelLabel : [(0, react_jsx_runtime.jsx)("span", { style: { color: "var(--dsw-alias-label-caption)" }, children: [providerLabel, " · "] }, "provider"), modelLabel]';
/** 菜单根面板「模型」行：整行都是 tertiary 色，直接用拼好的文案即可。 */
const CELL_CHILDREN_PATCHED = 'children: modelAriaLabel';
/** 原始 triggerLabel 语句。 */
const TRIGGER_LABEL_BEFORE = 'const triggerLabel = effortLabel === void 0 ? modelLabel : `${modelLabel} · ${effortLabel}`;';
/** 打补丁后的 triggerLabel 语句。 */
const TRIGGER_LABEL_AFTER =
  'const triggerLabel = [providerLabel, modelLabel, effortLabel].filter((part) => part !== void 0).join(" · ");';
/** aria 语句里表示模型名的片段。 */
const ARIA_MODEL_BEFORE = 'model: modelLabel';
const ARIA_MODEL_AFTER = 'model: modelAriaLabel';
/** 打补丁时插在 triggerLabel 之前的那几行（除缩进外的内容）。 */
const INSERTED_LINES = [
  `/* ${MARKER} 当前选中模型所属供应商的显示名；选中项已不在目录里时为 undefined */`,
  'const providerLabel = currentChoice === void 0 ? void 0 : currentChoice.group.id === "deepseek-account" ? t("provider.account") : currentChoice.group.name;',
  '/* 供无障碍朗读的模型描述：带供应商但不含推理等级，等级由 ariaEffort 单独拼 */',
  'const modelAriaLabel = providerLabel === void 0 ? modelLabel : `${providerLabel} · ${modelLabel}`;',
];

/**
 * 解析 dsh 实际加载的那个 client.js：从 profile 的 package.json 出发按 Node 解析规则找包，
 * 这样 profile 用符号链接指向哪个安装目录就跟到哪个目录，不写死全局安装路径。
 * @returns {string} client.js 的绝对路径
 */
function resolveTarget() {
  const anchors = [
    join(homedir(), '.dsh', 'profiles', 'web', 'package.json'),
    join(homedir(), '.dsh', 'profiles', 'package.json'),
  ];
  const failures = [];
  for (const anchor of anchors) {
    try {
      const require = createRequire(anchor);
      const manifest = require.resolve(`${PACKAGE_NAME}/package.json`);
      return join(dirname(manifest), CLIENT_ENTRY);
    } catch (error) {
      failures.push(`${anchor} → ${error.message}`);
    }
  }
  throw new Error(
    `无法从 profile 里解析 ${PACKAGE_NAME}，请用 --target 指定 client.js 路径。尝试过的锚点：\n  ${failures.join('\n  ')}`,
  );
}

/**
 * 在一行集合里找出唯一匹配的行号，匹配数不是 1 就抛错。
 * 这是本脚本的安全阀：dsh 升级后若这段代码被改写，宁可直接失败，也不要改错地方。
 * @param {string[]} lines 文件按行切分的结果
 * @param {(line: string, index: number) => boolean} test 行判定
 * @param {string} what 锚点的中文描述，用于报错
 * @returns {number} 行号（0 基）
 */
function findLine(lines, test, what) {
  const hits = [];
  lines.forEach((line, index) => {
    if (test(line, index)) hits.push(index);
  });
  if (hits.length !== 1) {
    throw new Error(`锚点「${what}」匹配到 ${hits.length} 处，期望恰好 1 处；DSH 可能已升级并改写了这段代码，请重新核对补丁`);
  }
  return hits[0];
}

/**
 * 找出某个 JSX 属性里 children 那一行。
 * 模型名文案在按钮和菜单根面板各出现一次，只靠自身内容区分不了，所以用上一行的 className 定位。
 * @param {string[]} lines 文件行
 * @param {string} className 上一行里应当出现的 CSS module 类名
 * @param {(line: string) => boolean} contentTest children 行自身要满足的条件
 * @returns {number} 行号（0 基）
 */
function findChildrenLine(lines, className, contentTest) {
  return findLine(
    lines,
    (line, index) => contentTest(line) && index > 0 && lines[index - 1].includes(`css_default.${className}`),
    `${className} 的 children`,
  );
}

/** 取一行的前导空白，插入新行时沿用同一缩进。 */
function indentOf(line) {
  return line.slice(0, line.length - line.trimStart().length);
}

/**
 * 施加补丁：只做文本级替换，任何锚点缺失都抛错。
 * 先算出全部行号再自下而上落笔，避免插入导致的行号位移。
 * @param {string} source 原始文件内容
 * @returns {string} 打补丁后的内容
 */
function applyPatch(source) {
  const lines = source.split('\n');

  const triggerLabelIndex = findLine(lines, (line) => line.includes(TRIGGER_LABEL_BEFORE), 'triggerLabel 定义');
  const triggerAriaIndex = findLine(
    lines,
    (line) => line.includes('const triggerAria = waiting ? t("trigger.loading")'),
    'triggerAria 定义',
  );
  const ariaModelIndex = triggerAriaIndex + 1;
  if (lines[ariaModelIndex].trim() !== `${ARIA_MODEL_BEFORE},`) {
    throw new Error(`锚点「triggerAria 里的 model 字段」不匹配，实际读到：${lines[ariaModelIndex]}`);
  }
  const triggerChildrenIndex = findChildrenLine(lines, 'triggerLabel', (line) => line.trim() === 'children: modelLabel');
  const cellChildrenIndex = findChildrenLine(lines, 'cellValue', (line) => line.trim() === 'children: modelLabel');

  // 新常量与 triggerLabel 一起落笔：常量在前（triggerLabel 会引用它，const 有暂时性死区）
  const indent = indentOf(lines[triggerLabelIndex]);
  const edits = [
    {
      index: triggerLabelIndex,
      kind: 'replace',
      text: [...INSERTED_LINES.map((line) => `${indent}${line}`), `${indent}${TRIGGER_LABEL_AFTER}`].join('\n'),
    },
    {
      index: ariaModelIndex,
      kind: 'replace',
      text: `${indentOf(lines[ariaModelIndex])}${ARIA_MODEL_AFTER},`,
    },
    {
      index: triggerAriaIndex,
      kind: 'replace',
      text: lines[triggerAriaIndex].split(ARIA_MODEL_BEFORE).join(ARIA_MODEL_AFTER),
    },
    {
      index: triggerChildrenIndex,
      kind: 'replace',
      text: `${indentOf(lines[triggerChildrenIndex])}${TRIGGER_CHILDREN_PATCHED}`,
    },
    {
      index: cellChildrenIndex,
      kind: 'replace',
      text: `${indentOf(lines[cellChildrenIndex])}${CELL_CHILDREN_PATCHED}`,
    },
  ];

  for (const edit of edits.sort((left, right) => right.index - left.index)) {
    if (edit.kind === 'replace') lines[edit.index] = edit.text;
    else lines.splice(edit.from, edit.to - edit.from + 1);
  }
  return lines.join('\n');
}

/**
 * 撤销补丁：与 applyPatch 完全对称的逆操作。
 * 刻意不走备份文件——dsh 升级后备份是旧版本，还原回去只会制造更糟的错配。
 * @param {string} source 已打补丁的文件内容
 * @returns {string} 还原后的内容
 */
function revertPatch(source) {
  const lines = source.split('\n');

  const markerIndex = findLine(lines, (line) => line.includes(MARKER), '补丁标记');
  const modelAriaIndex = findLine(
    lines,
    (line) => line.includes('const modelAriaLabel = providerLabel === void 0'),
    'modelAriaLabel 定义',
  );
  const triggerLabelIndex = findLine(lines, (line) => line.includes(TRIGGER_LABEL_AFTER), '打补丁后的 triggerLabel');
  const triggerAriaIndex = findLine(
    lines,
    (line) => line.includes('const triggerAria = waiting ? t("trigger.loading")'),
    'triggerAria 定义',
  );
  const ariaModelIndex = triggerAriaIndex + 1;
  const triggerChildrenIndex = findChildrenLine(lines, 'triggerLabel', (line) => line.includes('providerLabel === void 0 ? modelLabel :'));
  const cellChildrenIndex = findChildrenLine(lines, 'cellValue', (line) => line.trim() === CELL_CHILDREN_PATCHED);

  const edits = [
    { index: triggerLabelIndex, kind: 'replace', text: `${indentOf(lines[triggerLabelIndex])}${TRIGGER_LABEL_BEFORE}` },
    { index: ariaModelIndex, kind: 'replace', text: `${indentOf(lines[ariaModelIndex])}${ARIA_MODEL_BEFORE},` },
    {
      index: triggerAriaIndex,
      kind: 'replace',
      text: lines[triggerAriaIndex].split(ARIA_MODEL_AFTER).join(ARIA_MODEL_BEFORE),
    },
    { index: triggerChildrenIndex, kind: 'replace', text: `${indentOf(lines[triggerChildrenIndex])}children: modelLabel` },
    { index: cellChildrenIndex, kind: 'replace', text: `${indentOf(lines[cellChildrenIndex])}children: modelLabel` },
    { index: markerIndex, kind: 'remove-range', from: markerIndex, to: modelAriaIndex },
  ];

  for (const edit of edits.sort((left, right) => right.index - left.index)) {
    if (edit.kind === 'replace') lines[edit.index] = edit.text;
    else lines.splice(edit.from, edit.to - edit.from + 1);
  }
  return lines.join('\n');
}

/** 读取命令行里的 --target 值。 */
function targetFromArgv(argv) {
  const at = argv.indexOf('--target');
  if (at === -1) return undefined;
  const value = argv[at + 1];
  if (value === undefined || value.startsWith('--')) throw new Error('--target 后面要跟 client.js 的路径');
  return value;
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const revert = argv.includes('--revert');
  const target = targetFromArgv(argv) ?? resolveTarget();

  if (!existsSync(target)) throw new Error(`目标文件不存在：${target}`);
  const source = readFileSync(target, 'utf8');
  const patched = source.includes(MARKER);

  console.log(`目标文件：${target}`);
  console.log(`当前状态：${patched ? '已打补丁' : '未打补丁'}`);
  if (check) return;

  if (revert) {
    if (!patched) {
      console.log('无需撤销。');
      return;
    }
    writeFileSync(target, revertPatch(source));
    console.log('已撤销补丁，刷新页面即可恢复原样。');
    return;
  }

  if (patched) {
    console.log('已经打过补丁，跳过。');
    return;
  }
  const backup = `${target}${BACKUP_SUFFIX}`;
  if (!existsSync(backup)) copyFileSync(target, backup);
  writeFileSync(target, applyPatch(source));
  console.log(`已打补丁。原始副本：${backup}`);
  console.log('刷新浏览器页面（或重启 Dsh Desktop）即可看到「供应商 · 模型名 · 推理等级」。');
}

main();
