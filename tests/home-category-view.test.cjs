const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loader } = require("./payment-test-helpers.cjs");

function renderCatalog(grouped) {
  let state = 0;
  const load = loader();
  const module = { exports: {} };
  const output = ts.transpileModule(readFileSync("src/components/commerce/zenvexa-catalog.tsx", "utf8"), {
    fileName: "zenvexa-catalog.tsx",
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const customRequire = (name) => {
    if (name === "react") return { useMemo: (fn) => fn(), useState: (initial) => [state++ === 0 ? grouped : initial, () => {}] };
    if (name === "./product-card") return { ProductGrid: ({ items }) => React.createElement("div", { "data-testid": "product-grid" }, items.map((p) => React.createElement("span", { key: p.id }, p.name))) };
    if (name === "./catalog-state") return { CatalogEmpty: () => null };
    return load(name);
  };
  new Function("require", "module", "exports", output)(customRequire, module, module.exports);
  return renderToStaticMarkup(React.createElement(module.exports.ZenvexaCatalog, {
    items: [
      { id: "1", name: "Phone fixture", categoryId: "phones", category: "Phones", brand: "Fixture", price: 100 },
      { id: "2", name: "Other fixture", category: "Missing", brand: "Fixture", price: 100 },
    ],
    categories: [{ id: "phones", name: "Phones", slug: "phones" }],
  }));
}

test("default category view renders catalog headings and a deliberate Other section", () => {
  const html = renderCatalog(true);
  assert.equal((html.match(/data-testid="product-grid"/g) || []).length, 2);
  assert.match(html, /<h3[^>]*>Phones<\/h3>/);
  assert.match(html, /<h3[^>]*>Other<\/h3>/);
});

test("All merchandise view renders one unified grid without category headings", () => {
  const html = renderCatalog(false);
  assert.equal((html.match(/data-testid="product-grid"/g) || []).length, 1);
  assert.doesNotMatch(html, /<h3/);
  assert.match(html, /Phone fixture/);
  assert.match(html, /Other fixture/);
});
