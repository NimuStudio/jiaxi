import { describe, expect, it } from "vitest";
import { questionTopic, topicCompatible, type KnowledgeEntry } from "./search";
import { sharesContentWord } from "@/lib/agent/loop";

const entry = (topic: "diabetes" | "ascvd" | "both", title: string): KnowledgeEntry => ({
  id: title,
  title,
  text: "",
  source: "x",
  tags: ["家族史"],
  topic,
});

describe("问题主题判定", () => {
  it("认得出糖代谢与心血管", () => {
    expect(questionTopic("我爷爷有糖尿病，家族史重要吗")).toBe("diabetes");
    expect(questionTopic("爸爸心梗了，我的心血管风险怎么算")).toBe("ascvd");
    expect(questionTopic("我该怎么办")).toBe("any");
  });
});

describe("主题门控", () => {
  const ascvdEntry = entry("ascvd", "心血管病家族史怎么进入 China-PAR 方程");
  const diabetesEntry = entry("diabetes", "为什么家族史是权重最高的一项");
  const bothEntry = entry("both", "为什么只给分层不给概率");

  it("糖代谢问题不得引用心血管条目", () => {
    expect(topicCompatible("我爷爷有糖尿病，家族史重要吗", ascvdEntry)).toBe(false);
    expect(topicCompatible("我爷爷有糖尿病，家族史重要吗", diabetesEntry)).toBe(true);
  });

  it("心血管问题不得引用糖代谢条目", () => {
    expect(topicCompatible("爸爸心梗了，心血管风险怎么算", diabetesEntry)).toBe(false);
  });

  it("both 与未限定主题的问题都放行", () => {
    expect(topicCompatible("爸爸心梗了，心血管风险怎么算", bothEntry)).toBe(true);
    expect(topicCompatible("我该怎么办", ascvdEntry)).toBe(true);
  });
});

describe("标题与问题的实词重合", () => {
  it("无关问题不共享实词", () => {
    expect(sharesContentWord("光合作用是什么", "FINDRISC 是什么")).toBe(false);
  });

  it("对题的短问题能共享实词（修掉误杀）", () => {
    expect(sharesContentWord("哪个条目分值最高", "为什么家族史是权重最高的一项")).toBe(true);
    expect(sharesContentWord("腰围怎么量", "腰围的男女不同阈值")).toBe(true);
  });
});
