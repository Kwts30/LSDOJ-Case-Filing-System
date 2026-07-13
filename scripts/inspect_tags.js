const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const InspectModule = require("docxtemplater/js/inspect-module");
const fs = require("fs");
const path = require("path");

const docxFiles = [
  "public/Assets/AffidavitOfComplainteTemplate.docx",
  "public/Assets/RequestForWarrantTemplate.docx"
];

for (const file of docxFiles) {
  try {
    const content = fs.readFileSync(path.resolve(__dirname, file), "binary");
    const zip = new PizZip(content);
    const iModule = InspectModule();
    const doc = new Docxtemplater(zip, {
      modules: [iModule],
      paragraphLoop: true,
      linebreaks: true,
    });
    
    const tags = iModule.getAllTags();
    console.log(`\n=== Tags in ${path.basename(file)} ===`);
    console.log(Object.keys(tags));
  } catch (error) {
    console.error(`Error processing ${file}:`, error);
  }
}
