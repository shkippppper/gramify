import type * as Monaco from 'monaco-editor';

/** Diagram headers offered as snippets (first keyword of a diagram). */
const HEADERS: Array<[label: string, snippet: string, detail: string]> = [
  ['flowchart', 'flowchart ${1|TD,LR,BT,RL|}\n    ${2:A} --> ${3:B}', 'Flowchart'],
  ['sequenceDiagram', 'sequenceDiagram\n    ${1:Alice}->>${2:Bob}: ${3:Hello}', 'Sequence diagram'],
  ['classDiagram', 'classDiagram\n    class ${1:Animal} {\n        +String name\n    }', 'Class diagram'],
  ['stateDiagram-v2', 'stateDiagram-v2\n    [*] --> ${1:Still}\n    ${1:Still} --> [*]', 'State diagram'],
  ['erDiagram', 'erDiagram\n    ${1:CUSTOMER} ||--o{ ${2:ORDER} : places', 'Entity relationship'],
  ['journey', 'journey\n    title ${1:My day}\n    section ${2:Morning}\n      ${3:Wake up}: 5: Me', 'User journey'],
  ['gantt', 'gantt\n    title ${1:Plan}\n    dateFormat YYYY-MM-DD\n    section ${2:Phase}\n    ${3:Task} :a1, 2026-01-01, 7d', 'Gantt'],
  ['pie', 'pie title ${1:Pets}\n    "${2:Dogs}" : ${3:40}\n    "${4:Cats}" : ${5:60}', 'Pie chart'],
  ['quadrantChart', 'quadrantChart\n    title ${1:Reach and engagement}\n    x-axis Low --> High\n    y-axis Low --> High', 'Quadrant chart'],
  ['requirementDiagram', 'requirementDiagram\n    requirement ${1:req} {\n      id: 1\n      text: ${2:text}\n    }', 'Requirement'],
  ['gitGraph', 'gitGraph\n    commit\n    branch ${1:develop}\n    commit\n    checkout main\n    merge ${1:develop}', 'Git graph'],
  ['C4Context', 'C4Context\n    title ${1:System Context}\n    Person(${2:user}, "${3:User}")', 'C4'],
  ['mindmap', 'mindmap\n  root((${1:topic}))\n    ${2:idea}', 'Mindmap'],
  ['timeline', 'timeline\n    title ${1:History}\n    ${2:2024} : ${3:Event}', 'Timeline'],
  ['sankey', 'sankey\n\n${1:A},${2:B},${3:10}', 'Sankey'],
  ['xychart', 'xychart\n    title "${1:Sales}"\n    x-axis [jan, feb, mar]\n    y-axis "Revenue" 0 --> 100\n    bar [10, 50, 80]', 'XY chart'],
  ['block', 'block\n  columns ${1:3}\n  a b c', 'Block diagram'],
  ['packet', 'packet\n  0-15: "${1:Source Port}"\n  16-31: "${2:Destination Port}"', 'Packet'],
  ['kanban', 'kanban\n  ${1:Todo}\n    ${2:task}[${3:Write docs}]', 'Kanban'],
  ['architecture-beta', 'architecture-beta\n    group ${1:api}(cloud)[API]\n    service ${2:db}(database)[Database] in ${1:api}', 'Architecture'],
  ['radar-beta', 'radar-beta\n  axis a["A"], b["B"], c["C"]\n  curve x{1, 2, 3}', 'Radar'],
  ['treemap', 'treemap\n"${1:Root}"\n    "${2:Leaf}": ${3:10}', 'Treemap'],
];

const KEYWORDS: Record<string, string[]> = {
  flowchart: ['subgraph', 'end', 'direction', 'classDef', 'class', 'style', 'linkStyle', 'click', 'TD', 'TB', 'LR', 'RL', 'BT'],
  sequenceDiagram: ['participant', 'actor', 'as', 'loop', 'alt', 'else', 'opt', 'par', 'and', 'critical', 'break', 'rect', 'end', 'Note', 'note right of', 'note left of', 'note over', 'activate', 'deactivate', 'autonumber', 'create', 'destroy', 'box'],
  classDiagram: ['class', 'namespace', 'direction', 'note', 'note for', 'classDef', 'style', '<<interface>>', '<<abstract>>', '<<enumeration>>'],
  stateDiagram: ['state', 'note', 'end note', 'direction', '[*]', '<<fork>>', '<<join>>', '<<choice>>', 'classDef', 'class'],
  erDiagram: ['||--o{', '}o--o{', '||--||', 'PK', 'FK', 'UK', 'direction'],
  gantt: ['title', 'dateFormat', 'axisFormat', 'tickInterval', 'excludes', 'includes', 'todayMarker', 'section', 'done', 'active', 'crit', 'milestone', 'after'],
  gitGraph: ['commit', 'branch', 'checkout', 'switch', 'merge', 'cherry-pick', 'id:', 'tag:', 'type:', 'HIGHLIGHT', 'REVERSE', 'NORMAL'],
  journey: ['title', 'section'],
  mindmap: ['root', '::icon()'],
  timeline: ['title', 'section'],
  pie: ['title', 'showData'],
};

const COMMON = ['%%', 'accTitle:', 'accDescr:', 'title'];

function typeOf(model: Monaco.editor.ITextModel): string | undefined {
  for (const raw of model.getLinesContent()) {
    const line = raw.trim();
    if (!line || line.startsWith('%%') || line === '---') continue;
    const word = line.split(/[\s{]/)[0] ?? '';
    if (word === 'graph' || word.startsWith('flowchart')) return 'flowchart';
    if (word.startsWith('stateDiagram')) return 'stateDiagram';
    return word;
  }
  return undefined;
}

export function registerMermaidCompletions(monaco: typeof Monaco) {
  return monaco.languages.registerCompletionItemProvider('mermaid', {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const type = typeOf(model);
      const isHeaderPosition = !type || model.getLineContent(position.lineNumber).trim() === word.word && position.lineNumber === 1;
      const suggestions: Monaco.languages.CompletionItem[] = [];
      if (isHeaderPosition) {
        for (const [label, snippet, detail] of HEADERS) {
          suggestions.push({
            label,
            detail,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          });
        }
      }
      for (const kw of [...(type ? (KEYWORDS[type] ?? []) : []), ...COMMON]) {
        suggestions.push({ label: kw, kind: monaco.languages.CompletionItemKind.Keyword, insertText: kw, range });
      }
      return { suggestions };
    },
  });
}
