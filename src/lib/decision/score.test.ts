import { describe, expect, it } from "vitest";
import { scoreChoice, ScoringUnavailable } from "./score.ts";

/** 造一个 llama.cpp /v1/completions 的 logprobs 响应 */
function mockLogprobs(entries: Array<[string, number]>): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            logprobs: {
              content: [{ top_logprobs: entries.map(([token, logprob]) => ({ token, logprob })) }],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as unknown as typeof fetch;
}

const OPTIONS = [
  { key: "autosomal-dominant", probe: "显性" },
  { key: "autosomal-recessive", probe: "隐性" },
  { key: "x-linked", probe: "X连锁" },
  { key: "mitochondrial", probe: "线粒体" },
  { key: "insufficient", probe: "不确定" },
];

describe("scoreChoice", () => {
  it("把 logprob 归一化成概率并选出最大项", async () => {
    const r = await scoreChoice("家系……", OPTIONS, {
      baseUrl: "http://x",
      fetchImpl: mockLogprobs([
        ["显", -0.2],
        ["隐", -2.1],
        ["X", -3.0],
        ["线", -3.4],
        ["不", -1.4],
      ]),
    });
    expect(r.choice).toBe("autosomal-dominant");
    const sum = Object.values(r.probabilities).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(r.probabilities["autosomal-dominant"]).toBeGreaterThan(0.5);
    expect(r.confidence).toBeCloseTo(r.probabilities["autosomal-dominant"]!, 6);
  });

  it("某个答案词没进候选时按最低值再降一档处理，不报错", async () => {
    const r = await scoreChoice("家系……", OPTIONS, {
      baseUrl: "http://x",
      fetchImpl: mockLogprobs([
        ["显", -0.1],
        ["隐", -1.0],
      ]),
    });
    expect(r.probabilities["mitochondrial"]).toBeLessThan(r.probabilities["autosomal-recessive"]!);
    expect(Object.values(r.probabilities).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it("首字相同会串味，所以选项词必须首字互不相同（本用例锁定该约束）", async () => {
    const heads = OPTIONS.map((o) => o.probe.slice(0, 1));
    expect(new Set(heads).size).toBe(OPTIONS.length);
  });

  it("没有配置地址时抛 ScoringUnavailable", async () => {
    await expect(scoreChoice("x", OPTIONS, {})).rejects.toBeInstanceOf(ScoringUnavailable);
  });

  it("服务返回空 top_logprobs 时抛 ScoringUnavailable（交给上层兜底）", async () => {
    await expect(
      scoreChoice("x", OPTIONS, { baseUrl: "http://x", fetchImpl: mockLogprobs([]) }),
    ).rejects.toBeInstanceOf(ScoringUnavailable);
  });

  it("HTTP 非 2xx 时抛 ScoringUnavailable", async () => {
    const bad = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
    await expect(scoreChoice("x", OPTIONS, { baseUrl: "http://x", fetchImpl: bad })).rejects.toBeInstanceOf(
      ScoringUnavailable,
    );
  });
});
