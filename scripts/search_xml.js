const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const warrantPath = path.join(__dirname, 'public', 'Assets', 'RequestForWarrantTemplate.docx');
const affidavitPath = path.join(__dirname, 'public', 'Assets', 'AffidavitOfComplainteTemplate.docx');

function searchXml(filePath, query) {
  const content = fs.readFileSync(filePath, 'binary');
  const zip = new PizZip(content);
  const docXml = zip.file('word/document.xml').asText();
  
  console.log(`\n=== Searching for "${query}" in ${path.basename(filePath)} ===`);
  let idx = 0;
  while (true) {
    idx = docXml.indexOf(query, idx);
    if (idx === -1) break;
    console.log(`Found "${query}" at index ${idx}:`);
    console.log(docXml.substring(Math.max(0, idx - 100), Math.min(docXml.length, idx + 100)));
    idx += query.length;
  }
}

searchXml(warrantPath, 'doj');
searchXml(affidavitPath, 'doj');
searchXml(warrantPath, 'officer_name');
