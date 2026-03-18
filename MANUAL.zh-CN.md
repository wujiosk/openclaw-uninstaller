# claw 中文小白手册

## 1. 这是什么

`claw` 是一个命令行 AI 助手原型。

你可以把它理解成一个在终端里运行的聊天工具。它现在有三种常见用法：

- `agent`：进入聊天模式，像和机器人对话一样一直聊
- `message`：只问一次，输出一次结果就结束
- `gateway`：启动一个本地接口，让别的软件来调用它

---

## 2. 你刚才为什么“不会用”

你刚才这样操作了：

```bash
node src/index.mjs agent
```

进入 `agent` 模式后，屏幕上会出现：

```bash
you>
```

这表示程序已经进入聊天状态了。

这时候你输入的任何内容，都会被当成“你对 AI 说的话”。

所以你在里面输入：

```bash
node src/index.mjs message "你好"
```

程序不会把它当成新的系统命令执行，而是会把它当成一段普通聊天内容，所以它才会回复：

“Echo: node src/index.mjs message "你好"”

这不是报错，而是你把“命令”输到了“聊天框”里。

---

## 3. 最重要的一条

`you>` 后面是聊天区，不是命令行。

如果你想执行新命令，先输入：

```bash
/exit
```

退出 `agent`，回到正常的 Windows 命令行，再输入别的命令。

---

## 4. 最简单的三种正确用法

### 用法 A：进入连续聊天模式

在 `E:\claw` 目录里执行：

```bash
node src/index.mjs agent
```

然后你会看到：

```bash
claw agent ready on provider: mock
Commands: /help /clear /exit

you>
```

这时你就可以直接输入：

```bash
你好
```

或者：

```bash
帮我写一个 Python 冒泡排序
```

或者：

```bash
解释一下什么是 JavaScript Promise
```

输入后按回车，它就会回复你。

### 用法 B：只问一次，不进入聊天

如果你只想问一句，不想进入 `you>` 聊天界面，就执行：

```bash
node src/index.mjs message "你好"
```

它会直接输出一条结果，然后命令结束。

这是“单次提问模式”。

### 用法 C：启动本地接口

如果以后你想让别的软件、脚本或前端页面调用它，就执行：

```bash
node src/index.mjs gateway
```

启动后它会显示类似：

```bash
gateway listening at http://127.0.0.1:8787
```

这表示本地接口已经启动成功。

---

## 5. 给完全新手的推荐顺序

请你按这个顺序使用：

### 第一步：先看帮助

```bash
node src/index.mjs --help
```

### 第二步：试一次单次提问

```bash
node src/index.mjs message "你好"
```

### 第三步：再进入聊天模式

```bash
node src/index.mjs agent
```

然后在 `you>` 后面输入：

```bash
你好
```

### 第四步：退出聊天模式

```bash
/exit
```

---

## 6. agent 模式里能输入什么

进入：

```bash
node src/index.mjs agent
```

后，`you>` 后面有两类输入。

### 第一类：普通聊天内容

比如：

```bash
你好
```

```bash
给我写一个 HTML 页面
```

```bash
帮我解释这段代码
```

这些都会被当成你对 AI 说的话。

### 第二类：程序内置命令

目前有这几个：

```bash
/help
```

显示帮助。

```bash
/clear
```

清空当前对话记录。

```bash
/exit
```

退出聊天模式，回到 Windows 命令行。

---

## 7. 什么时候该输入 `/exit`

只要你想执行下面这种“系统命令”，就应该先退出：

```bash
node src/index.mjs message "你好"
```

```bash
node src/index.mjs gateway
```

```bash
dir
```

```bash
npm start
```

因为这些不是聊天内容，而是命令行命令。

---

## 8. 你当前看到的 `mock` 是什么意思

程序启动时显示：

```bash
claw agent ready on provider: mock
```

这里的 `mock` 意思是“模拟模型”。

它不是真的在调用 AI 大模型，只是为了让程序先跑起来，所以它会把你的话简单回显出来。

例如你输入：

```bash
你好
```

它可能回复：

```bash
This is a mock provider response. Echo: 你好 ...
```

这说明程序是通的，但还没有接上真正的大模型。

---

## 9. 如果你想接真实 AI 模型，怎么做

### 第一步：复制示例配置

把：

`claw.config.example.json`

复制成：

`claw.config.json`

### 第二步：修改 provider 类型

把里面这段：

```json
"provider": {
  "type": "mock",
  "model": "gpt-4.1-mini",
  "baseUrl": "https://api.openai.com/v1",
  "apiKeyEnv": "OPENAI_API_KEY"
}
```

改成：

```json
"provider": {
  "type": "openai-compatible",
  "model": "gpt-4.1-mini",
  "baseUrl": "https://api.openai.com/v1",
  "apiKeyEnv": "OPENAI_API_KEY"
}
```

### 第三步：设置环境变量

如果你用的是 Windows 命令行，可以临时这样设置：

```bash
set OPENAI_API_KEY=你的密钥
```

如果你用的是 PowerShell，可以这样设置：

```powershell
$env:OPENAI_API_KEY="你的密钥"
```

### 第四步：重新运行

```bash
node src/index.mjs message "你好"
```

如果配置正确，就会开始调用真实模型。

---

## 10. 常见错误对照表

### 错误 1：在 `you>` 里面输入系统命令

错误示例：

```bash
you> node src/index.mjs gateway
```

正确做法：

1. 先输入 `/exit`
2. 回到 `E:\claw>` 后再执行命令

### 错误 2：以为程序坏了，其实只是 mock 模式

如果你看到的是回显内容，不一定是坏了，通常只是还没接真实模型。

### 错误 3：没进入项目目录就执行命令

应该先进入：

```bash
E:\claw
```

再执行：

```bash
node src/index.mjs agent
```

### 错误 4：忘了设置 API Key

如果你切到真实模型但没设置密钥，程序会提示缺少环境变量。

---

## 11. 一套最适合你的实际演示

### 场景 1：我只想随便试试

执行：

```bash
node src/index.mjs message "你好"
```

### 场景 2：我想连续聊天

执行：

```bash
node src/index.mjs agent
```

然后输入：

```bash
你好
```

聊完后输入：

```bash
/exit
```

### 场景 3：我想让别的程序调用它

执行：

```bash
node src/index.mjs gateway
```

---

## 12. 以后我给你生成软件工程时，建议的使用方式

以后我帮你生成项目时，最适合的交付方式是这四样一起给你：

1. 可运行源码
2. 中文 README
3. 小白使用手册
4. 常见报错说明

这样你不需要猜怎么启动，也不容易把“聊天输入”和“系统命令”混在一起。

如果你愿意，我后面可以默认按这个标准给你交付。

---

## 13. 你现在最该怎么做

你可以直接照着下面操作：

### 只测试一次

```bash
cd /d E:\claw
node src/index.mjs message "你好"
```

### 连续聊天

```bash
cd /d E:\claw
node src/index.mjs agent
```

进入后只输入聊天内容，比如：

```bash
你好
```

退出时输入：

```bash
/exit
```

### 启动接口

```bash
cd /d E:\claw
node src/index.mjs gateway
```

---

## 14. 一句话记忆版

`E:\claw>` 是系统命令行。

`you>` 是和 AI 聊天的输入框。

系统命令不要输到 `you>` 里面。
