const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('partials')) {
          results = results.concat(walk(file));
      }
    } else if (file.endsWith('.ejs')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, '../views'));
files.push(path.join(__dirname, '../views/partials/footer.ejs')); 

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('</body>') && !content.includes('cookie-banner')) {
    // Determine relative path to partials dir
    // e.g. from views/admin/doc.ejs -> ../partials/cookie-banner
    // from views/home.ejs -> ./partials/cookie-banner
    const relPath = path.relative(path.dirname(file), path.join(__dirname, '../views/partials/cookie-banner')).replace(/\\/g, '/');
    
    const includeStr = `<%- include('${relPath}') %>\n</body>`;
    content = content.replace('</body>', includeStr);
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
});
