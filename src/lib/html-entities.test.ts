import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from './html-entities';

describe('decodeHtmlEntities', () => {
  it('turns Gmail snippet entities back into characters', () => {
    expect(decodeHtmlEntities('wahooooo &lt;3 On Mon, Matt &lt;matt@zipline.media&gt; wrote')).toBe('wahooooo <3 On Mon, Matt <matt@zipline.media> wrote');
    expect(decodeHtmlEntities('Tom &amp; Jerry&#39;s &quot;cut&quot;')).toBe('Tom & Jerry\'s "cut"');
    expect(decodeHtmlEntities('caf&#xE9;')).toBe('café');
  });

  it('leaves unknown or plain text alone', () => {
    expect(decodeHtmlEntities('R&D &notathing; 100%')).toBe('R&D &notathing; 100%');
  });
});
