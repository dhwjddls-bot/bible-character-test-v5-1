const assert = require("assert");
const fs = require("fs");
const path = require("path");

global.window = global;
[
  "data/characters.js",
  "data/characters-existing-metadata.js",
  "data/characters-expanded-a.js",
  "data/characters-expanded-b.js",
  "data/characters-expanded-c.js",
  "data/characters-expanded-d.js"
].forEach((file) => require(path.join(__dirname, "..", file)));

const dimensions = ["courage","empathy","planning","duty","emotion","leadership","faith","adapt","calm","justice","service","reflection"];
const required = ["id","name","subtitle","atlas","pos","profile","traits","mbti","enneagram","intro","story","relation","strength","shadow","pressure","role","growth","scenes","testament","books","tier","archetype","evidenceLevel","primaryEligible"];
const characters = global.CHARACTERS;

assert.strictEqual(characters.length, 100, "character catalog must contain exactly 100 entries");
assert.strictEqual(new Set(characters.map((character) => character.id)).size, 100, "character IDs must be unique");

characters.forEach((character) => {
  required.forEach((key) => assert.notStrictEqual(character[key], undefined, `${character.id}: missing ${key}`));
  assert.ok(["OT","NT"].includes(character.testament), `${character.id}: invalid testament`);
  assert.ok(["famous","known","discovery"].includes(character.tier), `${character.id}: invalid tier`);
  assert.ok(["high","medium"].includes(character.evidenceLevel), `${character.id}: invalid evidenceLevel`);
  assert.ok(Number.isInteger(character.atlas) && character.atlas >= 1 && character.atlas <= 25, `${character.id}: invalid atlas`);
  assert.ok(["0% 0%","100% 0%","0% 100%","100% 100%"].includes(character.pos), `${character.id}: invalid pos`);
  assert.deepStrictEqual(Object.keys(character.profile).sort(), dimensions.slice().sort(), `${character.id}: invalid profile dimensions`);
  dimensions.forEach((dimension) => assert.ok(Number.isFinite(character.profile[dimension]) && character.profile[dimension] >= 0 && character.profile[dimension] <= 100, `${character.id}: invalid ${dimension}`));
  const profileValues = dimensions.map((dimension) => character.profile[dimension]);
  const profileAverage = profileValues.reduce((sum,value) => sum + value,0) / profileValues.length;
  assert.ok(profileAverage >= 58 && profileAverage <= 68, `${character.id}: profile average must be calibrated`);
  assert.ok(Math.min(...profileValues) >= 32 && Math.min(...profileValues) <= 48, `${character.id}: profile needs a grounded low dimension`);
  assert.ok(Math.max(...profileValues) >= 78 && Math.max(...profileValues) <= 92, `${character.id}: profile needs a distinctive high dimension`);
  assert.strictEqual(character.traits.length, 4, `${character.id}: traits must have four items`);
  assert.strictEqual(character.role.length, 4, `${character.id}: role must have four items`);
  assert.strictEqual(character.scenes.length, 3, `${character.id}: scenes must have three items`);
  assert.ok(character.intro.length >= 55, `${character.id}: intro is too short`);
  assert.ok(character.story.length >= 90, `${character.id}: story is too short`);
});

const unnamed = characters.filter((character) => character.named === false).map((character) => character.id).sort();
assert.deepStrictEqual(unnamed, ["ethiopian_eunuch","samaritan_woman","shunammite_woman","widow_zarephath"]);
characters.filter((character) => character.named === false).forEach((character) => {
  assert.strictEqual(character.unnamedNote, "성경에 이름은 기록되지 않았습니다.");
});

const vectors = characters.map((character) => dimensions.map((dimension) => character.profile[dimension]).join(","));
assert.strictEqual(new Set(vectors).size, 100, "profile vectors must be unique");

for (let atlas = 1; atlas <= 25; atlas += 1) {
  const atlasCharacters = characters.filter((character) => character.atlas === atlas);
  assert.strictEqual(atlasCharacters.length, 4, `atlas ${atlas} must map to four characters`);
  assert.strictEqual(new Set(atlasCharacters.map((character) => character.pos)).size, 4, `atlas ${atlas} positions must be unique`);
  const file = path.join(__dirname, "..", "assets", `characters-${atlas}.png`);
  const png = fs.readFileSync(file);
  assert.strictEqual(png.toString("ascii", 1, 4), "PNG", `atlas ${atlas} must be PNG`);
  assert.strictEqual(png.readUInt32BE(16), 1672, `atlas ${atlas} width`);
  assert.strictEqual(png.readUInt32BE(20), 941, `atlas ${atlas} height`);
}

const tierCounts = characters.reduce((counts, character) => {
  counts[character.tier] = (counts[character.tier] || 0) + 1;
  return counts;
}, {});
assert.ok(tierCounts.discovery >= 20, "catalog should contain a meaningful discovery group");
assert.ok(tierCounts.famous >= 15, "catalog should retain familiar anchors");

console.log(JSON.stringify({ count: characters.length, tierCounts, unnamed }, null, 2));
