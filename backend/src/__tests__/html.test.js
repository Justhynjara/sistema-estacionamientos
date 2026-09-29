import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../utils/html.js';

describe('escapeHtml', () => {
  test('escapa las marcas de HTML antes de meter texto de un usuario en un correo', () => {
    assert.equal(
      escapeHtml('<a href="http://evil.test">click</a> & "cosas" de Juan'),
      '&lt;a href=&quot;http://evil.test&quot;&gt;click&lt;/a&gt; &amp; &quot;cosas&quot; de Juan'
    );
  });

  test('no revienta con null/undefined', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
  });
});
