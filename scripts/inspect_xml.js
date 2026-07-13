const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const warrantPath = path.join(__dirname, 'public', 'Assets', 'RequestForWarrantTemplate.docx');
const affidavitPath = path.join(__dirname, 'public', 'Assets', 'AffidavitOfComplainteTemplate.docx');

function inspectXml(filePath) {
  const content = fs.readFileSync(filePath, 'binary');
  const zip = new PizZip(content);
  const docXml = zip.file('word/document.xml').asText();
  
  console.log(`\n=== XML Length for ${path.basename(filePath)}: ${docXml.length} ===`);
  
  // Find occurrences of officer_name, doj_name, doj_position
  const targets = ['officer_name', 'doj_name', 'doj_position'];
  targets.forEach(t => {
    let idx = docXml.indexOf(t);
    while (idx !== -1) {
      console.log(`Found target "${t}" at index ${idx}. Context:`);
      console.log(docXml.substring(Math.max(0, idx - 150), Math.min(docXml.length, idx + 150)));
      idx = docXml.indexOf(t, idx + 1);
    }
  });
}

inspectXml(warrantPath);
inspectXml(affidavitPath);
