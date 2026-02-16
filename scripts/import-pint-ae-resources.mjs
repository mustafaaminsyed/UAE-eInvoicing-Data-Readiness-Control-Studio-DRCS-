import fs from "node:fs";
import path from "node:path";

const DEFAULT_SOURCE_DIR = path.resolve("tmp", "pint-ae-resources-dev");
const sourceDir = path.resolve(process.argv[2] || DEFAULT_SOURCE_DIR);
const outputDir = path.resolve("src", "lib", "pintAE", "generated");
const relativeSourceDir = path.relative(process.cwd(), sourceDir).replaceAll("\\", "/");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function xmlDecode(value) {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&#34;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&#10;", "\n")
    .replaceAll("&#9;", "\t");
}

function dedupe(arr) {
  return [...new Set(arr)];
}

function parseReferenceTerms(text) {
  if (!text) return [];
  const matches = text.match(/\b(?:IBT-\d+|IBG-\d+|BTAE-\d+|BR-[A-Za-z0-9-]+)\b/g) || [];
  return dedupe(matches);
}

function parseSchematron(filePath, documentType, packType) {
  const xml = readFile(filePath);
  const rules = [];
  const ruleRegex = /<rule\s+context="([^"]+)">([\s\S]*?)<\/rule>/g;
  let ruleMatch;

  while ((ruleMatch = ruleRegex.exec(xml)) !== null) {
    const context = xmlDecode(ruleMatch[1]);
    const ruleBody = ruleMatch[2];
    const assertRegex = /<assert\s+id="([^"]+)"\s+flag="([^"]+)"\s+test="([^"]*)">([\s\S]*?)<\/assert>/g;
    let assertMatch;

    while ((assertMatch = assertRegex.exec(ruleBody)) !== null) {
      const id = xmlDecode(assertMatch[1]).trim();
      const flag = xmlDecode(assertMatch[2]).trim();
      const test = xmlDecode(assertMatch[3]).trim();
      const message = xmlDecode(assertMatch[4]).replace(/\s+/g, " ").trim();
      rules.push({
        id,
        flag,
        context,
        test,
        message,
        references: parseReferenceTerms(message),
        documentType,
        packType,
      });
    }
  }

  return rules;
}

function parseCodelist(filePath) {
  const xml = readFile(filePath);
  const shortNameMatch = xml.match(/<gc:ShortName(?:\s+Lang="en")?>([\s\S]*?)<\/gc:ShortName>/);
  const versionMatch = xml.match(/<gc:Version>([\s\S]*?)<\/gc:Version>/);
  const rows = [];
  const rowRegex = /<gc:Row>([\s\S]*?)<\/gc:Row>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowBody = rowMatch[1];
    const valueRegex =
      /<gc:Value\s+ColumnRef="([^"]+)">[\s\S]*?<gc:SimpleValue>([\s\S]*?)<\/gc:SimpleValue>[\s\S]*?<\/gc:Value>/g;
    let valueMatch;
    const row = {};
    while ((valueMatch = valueRegex.exec(rowBody)) !== null) {
      const key = valueMatch[1].trim();
      const value = xmlDecode(valueMatch[2]).trim();
      row[key] = value;
    }
    if (row.id) rows.push(row);
  }

  const codeListName = path.basename(filePath, ".gc");
  return {
    fileName: path.basename(filePath),
    codeListName,
    shortName: shortNameMatch ? xmlDecode(shortNameMatch[1]).trim() : codeListName,
    version: versionMatch ? xmlDecode(versionMatch[1]).trim() : "",
    ids: rows.map((r) => r.id),
  };
}

function walk(dir, predicate) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, predicate));
      continue;
    }
    if (predicate(full)) out.push(full);
  }
  return out;
}

function relativePath(p) {
  return path.relative(sourceDir, p).replaceAll("\\", "/");
}

function writeTs(filePath, banner, constName, data) {
  const content = `${banner}
export const ${constName} = ${JSON.stringify(data, null, 2)} as const;
`;
  fs.writeFileSync(filePath, content, "utf8");
}

if (!fs.existsSync(sourceDir)) {
  console.error(`[import-pint-ae-resources] Source directory not found: ${sourceDir}`);
  process.exit(1);
}

ensureDir(outputDir);

const schematronFiles = walk(sourceDir, (p) => p.endsWith(".sch") && p.includes(`${path.sep}schematron${path.sep}`));
const codelistFiles = walk(sourceDir, (p) => p.endsWith(".gc") && p.includes(`${path.sep}codelist${path.sep}`));

const schematronRules = [];
for (const file of schematronFiles) {
  const rel = relativePath(file);
  const documentType = rel.includes("creditnote") ? "creditnote" : "invoice";
  const packType = rel.includes("jurisdiction-aligned") ? "jurisdiction-aligned" : "ubl-preprocessed";
  const parsed = parseSchematron(file, documentType, packType).map((r) => ({
    ...r,
    sourceFile: rel,
  }));
  schematronRules.push(...parsed);
}

const codelists = {};
for (const file of codelistFiles) {
  const parsed = parseCodelist(file);
  codelists[parsed.codeListName] = {
    fileName: parsed.fileName,
    shortName: parsed.shortName,
    version: parsed.version,
    ids: dedupe(parsed.ids),
  };
}

const metadata = {
  generatedAt: new Date().toISOString(),
  sourceDir: relativeSourceDir || ".",
  schematronFiles: schematronFiles.length,
  schematronRules: schematronRules.length,
  codelists: Object.keys(codelists).length,
};

writeTs(
  path.join(outputDir, "metadata.ts"),
  "// Auto-generated by scripts/import-pint-ae-resources.mjs",
  "PINT_AE_SPEC_METADATA",
  metadata
);

writeTs(
  path.join(outputDir, "schematronRules.ts"),
  "// Auto-generated by scripts/import-pint-ae-resources.mjs",
  "PINT_AE_SCHEMATRON_RULES",
  schematronRules
);

writeTs(
  path.join(outputDir, "codelists.ts"),
  "// Auto-generated by scripts/import-pint-ae-resources.mjs",
  "PINT_AE_CODELISTS",
  codelists
);

console.log(
  `[import-pint-ae-resources] Generated ${schematronRules.length} schematron rules and ${Object.keys(codelists).length} codelists into ${outputDir}`
);
