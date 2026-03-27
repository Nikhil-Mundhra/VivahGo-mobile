#!/usr/bin/env node

const {
  GENERATED_JSON_PATH,
  GENERATED_TEXT_PATH,
  buildKeywordLibrary,
  writeKeywordAssets,
} = require('./seo-keywords.cjs');

async function main() {
  const keywordLibrary = await buildKeywordLibrary();
  writeKeywordAssets(keywordLibrary);

  console.log(`Generated ${keywordLibrary.summary.keywordCount} SEO keywords.`);
  console.log(`JSON: ${GENERATED_JSON_PATH}`);
  console.log(`Text: ${GENERATED_TEXT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
