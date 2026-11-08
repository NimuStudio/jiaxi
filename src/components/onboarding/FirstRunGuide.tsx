"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 首次进入的引导。
 *
 * 之前的问题：用户登录后直接落在「糖尿病风险」页，第一眼看到的是固定示例档案的
 * 33% —— 既不知道这是自己的还是别人的，也不知道这个项目到底做什么。
 * 这块把「是什么、分几步、从哪开始」放在最前面，看过一次就不再打扰。
 */

const STORAGE_KEY = "pedigree-guide-seen";

const STEPS = [
  {
    n: "01",
    title: "说出家里人的病史",
    desc: "一句话就行，不用按顺序、不用说得清楚：「我爸 52 岁放了支架，我爷爷有糖尿病」。",
  },
  {
    n: "02",
    title: "自动画成家系图",
    desc: "抽成结构化家系，每个节点都能回看「这句话是从哪来的」，可以随时改。",
  },
  {
    n: "03",
    title: "算清哪部分能拿回来",
    desc: "糖尿病、心血管、肺癌三套模型各算一份风险，并拆出「改不了的」与「能拿回来的」。",
  },
];

export function FirstRunGuide({ demo }: { demo: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* 存不了就每次都显示，总比不显示好 */
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  const withDemo = (href: string) => (demo ? `${href}?demo=1` : href);

  return (
    <section className="guide" aria-label="使用引导">
      <div className="guide-head">
        <p className="guide-kicker">第一次来？三步就能走完</p>
        <button
          type="button"
          className="guide-dismiss"
          onClick={() => {
            setVisible(false);
            try {
              localStorage.setItem(STORAGE_KEY, "1");
            } catch {
              /* 忽略 */
            }
          }}
        >
          知道了
        </button>
      </div>

      <ol className="guide-steps">
        {STEPS.map((s) => (
          <li key={s.n} className="guide-step">
            <span className="guide-step-n">{s.n}</span>
            <div>
              <p className="guide-step-title">{s.title}</p>
              <p className="guide-step-desc">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="guide-actions">
        <Link className="guide-cta is-ghost" href={withDemo("/chat")}>
          开始：说说家里人的病史 →
        </Link>
        <span className="guide-hint">不注册也能试，手机和电脑上都能用</span>
      </div>
    </section>
  );
}
