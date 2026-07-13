require('dotenv').config();
const { getDatabase, initializeDatabase } = require('./utils/db');
const docxConverter = require('docx-pdf');
const fs = require('fs');

async function run() {
  const db = await initializeDatabase(process.env.MONGODB_URI);
  const doc = await db.collection('generated_documents').findOne({});
  if (!doc) {
    console.log("No docs found");
    process.exit(0);
  }
  const docxBuffer = Buffer.from(doc.docx_base64, 'base64');
  fs.writeFileSync('temp_test.docx', docxBuffer);
  
  docxConverter('temp_test.docx', 'temp_test.pdf', function(err, result) {
    if(err) {
      console.log(err);
    }
    console.log('result', result);
    process.exit(0);
  });
}
run();
