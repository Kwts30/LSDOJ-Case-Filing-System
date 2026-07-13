require('dotenv').config();
const { getDatabase, initializeDatabase } = require('./utils/db');
const mammoth = require('mammoth');
const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
  const db = await initializeDatabase(process.env.MONGODB_URI);
  const doc = await db.collection('generated_documents').findOne({});
  if (!doc) {
    console.log("No docs found");
    process.exit(0);
  }
  
  const docxBuffer = Buffer.from(doc.docx_base64, 'base64');
  console.log("Converting with mammoth...");
  
  const options = {
    convertImage: mammoth.images.imgElement(function(image) {
      return image.read("base64").then(function(imageBuffer) {
        return {
          src: "data:" + image.contentType + ";base64," + imageBuffer
        };
      });
    })
  };
  
  const result = await mammoth.convertToHtml({ buffer: docxBuffer }, options);
  const html = `
  <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        img { max-width: 100%; height: auto; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #ddd; padding: 8px; }
      </style>
    </head>
    <body>${result.value}</body>
  </html>`;
  
  console.log("Launching puppeteer...");
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: 'mammoth_test.pdf', format: 'A4' });
  await browser.close();
  
  console.log("Done generating mammoth_test.pdf");
  process.exit(0);
}
run();
