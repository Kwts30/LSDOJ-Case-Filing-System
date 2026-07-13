const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const affidavitPath = path.join(__dirname, 'public', 'Assets', 'AffidavitOfComplainteTemplate.docx');

function printBlock(filePath, index, before = 500, after = 500) {
  const content = fs.readFileSync(filePath, 'binary');
  const zip = new PizZip(content);
  const docXml = zip.file('word/document.xml').asText();
  console.log(`\n=== Context for ${path.basename(filePath)} at index ${index} ===`);
  console.log(docXml.substring(index - before, index + after));
}

printBlock(affidavitPath, 27069, 400, 300);
printBlock(affidavitPath, 48738, 400, 300);
printBlock(affidavitPath, 55566, 400, 300);
