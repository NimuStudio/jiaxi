"use client";

import { useMemo, useState } from "react";
import { DISEASES } from "@/lib/extract/lexicon";
import { GlassModal } from "@/components/ui/GlassModal";

/**
 * 疾病清单弹层：告诉用户「哪些说法系统能听懂」。
 *
 * 为什么要这个入口：抽取链路认的是词表里的病名与口语别名，
 * 用户不知道词表范围时，容易说出漏网的表述（历史案例：
 * 「癌症」泛称曾整句漏识别）。与其让用户猜，不如把清单给他看。
 *
 * 数据全部从词表派生（唯一数据源）：分组来自 category，
 * 每个病展示规范名 + 口语说法。other 不展示（category 为空）。
 */

/** 别名最多展示前 4 个：足够提示「这样说也行」，又不至于读不动。 */
const MAX_ALIASES = 4;

const RELATION_HINTS = [
  "我爸 52 岁那年放了心脏支架",
  "我老娘是脑溢血走的",
  "外婆和姨妈都有乳腺癌",
  "我舅舅 45 岁查出糖尿病",
];

export function DiseaseCheatSheet() {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, typeof DISEASES>();
    for (const d of DISEASES) {
      if (!d.category) continue; // other 不进清单
      const list = map.get(d.category) ?? [];
      list.push(d);
      map.set(d.category, list);
    }
    return [...map.entries()];
  }, []);

  const total = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <>
      <button
        type="button"
        className="cheat-link"
        onClick={() => setOpen(true)}
      >
        不知道说哪些病？看能识别的 {total} 种疾病
      </button>

      <GlassModal
        open={open}
        onClose={() => setOpen(false)}
        kicker="AI 能听懂的说法"
        title="能识别的疾病清单"
        footer={
          <button
            type="button"
            className="gmodal-confirm"
            onClick={() => setOpen(false)}
          >
            知道了
          </button>
        }
      >
        <p className="cheat-intro">
          说出<b>病名</b>和<b>哪位亲属</b>就行，例如「我爷爷有糖尿病」。
          下面的口语说法都能直接用；清单外的病名说出来也会记成
          「其他」，不会丢，只是不会细分。
        </p>

        <div className="cheat-groups">
          {groups.map(([category, list], gi) => (
            <section key={category} className="cheat-group">
              <h3 className="cheat-group-title">{category}</h3>
              <div className="cheat-rows">
                {list.map((d, i) => (
                  <div
                    key={d.code}
                    className="cheat-row"
                    style={{ animationDelay: `${(gi * 3 + i) * 25}ms` }}
                  >
                    <span className="cheat-name">{d.label}</span>
                    {d.nounAliases.length > 0 && (
                      <span className="cheat-aliases">
                        {d.nounAliases
                          .filter((a) => a !== d.label)
                          .slice(0, MAX_ALIASES)
                          .map((a) => (
                            <span key={a} className="cheat-alias">
                              {a}
                            </span>
                          ))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="cheat-examples">
          <p className="cheat-examples-title">照这样说就可以</p>
          {RELATION_HINTS.map((ex) => (
            <p key={ex} className="cheat-example">
              「{ex}」
            </p>
          ))}
        </div>
      </GlassModal>
    </>
  );
}
