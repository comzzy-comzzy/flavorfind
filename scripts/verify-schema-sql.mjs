// One-shot SQL syntax validator for supabase/schema.sql.
// Uses pg-query-emscripten (libpg_query compiled to WebAssembly) so we
// can confirm the migration is at least parseable before shipping.
// This is NOT a semantic check (we do not actually create the tables);
// it just verifies every statement in the file parses cleanly.
//
// Usage:  node scripts/verify-schema-sql.mjs
// Exit:   0 on success, 1 on parse failure.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pgQuery from "pg-query-emscripten";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, "..", "supabase", "schema.sql");
const source = readFileSync(schemaPath, "utf8");

console.log(`[verify-schema-sql] parsing ${schemaPath} (${source.length} bytes)`);

const lib = await pgQuery();
const result = lib.parse(source);

if (result.error) {
  console.error("[verify-schema-sql] PARSE FAILED:");
  console.error("  message:", result.error.message);
  console.error("  file:   ", result.error.fileName ?? schemaPath);
  console.error("  line:   ", result.error.lineNumber ?? "?");
  console.error("  cursor: ", result.error.cursorPosition ?? "?");
  process.exit(1);
}

// libpg_query returns { version, stmts: [...] }. Walk the statements
// and collect human-readable descriptions so we can prove the required
// AC-5 objects are present.
const tree = result.parse_tree;
const stmts = tree && Array.isArray(tree.stmts) ? tree.stmts : [];

const labels = stmts.map((wrapper) => {
  const stmt = wrapper && wrapper.stmt ? wrapper.stmt : null;
  if (!stmt) return null;
  const tag = Object.keys(stmt)[0];
  const inner = stmt[tag];
  switch (tag) {
    case "CreateExtensionStmt":
      return `CREATE EXTENSION ${inner.if_not_exists ? "IF NOT EXISTS " : ""}${inner.extname}`;
    case "CreateStmt": {
      const r = inner.relation ?? {};
      const target = (r.schemaname ? r.schemaname + "." : "") + (r.relname ?? "?");
      return `CREATE TABLE ${inner.if_not_exists ? "IF NOT EXISTS " : ""}${target}`;
    }
    case "IndexStmt": {
      const r = inner.relation ?? {};
      const target = (r.schemaname ? r.schemaname + "." : "") + (r.relname ?? "?");
      return `CREATE INDEX ${inner.if_not_exists ? "IF NOT EXISTS " : ""}${target}`;
    }
    case "ViewStmt": {
      const v = inner.view ?? {};
      return `CREATE VIEW ${(v.schemaname ? v.schemaname + "." : "") + (v.relname ?? "?")}`;
    }
    case "CreateFunctionStmt": {
      const fns = inner.functions ?? [];
      const first = fns[0] ?? {};
      const name = Array.isArray(first.funcname)
        ? first.funcname.map((n) => (n.String && n.String.sval) || n.String?.sval || "?").join(".")
        : "?";
      return `CREATE FUNCTION ${name}`;
    }
    case "CreateTrigStmt":
      return `CREATE TRIGGER ${inner.trigname ?? "?"} ON ${inner.relation?.relname ?? "?"}`;
    case "AlterTableStmt":
      return `ALTER TABLE ${inner.relation?.relname ?? "?"} (${(inner.cmds ?? []).map((c) => Object.keys(c)[0]).join(", ")})`;
    case "CreatePolicyStmt":
      return `CREATE POLICY ${inner.policy_name ?? "?"} ON ${inner.table?.relname ?? "?"}`;
    case "DropPolicyStmt":
      return `DROP POLICY ${inner.policy_name ?? "?"}`;
    case "DropTrigStmt":
      return `DROP TRIGGER ${inner.trigname ?? "?"}`;
    case "RenameStmt":
      return `RENAME ${inner.renameType ?? "?"}`;
    default:
      return tag;
  }
}).filter(Boolean);

console.log(`[verify-schema-sql] OK -- ${stmts.length} top-level statement(s) parsed cleanly.`);
for (const l of labels) console.log("  - " + l);

const must = [
  { target: "public.restaurants", label: "CREATE TABLE public.restaurants" },
  { target: "public.reviews",     label: "CREATE TABLE public.reviews" },
];
for (const { target, label } of must) {
  if (!labels.some((l) => l.includes(target))) {
    console.error(`[verify-schema-sql] missing required statement: ${label}`);
    process.exit(1);
  }
}
console.log("[verify-schema-sql] required public.restaurants + public.reviews present.");
