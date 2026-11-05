import { describe, expect, it } from "vitest";
import {
  hasIllnessHint,
  hasDiseaseWord,
  looksRelevant,
  splitSegments,
} from "./client";

/**
 * 预筛规则的回归测试。
 *
 * 背景：早期版本预筛只认词表，词表外的病名（如「癌症」泛称）整句被丢弃，
 * 模型根本没有机会参与判断——用户原话「我爸爸30岁有癌症」直接返回
 * 「没有识别出患病的亲属」。修复后的原则：规则只拦纯闲聊，
 * 可疑片段一律放行，判断权交给模型，幻觉由证据校验兜底。
 */
describe("抽取预筛（looksRelevant / splitSegments）", () => {
  it("泛称「癌症」在词表内，直接命中", () => {
    expect(hasDiseaseWord("我爸爸30岁有癌症")).toBe(true);
    expect(looksRelevant("我爸爸30岁有癌症")).toBe(true);
  });

  it("词表外病名但带称谓和疾病指示词，必须放行给模型", () => {
    // 「肝硬化」不在词表——靠指示词兜住，不能像旧版那样整句丢弃
    expect(hasDiseaseWord("我三叔有肝硬化")).toBe(false);
    expect(hasIllnessHint("我三叔有肝硬化")).toBe(true);
    expect(looksRelevant("我三叔有肝硬化")).toBe(true);
  });

  it("治疗/结局类口语也算疾病指示", () => {
    for (const seg of [
      "我三叔在做化疗",
      "我爷爷没熬过去",
      "我爸住过院",
      "我姥姥前年走的",
    ]) {
      expect(looksRelevant(seg), seg).toBe(true);
    }
  });

  it("纯健康表述仍然过滤，不浪费模型调用也不给幻觉机会", () => {
    for (const seg of ["我妈身体还行", "我爸查过没事", "我妈那边"]) {
      expect(looksRelevant(seg), seg).toBe(false);
    }
  });

  it("「我爸爸30岁有癌症，我妈身体还行」→ 只抽出癌症那半句", () => {
    expect(splitSegments("我爸爸30岁有癌症，我妈身体还行")).toEqual([
      "我爸爸30岁有癌症",
    ]);
  });

  it("词表外病名片段是独立主语，不能当_prefix拼进下一句张冠李戴", () => {
    // 「我三叔有肝硬化」与后面的糖尿病句是两个人，
    // 若它被当成无病名前缀拼给下一句，糖尿病会记到三叔头上。
    const segs = splitSegments("我三叔有肝硬化，我姥姥有糖尿病");
    expect(segs).toEqual(["我三叔有肝硬化", "我姥姥有糖尿病"]);
  });

  it("无称谓的疾病续句仍合并到上一句（主语继承）", () => {
    expect(splitSegments("我奶奶高血压，后来中风了")).toEqual([
      "我奶奶高血压，后来中风了",
    ]);
  });
});
