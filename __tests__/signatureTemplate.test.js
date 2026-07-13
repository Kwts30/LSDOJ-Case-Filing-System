const { injectWarrantSignatureTags } = require('../utils/docGenEngine');

describe('warrant signature tag injection', () => {
  test('removes the two duplicate signature-line paragraphs without adding new tags', () => {
    const line = '_'.repeat(36);
    const xml = `<w:body><w:p><w:r><w:t>${line}</w:t></w:r></w:p><w:p><w:r><w:t>${line}</w:t></w:r></w:p></w:body>`;

    const result = injectWarrantSignatureTags(xml);

    expect(result).not.toContain(line);
    expect(result).toBe('<w:body><w:p/><w:p/></w:body>');
  });
});
