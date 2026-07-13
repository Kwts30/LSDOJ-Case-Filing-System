const fs = require('fs');
const path = require('path');

function moveDocs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Find the Generated Documents block
  const startRegex = /<!-- Generated Documents -->/;
  let startIndex = content.search(startRegex);
  if (startIndex === -1) {
    console.log(`Generated Documents block not found in ${filePath}`);
    return;
  }

  // Find the end of the block (which is</div>\n    </div>\n    <!-- Right: Sidebar Info --> or similar)
  // Let's just find the exact block using string manipulation
  let lines = content.split('\n');
  let startLine = -1;
  let endLine = -1;
  let asideLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<!-- Generated Documents -->')) {
      startLine = i;
    }
    if (startLine !== -1 && i > startLine && lines[i].includes('<!-- Right: Sidebar')) {
      asideLine = i;
      // The end of the Generated Documents block is usually a few lines before asideLine
      // Let's backtrack to find the <% } %> or </div> that closes it.
      for (let j = asideLine - 1; j > startLine; j--) {
        if (lines[j].includes('<% } %>') || lines[j].includes('</div>')) {
          if (lines[j].includes('<% } %>') || lines[j].includes('</div>')) {
             // In detail.ejs (filings), it ends with <% } %> on line 159.
             // In da_review, it ends with </div> on line 210.
          }
        }
      }
    }
  }
}

// Since string manipulation is tricky, let's just use regex to extract the block and insert it.
function moveDocsRegex(filePath, afterCardRegex) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Extract block
  const blockRegex = /([ \t]*)<!-- Generated Documents -->[\s\S]*?(?:<% } %>|<\/div>)\n(?:[ \t]*<\/div>\n)?[ \t]*<!-- Right: Sidebar/g;
  
  const match = /([ \t]*)<!-- Generated Documents -->([\s\S]*?(?:<% } %>|<\/div>))\n(?:[ \t]*<\/div>\n)?[ \t]*<!-- Right: Sidebar/.exec(content);
  
  if (!match) {
    console.log("Could not find block in " + filePath);
    return;
  }
  
  let block = `<!-- Generated Documents -->${match[2]}\n`;
  
  // Clean up the block: change detail-section to aside-card, h2 to h3
  block = block.replace(/class="detail-section"/g, 'class="aside-card"');
  block = block.replace(/<h2><span class="material-icons">picture_as_pdf<\/span> Generated Documents/g, '<h3><span class="material-icons" style="vertical-align: middle;">description</span> Generated Docs');
  block = block.replace(/<\/h2>/g, '</h3>');
  
  // Remove the block from original position
  content = content.replace(match[0], '<!-- Right: Sidebar');
  
  // Insert into sidebar
  content = content.replace(afterCardRegex, `$&` + '\n\n' + block);
  
  fs.writeFileSync(filePath, content);
  console.log("Updated " + filePath);
}

const filingsPath = path.join(__dirname, 'views/filings/detail.ejs');
moveDocsRegex(filingsPath, /<div class="aside-card">[\s\S]*?<\/div>\n[ \t]*<\/div>\n[ \t]*<\/div>\n[ \t]*<\/div>/); 
// Wait, the regex for after card is tricky. Let's just do it cleanly by reading lines.

function manualMove(filePath, isDaReview) {
  let lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let startIdx = lines.findIndex(l => l.includes('<!-- Generated Documents -->'));
  if(startIdx === -1) return;
  
  let endIdx = -1;
  for(let i=startIdx; i<lines.length; i++) {
    if(lines[i].includes('<!-- Right: Sidebar')) {
      // The block ends 2 lines above this (one for </div> of main, one for <% } %> or </div> of section)
      endIdx = i - 2;
      break;
    }
  }
  
  if (endIdx === -1) return;
  
  let blockLines = lines.splice(startIdx, endIdx - startIdx + 1);
  
  // Also remove the closing </div> for the left column which might have been shifted, actually wait.
  // In filings/detail.ejs, line 160 is `    </div>` which closes `<div class="detail-main">`.
  // If we splice out 124-159, line 160 remains! Which is correct!
  
  let blockStr = blockLines.join('\n');
  blockStr = blockStr.replace(/class="detail-section"/g, 'class="aside-card"');
  blockStr = blockStr.replace(/class="detail-section" id="generated-docs-section"/g, 'class="aside-card" id="generated-docs-section"');
  blockStr = blockStr.replace(/<h2><span class="material-icons">picture_as_pdf<\/span> Generated Documents/g, '<h3><span class="material-icons" style="vertical-align: middle;">description</span> Generated Docs');
  blockStr = blockStr.replace(/<\/h2>/g, '</h3>');
  
  // Now find where to insert. Let's insert it right AFTER the first <div class="aside-card"> block in the sidebar.
  // The first aside-card ends at `      </div>` before `      <!-- Timeline -->`
  let insertIdx = lines.findIndex(l => l.includes('<!-- Timeline -->'));
  if (insertIdx !== -1) {
    lines.splice(insertIdx, 0, blockStr);
  } else {
    // just append to sidebar
    let asideIdx = lines.findIndex(l => l.includes('<div class="detail-aside">'));
    lines.splice(asideIdx + 1, 0, blockStr);
  }
  
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log("Successfully moved block in " + filePath);
}

manualMove(path.join(__dirname, 'views/filings/detail.ejs'), false);
manualMove(path.join(__dirname, 'views/da_review/detail.ejs'), true);

