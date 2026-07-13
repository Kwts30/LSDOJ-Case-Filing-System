const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const warrantPath = path.join(__dirname, 'public', 'Assets', 'RequestForWarrantTemplate.docx');
const affidavitPath = path.join(__dirname, 'public', 'Assets', 'AffidavitOfComplainteTemplate.docx');

function findAndPrint(filePath, textToFind, offsetStart = -150, offsetEnd = 150) {
  const content = fs.readFileSync(filePath, 'binary');
  const zip = new PizZip(content);
  const docXml = zip.file('word/document.xml').asText();
  
  let idx = docXml.indexOf(textToFind);
  while (idx !== -1) {
    console.log(`\n=== File: ${path.basename(filePath)} | Text: "${textToFind}" | Index: ${idx} ===`);
    console.log(docXml.substring(idx + offsetStart, idx + offsetEnd));
    idx = docXml.indexOf(textToFind, idx + 1);
  }
}

findAndPrint(warrantPath, 'officer_name', -200, 200);
findAndPrint(warrantPath, 'doj', -100, 300);
findAndPrint(affidavitPath, 'doj', -100, 300);
