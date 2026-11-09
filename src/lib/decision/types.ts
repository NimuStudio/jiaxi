/**
 * TypeSafe /v1/systemone 协议类型（typed decision model）
 *
 * 与 llama.cpp 的 server-decision.h 对齐：一次前向回答所有 question，不生成任何 token。
 * 三种原语：
 *  - choice：从若干选项中选一个，返回各选项概率
 *  - score ：在有序档位上打分，返回期望档位（可以是小数）
 *  - noul ：判断真假，返回为真的概率
 *
 * 为什么用这个而不是让模型「写一段话」：
 *  1. 输出天然合法，不需要再解析模型措辞；
 *  2. 带概率，能把「我不确定」表达出来，用来触发追问而不是硬判；
 *  3. 可评测（准确率 + 校准），评委能复算。
 */

export type QuestionType = "choice" | "score" | "noul";

export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  /** 选项 → 描述（可为 null），顺序即模型输出顺序 */
  criteria: Record<string, string | null>;
}

export interface ScoreQuestion {
  type: "score";
  instructions: string;
  /** 2 到 10 档，最低档在前 */
  criteria: string[];
}

export interface NoulQuestion {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
}

export type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion;

export interface SystemOneRequest {
  state: string | Record<string, unknown> | unknown[];
  questions: Record<string, Question>;
}

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface ScoreAnswer {
  type: "score";
  score: number;
  legend: string[];
  probabilities: number[];
  confidence: number;
}

export interface NoulAnswer {
  type: "noul";
  noul: number;
}

export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export interface SystemOneResponse {
  model: string;
  answers: Record<string, Answer>;
  usage?: { input_tokens: number; output_tokens: number };
}
