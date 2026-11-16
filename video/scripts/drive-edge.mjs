// 驱动一个「可见的」Edge 窗口演一遍真实操作，供 gdigrab 录屏。
// 用法：node scripts/drive-edge.mjs [port]
import WS from "../node_modules/.pnpm/ws@8.21.0/node_modules/ws/index.js";

const PORT = process.argv[2] || 9222;
const BASE = "http://127.0.0.1:5173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch("http://127.0.0.1:" + PORT + "/json/list");
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page;
    } catch (e) {}
    await sleep(500);
  }
  throw new Error("CDP target 没等到");
}

class CDP {
  constructor(url) {
    this.ws = new WS(url);
    this.id = 0;
    this.pending = new Map();
    this.ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg);
        this.pending.delete(msg.id);
      }
    });
  }
  open() {
    return new Promise((res) => this.ws.on("open", res));
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((res) => {
      this.pending.set(id, res);
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  }
  async go(url) {
    await this.send("Page.navigate", { url });
    await sleep(1800);
  }
  async clickText(text) {
    const expr =
      "(() => { const el = [...document.querySelectorAll(\"button,a\")]" +
      ".find(e => (e.innerText||\"\").includes(" + JSON.stringify(text) + "));" +
      " if (!el) return false; el.click(); return true; })()";
    return this.eval(expr);
  }
  async typeInto(selector, text) {
    await this.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (el) el.focus(); })()");
    await sleep(300);
    for (const ch of text) {
      await this.send("Input.insertText", { text: ch });
      await sleep(45);
    }
  }
}

const main = async () => {
  const t = await target();
  const cdp = new CDP(t.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  console.log("→ 打开梳理家系");
  await cdp.go(BASE + "/chat?demo=1");
  await sleep(3000);

  console.log("→ 输入口述");
  await cdp.typeInto("input", "我妈高血压，我舅舅糖尿病，我外公脑溢血");
  await sleep(1200);

  console.log("→ 点记下");
  await cdp.clickText("记下");
  await sleep(9000);

  console.log("→ 心血管风险");
  await cdp.go(BASE + "/cvd?demo=1");
  await sleep(7000);

  console.log("→ 可回收");
  await cdp.go(BASE + "/?demo=1");
  await sleep(4000);
  await cdp.eval("window.scrollTo({top: 620, behavior: \"smooth\"})");
  await sleep(6000);
  await cdp.eval("window.scrollTo({top: 900, behavior: \"smooth\"})");
  await sleep(5000);

  console.log("✓ 演示完成");
  process.exit(0);
};

main().catch((e) => {
  console.error("驱动失败:", e.message);
  process.exit(1);
});