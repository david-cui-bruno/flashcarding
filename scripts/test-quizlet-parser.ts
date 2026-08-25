import assert from "node:assert/strict";
import { parseQuizletExport } from "../lib/import/quizlet";

function cards(input: string, options?: Parameters<typeof parseQuizletExport>[1]) {
  return parseQuizletExport(input, options).cards;
}

{
  const result = parseQuizletExport("hola\thello\ngracias\tthank you");
  assert.equal(result.cards.length, 2);
  assert.deepEqual(result.cards[0], { term: "hola", definition: "hello" });
  assert.deepEqual(result.cards[1], { term: "gracias", definition: "thank you" });
  assert.deepEqual(result.issues, []);
}

assert.deepEqual(cards("photon,a quantum of light\nion,charged atom", { termSeparator: "," }), [
  { term: "photon", definition: "a quantum of light" },
  { term: "ion", definition: "charged atom" },
]);

assert.deepEqual(cards("term::definition||next::other", { termSeparator: "::", rowSeparator: "||" }), [
  { term: "term", definition: "definition" },
  { term: "next", definition: "other" },
]);

assert.deepEqual(cards('"photosynthesis"\t"uses CO2\nand water"\n"mitosis"\t"cell division"'), [
  { term: "photosynthesis", definition: "uses CO2\nand water" },
  { term: "mitosis", definition: "cell division" },
]);

assert.deepEqual(cards("uno\tone\r\ndos\ttwo\r\n\r\n"), [
  { term: "uno", definition: "one" },
  { term: "dos", definition: "two" },
]);

{
  const result = parseQuizletExport("");
  assert.equal(result.cards.length, 0);
  assert.equal(result.issues[0]?.code, "empty_input");
}

{
  const result = parseQuizletExport("hola hello\ngracias thank you");
  assert.equal(result.cards.length, 0);
  assert.equal(result.issues[0]?.code, "single_column");
  assert.match(result.issues[0]?.message ?? "", /separator/i);
}
