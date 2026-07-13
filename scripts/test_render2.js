require('dotenv').config();
const { getDatabase, initializeDatabase } = require('./utils/db');
const { renderDocxToPdfAndPng } = require('./utils/documentRenderer');

async function run() {
  const db = await initializeDatabase(process.env.MONGODB_URI);
  const doc = await db.collection('generated_documents').findOne({});
  if (!doc) {
    console.log("No generated documents found");
    process.exit(0);
  }

  const docxBuffer = Buffer.from(doc.docx_base64, 'base64');
  
  try {
    const rendered = await renderDocxToPdfAndPng(docxBuffer);
    console.log("Rendered result:", {
      rendered: rendered.rendered,
      reason: rendered.reason,
      pagesCount: rendered.pages.length
    });
  } catch (error) {
    console.error("Caught error during render:", error);
  }
  process.exit(0);
}

run();
