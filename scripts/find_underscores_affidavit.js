const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const affidavitPath = path.join(__dirname, 'public', 'Assets', 'AffidavitOfComplainteTemplate.docx');

const content = fs.readFileSync(affidavitPath, 'binary');
const zip = new PizZip(content);
const docXml = zip.file('word/document.xml').asText();

let idx = 0;
while (true) {
  idx = docXml.indexOf('___', idx);
  if (idx === -1) break;
  console.log(`Found underscores at index ${idx}:`);
  console.log(docXml.substring(idx - 100, idx + 100));
  idx += 3;
}
