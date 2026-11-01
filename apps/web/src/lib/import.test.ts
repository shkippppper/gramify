import { serializeState } from '@gramify/shared';
import { describe, expect, it } from 'vitest';
import { parseFile, parseImport } from './import';

describe('import', () => {
  it('parses mermaid.live links', () => {
    const link = `https://mermaid.live/edit#${serializeState({ code: 'graph TD; A-->B', mermaid: '{"theme":"forest"}' })}`;
    expect(parseImport(link)).toEqual({ code: 'graph TD; A-->B', config: '{"theme":"forest"}' });
  });
  it('treats other text as code', () => {
    expect(parseImport('  sequenceDiagram\n A->>B: hi ')).toEqual({
      code: 'sequenceDiagram\n A->>B: hi',
      config: '{}',
    });
  });
  it('extracts mermaid blocks from markdown', () => {
    expect(parseFile('arch.md', '# Doc\n```mermaid\ngraph LR; X-->Y\n```\n')).toEqual({
      code: 'graph LR; X-->Y\n',
      title: 'arch',
    });
    expect(() => parseFile('a.md', 'nothing')).toThrow();
    expect(parseFile('flow.mmd', 'pie').title).toBe('flow');
  });
});

describe('import helpers', () => {
  it('derives titles', async () => {
    const { deriveTitle, importErrorMessage } = await import('./import');
    expect(deriveTitle('gantt\n  title Launch plan\n')).toBe('Launch plan');
    expect(deriveTitle('pie title Pets\n "a": 1')).toBe('Pets');
    expect(deriveTitle('sequenceDiagram\n A->>B: hi')).toBe('Imported sequence diagram');
    expect(deriveTitle('weird')).toBe('Imported diagram');
    expect(importErrorMessage('incorrect header check')).toMatch(/valid mermaid.live link/);
    expect(importErrorMessage(new Error('No ```mermaid code block found'))).toMatch(
      /No ```mermaid/,
    );
  });
});
