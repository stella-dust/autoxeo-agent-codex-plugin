#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const target = process.argv[2];
if (!target) throw new Error("Usage: validate-questions.mjs <questions.json>");
const input = JSON.parse(await readFile(target, "utf8"));
const questions = Array.isArray(input) ? input : input.questions;
if (!Array.isArray(questions) || questions.length === 0) throw new Error("questions must be a non-empty array");
if (questions.length > 200) throw new Error("questions must contain at most 200 items");
if (!Array.isArray(input) && input.methodVersion !== "geo-question-method-2026-08") throw new Error("methodVersion must be geo-question-method-2026-08");

const allowedIntents = new Set(["awareness", "consideration", "comparison", "decision", "validation"]);
const allowedTypes = new Set(["decision", "open", "recommendation", "negative", "comparison"]);
const allowedMentions = new Set(["required", "excluded", "natural"]);
const allowedEvidence = new Set(["A", "B", "C"]);
const typeCounts = Object.fromEntries([...allowedTypes].map((value) => [value, 0]));
const ids = new Set();
const texts = new Set();
for (const [index, item] of questions.entries()) {
  if (!item || typeof item !== "object") throw new Error(`question ${index + 1} must be an object`);
  if (typeof item.id !== "string" || !item.id) throw new Error(`question ${index + 1} needs id`);
  if (ids.has(item.id)) throw new Error(`duplicate id: ${item.id}`);
  ids.add(item.id);
  if (typeof item.text !== "string" || item.text.trim().length < 5 || item.text.trim().length > 240) throw new Error(`invalid text length: ${item.id}`);
  const normalized = item.text.replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
  if (texts.has(normalized)) throw new Error(`duplicate question text: ${item.id}`);
  texts.add(normalized);
  if (!allowedIntents.has(item.intent)) throw new Error(`invalid intent: ${item.id}`);
  if (typeof item.persona !== "string" || !item.persona.trim()) throw new Error(`missing persona: ${item.id}`);
  if (!allowedTypes.has(item.questionType)) throw new Error(`invalid questionType: ${item.id}`);
  if (!allowedMentions.has(item.brandMention)) throw new Error(`invalid brandMention: ${item.id}`);
  if (!allowedEvidence.has(item.evidenceTier)) throw new Error(`invalid evidenceTier: ${item.id}`);
  typeCounts[item.questionType] += 1;
}
const distribution = Object.fromEntries(Object.entries(typeCounts).map(([key, value]) => [key, Number((value / questions.length).toFixed(3))]));
process.stdout.write(`${JSON.stringify({ valid: true, count: questions.length, distribution })}\n`);
