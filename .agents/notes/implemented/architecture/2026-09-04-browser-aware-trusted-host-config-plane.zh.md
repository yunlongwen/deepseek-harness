# Agent Note: 浏览器感知的可信宿主配置面

Status: implemented

[English](2026-09-04-browser-aware-trusted-host-config-plane.md) | 中文

## 问题

`dsh web --trusted-host harness.example` 声明 `harness.example` 为受信任 authority，使被服务的页面可通过[浏览器请求信任 fence](2026-07-28-api-browser-trust-boundary.zh.md) 与[浏览器令牌认证](2026-08-24-browser-token-authentication.zh.md)访问完整 Host API。服务器半侧接受了该 authority，但浏览器半侧仍仅凭 `isLoopback` 判定可达性——它读取页面 URL 的 hostname 与传输拥有者标志。在 `harness.example` 上服务的页面读到 `isLoopback === false`，于是 `ui-settings` 选择了进程内 `memory` 持久化，从不调用 `settings/describe`；`ui-settings-general` 也收起了 Host 文档操作。受信任部署因此失去了操作者本意要访问的配置面，而 loopback 部署行为不变。

服务器 fence 单独无法修复：它按请求回答，而设置面在激活时（任何请求之前）一次性决定模式，依据的是浏览器侧的可达性事实。

## 决策

`dsh-client-connection` 把部署配置的 authority 镜像进浏览器，并把配置面可达性与 loopback 所有权分开报告。

节点半把解析后的 `trustedHosts` 数组按原样作为 `__DSH_TRUSTED_HOSTS__` 页面全局，通过既有的 `webserver/index-inject` 行（kind `global`）推送——与注入 `window.__DSH_BOOT__` 的机制相同。浏览器半读取该全局并推导 `ctx.connection.configAccessible`：当页面 authority 是 loopback、传输声明页面持有 Host、或页面 authority 匹配声明受信任的条目（采用与 Host fence 相同的 WHATWG 归一化比较：无端口条目在任意端口上匹配该 hostname；带端口条目精确匹配该 authority）时为 true。全局缺失或畸形时页面保持不受信任，与未配置 `trustedHosts` 的空授权默认一致。`ctx.remote.$host.configAccessible` 在固定 Host facts 上暴露同一事实。

设置面把模式判定从 `isLoopback` 切换到 `configAccessible`：`ui-settings` 在配置面可达时选择 `host` 持久化；`ui-settings-general` 在同一条件下挂载 Host 文档操作。Host 原生桌面操作——`ui-deliverables` 中的打开文件或目录——继续读取 `isLoopback`，仍保持 loopback-only：被服务的可信页面依然不得直接触及操作者的文件系统。

服务器 fence 不变。浏览器要访问配置面仍需成功的浏览器会话（没有有效 cookie 时 `settings/describe` 等返回 401），因此 `configAccessible` 只决定设置面启动进入哪种模式，并不授予 fence 会拒绝的任何东西。

## 验证

单元覆盖固定 `isTrustedAuthority` 匹配（无端口与带端口条目、大小写不敏感、畸形条目、空信任）、节点半对已配置与空信任全局的 index 注入、浏览器半在 loopback/声明 authority/不受信任/缺失或畸形全局各情形下对 `configAccessible` 的推导，以及 gateway `$host` 对该事实的投影。设置套件固定配置面不可达时的 memory 模式回退，以及可信 authority 上 Host 文档的可用性。

## 备选方案

**把 Host 方法列表拆成配置面与原生桌面两层并分别加 fence。** master 已用统一浏览器认证取代按方法的 loopback 列表，按方法在浏览器侧拆分会在服务器端无对应物的情况下重新引入第二套 authority 模型。浏览器侧的可达性事实已足够：真正的授权由 fence 强制执行，仅 loopback 的 `isLoopback` 消费方保留既有 loopback 门。

**在选择设置模式前往返一次可达性探测。** 设置激活必须同步且免请求；探测会与激活竞争，并为页面生命周期内固定的模式增加一次线读取。注入的全局无需往返即携带相同信息。

## 后果

声明了 `trustedHosts` 的非 loopback 部署会把设置面启动进 host 支撑的文档，并显示 Host 文档操作，从而弥合 fence 接受该 authority 与浏览器可达性模型之间的缺口。注入的全局是公开页面内容（与 `__DSH_BOOT__` 相同），仅随部署配置变化；它不会授予 fence 与浏览器会话已允许之外的任何东西。未被部署声明的页面上设置仍保持进程内，保留不受信任浏览上下文下的 memory 模式行为。
