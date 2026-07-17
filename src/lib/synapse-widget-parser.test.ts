import { describe, expect, it } from 'vitest';

import { parseSynapseWidgetFromContent, parseSynapseWidgetsFromContent } from './synapse-widget-parser';

describe('Synapse widget parser', () => {
  it('keeps Markdown and extracts every structured widget fence', () => {
    const content = [
      '## Resultado',
      '',
      '- Dois itens encontrados',
      '',
      '```json',
      '{"__actionType":"list_patients","data":{"patients":[]}}',
      '```',
      '',
      'Texto entre widgets.',
      '',
      '```synapse',
      '{"type":"get_calendar","data":{"appointments":[]}}',
      '```',
    ].join('\n');

    const parsed = parseSynapseWidgetsFromContent(content);

    expect(parsed.cleanContent).toContain('## Resultado');
    expect(parsed.cleanContent).toContain('- Dois itens encontrados');
    expect(parsed.cleanContent).toContain('Texto entre widgets.');
    expect(parsed.widgetData).toHaveLength(2);
    expect(parsed.widgetData.map((widget) => widget.__actionType || widget.type)).toEqual([
      'list_patients',
      'get_calendar',
    ]);
  });

  it('keeps the legacy single-widget API compatible', () => {
    const parsed = parseSynapseWidgetFromContent('{"__actionType":"get_financial_metrics","data":{}}');

    expect(parsed.cleanContent).toBe('');
    expect(parsed.widgetData?.__actionType).toBe('get_financial_metrics');
  });

  it('leaves ordinary JSON code blocks in Markdown', () => {
    const content = '```json\n{"name":"NeuroNex"}\n```';
    const parsed = parseSynapseWidgetsFromContent(content);

    expect(parsed.cleanContent).toBe(content);
    expect(parsed.widgetData).toEqual([]);
  });
});
