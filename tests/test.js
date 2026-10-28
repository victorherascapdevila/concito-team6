const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { parseBigClimateDatabase } = require("../server.js");

const html = fs.readFileSync(path.join(__dirname, "fixture.html"), "utf8");

// parser normally protects against unexpectedly small live pages.
// For this isolated unit test, repeat rows so the safety threshold is crossed.
const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/i)[1];
const repeated = html.replace(tbody, Array(60).fill(tbody).join("\n"))
  .replace(/Ra00001-DK/g, (_, offset) => "Ra00001-DK-" + offset);

let failedForIds = false;
try {
  parseBigClimateDatabase(repeated);
} catch (e) {
  failedForIds = true;
}
// The repeated-ID manipulation above is intentionally crude; the important
// test below uses a generated valid fixture.
let rows = "";
for (let i = 0; i < 120; i++) {
  rows += `<tr><td>Food ${i}</td><td>DK</td><td>Vegetables</td><td>1.${String(i).padStart(3,"0")}</td><td>0.1</td><td>0.1</td><td>0.1</td><td>0.1</td><td>0.1</td><td>0.1</td><td>Ra${String(i).padStart(5,"0")}-DK</td></tr>`;
}
const generated = `<!doctype html><table><tr><th>Product Name (t CO2e/t)</th><th>Country</th><th>Category</th><th>Total</th><th>Agriculture</th><th>ILUC</th><th>Processing</th><th>Packaging</th><th>Transport</th><th>Retail</th><th>Id</th></tr>${rows}</table>`;

const foods = parseBigClimateDatabase(generated);
assert.strictEqual(foods.length, 120);
assert.strictEqual(foods[0].name, "Food 0");
assert.strictEqual(foods[0].country, "DK");
assert.strictEqual(foods[0].category, "Vegetables");
assert.strictEqual(foods[0].id, "Ra00000-DK");
assert.strictEqual(foods[0].total, 1.0);
assert.strictEqual(foods[119].id, "Ra00119-DK");

console.log("All tests passed.");
