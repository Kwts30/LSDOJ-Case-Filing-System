const fs = require('fs');
const path = require('path');

const srcDa = `C:\\Users\\Asus\\.gemini\\antigravity-ide\\brain\\75b65954-dff4-4673-b7c3-622271d8a952\\signature_da_1783758512907.png`;
const srcOfficer = `C:\\Users\\Asus\\.gemini\antigravity-ide\\brain\\75b65954-dff4-4673-b7c3-622271d8a952\\signature_officer_1783758523784.png`;

const destDa = path.join(__dirname, 'public', 'Assets', 'signature_da.png');
const destOfficer = path.join(__dirname, 'public', 'Assets', 'signature_officer.png');

try {
  fs.copyFileSync(srcDa, destDa);
  console.log(`Copied DA signature to ${destDa}`);
} catch (e) {
  console.error('Error copying DA signature:', e.message);
}

try {
  fs.copyFileSync(srcOfficer, destOfficer);
  console.log(`Copied Officer signature to ${destOfficer}`);
} catch (e) {
  console.error('Error copying Officer signature:', e.message);
}
