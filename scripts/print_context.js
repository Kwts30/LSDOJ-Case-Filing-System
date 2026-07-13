const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const warrantPath = path.join(__dirname, 'public', 'Assets', 'RequestForWarrantTemplate.docx');
const affidavitPath = path.join(__dirname, 'public', 'Assets', 'AffidavitOfComplainteTemplate.docx');

function printContext(filePath, index, length = 300) {
  const content = fs.readFileSync(filePath, 'binary');
  const zip = new PizZip(content);
  const docXml = zip.file('word/document.xml').asText();
  console.log(`\n=== Context for ${path.basename(filePath)} at index ${index} ===`);
  console.log(docXml.substring(index - length, index + length));
}

// Warrant
printContext(warrantPath, 46841, 200);

// Affidavit
printContext(affidavitPath, 27069, 200);
printContext(affidavitPath, 48738, 200);
printContext(affidavitPath, 55566, 200);
