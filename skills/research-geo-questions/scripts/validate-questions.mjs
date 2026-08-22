#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const target = process.argv[2];
if (!target) throw new Error("Usage: validate-questions.mjs <questions.json>");
const input = JSON.parse(await readFile(target, "utf8"));
const questions = Array.isArray(input) ? input : input.questions;
if (!Array.isArray(questions) || questions.length === 0) throw new Error("questions must be a non-empty array");
if (questions.length > 100) throw new Error("questions must contain at most 100 items");

const allowedIntents = new Set(["awareness", "consideration", "comparison", "decision", "validation"]);
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
}
process.stdout.write(`${JSON.stringify({ valid: true, count: questions.length })}\n`);
