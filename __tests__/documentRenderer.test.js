const { getRendererConfiguration } = require('../utils/documentRenderer');

describe('document renderer configuration', () => {
  test('reports that rendering is unavailable without a configured DOCX converter', () => {
    const previous = process.env.SOFFICE_PATH;
    delete process.env.SOFFICE_PATH;

    expect(getRendererConfiguration()).toEqual({
      available: false,
      reason: 'SOFFICE_PATH is not configured'
    });

    if (previous === undefined) delete process.env.SOFFICE_PATH;
    else process.env.SOFFICE_PATH = previous;
  });
});
