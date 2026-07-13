const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const warrantPath = path.join(__dirname, 'public', 'Assets', 'RequestForWarrantTemplate.docx');

function printBlock(filePath, index, before = 500, after = 500) {
  const content = fs.readFileSync(filePath, 'binary');
  const zip = new PizZip(content);
  const docXml = zip.file('word/document.xml').asText();
  console.log(`\n=== Context for ${path.basename(filePath)} at index ${index} ===`);
  console.log(docXml.substring(index - before, index + after));
}

printBlock(warrantPath, 38001, 800, 300);
printBlock(warrantPath, 46841, 800, 300);
