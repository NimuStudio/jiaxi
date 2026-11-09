import { describe, expect, it } from "vitest";
import { validateAnswers } from "./client.ts";
import type { SystemOneRequest } from "./types.ts";
import {
  buildHereditaryQuestion,
  decideHereditary,
  MODE_LABEL,
  ruleDecision,
  structuralFacts,
} from "./hereditary.ts";
import type { ExtractedPerson } from "../extract/client.ts";

function person(relation: string, sex: ExtractedPerson["sex"], codes: string[] = []): ExtractedPerson {
  return {
    relation,
    sex,
    conditions: codes.map((code) => ({ code, onsetAge: null })),
  };
}

const tree: ExtractedPerson[] = [
  person("father", "male", ["myocardial-infarction"]),
  person("paternal-grandfather", "male", ["myocardial-infarction"]),
  person("mother", "female", []),
];

const okAnswer = {
  model: "openjev",
  answers: {
    "hereditary-mode": {
      type: "choice" as const,
      choice: "autosomal-dominant",
      probabilities: {
        "autosomal-dominant": 0.82,
        "autosomal-recessive": 0.06,
        "x-linked": 0.05,
        mitochondrial: 0.02,
        insufficient: 0.05,
      },
      confidence: 0.74,
    },
  },
};

function mockFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("buildHereditaryQuestion", () => {
  it("五个选项齐全，state 带上关系/性别/病种", () => {
    const req = buildHereditaryQuestion(tree);
    const q = req.questions["hereditary-mode"];
    expect(q?.type).toBe("choice");
    expect(Object.keys((q as { criteria: object }).criteria)).toEqual([
      "autosomal-dominant",
      "autosomal-recessive",
      "x-linked",
      "mitochondrial",
      "insufficient",
    ]);
    expect(Array.isArray(req.state)).toBe(true);
    expect((req.state as Array<{ relation: string }>)[0]?.relation).toBe("father");
  });
});

describe("validateAnswers", () => {
  const req: SystemOneRequest = {
    state: "x",
    questions: {
      q1: { type: "choice", instructions: "", criteria: { a: null, b: null } },
    },
  };

  it("正常答案通过", () => {
    expect(() =>
      validateAnswers(req, {
        model: "m",
        answers: { q1: { type: "choice", choice: "a", probabilities: { a: 0.7, b: 0.3 }, confidence: 0.4 } },
      }),
    ).not.toThrow();
  });

  it("choice 不在候选里要报错", () => {
    expect(() =>
      validateAnswers(req, {
        model: "m",
        answers: { q1: { type: "choice", choice: "c", probabilities: { a: 0.7, b: 0.3 }, confidence: 0.4 } },
      }),
    ).toThrow(/不在候选/);
  });

  it("概率和不为 1 要报错（防止上层拿假结论做医疗判断）", () => {
    expect(() =>
      validateAnswers(req, {
        model: "m",
        answers: { q1: { type: "choice", choice: "a", probabilities: { a: 0.9, b: 0.9 }, confidence: 0.4 } },
      }),
    ).toThrow(/概率和/);
  });
});

describe("decideHereditary", () => {
  it("高置信度直接采信模型结论", async () => {
    const d = await decideHereditary(tree, { baseUrl: "http://x", fetchImpl: mockFetch(okAnswer) });
    expect(d.source).toBe("model");
    expect(d.mode).toBe("autosomal-dominant");
    expect(d.confidence).toBeCloseTo(0.74, 2);
  });

  it("置信度不足时降级成「证据不足」，但保留模型原始倾向", async () => {
    const low = JSON.parse(JSON.stringify(okAnswer));
    low.answers["hereditary-mode"].confidence = 0.41;
    const d = await decideHereditary(tree, { baseUrl: "http://x", fetchImpl: mockFetch(low) });
    expect(d.mode).toBe("insufficient");
    expect(d.rawMode).toBe("autosomal-dominant");
    expect(d.reason).toMatch(/置信度/);
  });

  it("服务端不是决策模型（501）时退回结构事实", async () => {
    const d = await decideHereditary(tree, {
      baseUrl: "http://x",
      fetchImpl: mockFetch({ error: "not a decision model" }, 501),
    });
    expect(d.source).toBe("rules");
    expect(d.mode).toBe("insufficient");
    expect(d.reason).toContain("亲属");
  });

  it("没配服务地址时直接走兜底，不发请求", async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response("{}");
    }) as unknown as typeof fetch;
    const d = await decideHereditary(tree, { baseUrl: "", fetchImpl: spy });
    expect(called).toBe(false);
    expect(d.source).toBe("rules");
  });
});

describe("兜底文案", () => {
  it("没有患病亲属时说清楚", () => {
    expect(structuralFacts([person("father", "male")])).toContain("患病信息");
  });

  it("缺发病年龄 / 性别单一时给出理由", () => {
    const facts = structuralFacts([person("father", "male", ["diabetes"])]);
    expect(facts).toContain("缺发病年龄");
    expect(facts).toContain("性别单一");
  });

  it("ruleDecision 永远不给具体模式", () => {
    expect(ruleDecision(tree).mode).toBe("insufficient");
    expect(ruleDecision(tree).confidence).toBe(0);
  });

  it("五个模式都有中文名", () => {
    for (const k of Object.keys(MODE_LABEL)) expect(MODE_LABEL[k as keyof typeof MODE_LABEL]).toBeTruthy();
  });
});
