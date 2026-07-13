const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const warrantPath = path.join(__dirname, 'public', 'Assets', 'RequestForWarrantTemplate.docx');
const affidavitPath = path.join(__dirname, 'public', 'Assets', 'AffidavitOfComplainteTemplate.docx');

function printRawText(filePath) {
  const content = fs.readFileSync(filePath, 'binary');
  const zip = new PizZip(content);
  const docXml = zip.file('word/document.xml').asText();
  
  // Strip XML tags crudely
  const rawText = docXml.replace(/<[^>]+>/g, ' ');
  console.log(`\n=== Raw Text of ${path.basename(filePath)} ===`);
  console.log(rawText.replace(/\s+/g, ' ').substring(0, 3000));
}

printRawText(warrantPath);
printRawText(affidavitPath);
