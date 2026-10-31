// Load the editor core + contributions without the ~80 bundled languages.
import 'monaco-editor/esm/vs/editor/edcore.main.js';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import * as jsonContribution from 'monaco-editor/esm/vs/language/json/monaco.contribution.js';
import type * as MonacoFull from 'monaco-editor';
import type { json as JsonNamespace } from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import { registerMermaidCompletions } from './completions';
import configSchema from './mermaid-config.schema.json';
import { initEditor } from './mermaidLanguage';

self.MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    if (label === 'json') return new jsonWorker();
    return new editorWorker();
  },
};

const json = jsonContribution as unknown as typeof JsonNamespace;
let initialized = false;

/** One-time Monaco setup: mermaid language, themes, completions, config schema. */
export function setupMonaco() {
  if (initialized) return monaco;
  initialized = true;
  // editor.api's typings are a subset of the full package; the runtime objects are the same.
  const full = monaco as unknown as typeof MonacoFull;
  initEditor(full);
  registerMermaidCompletions(full);
  json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: false,
    enableSchemaRequest: false,
    schemas: [
      {
        uri: 'https://mermaid.js.org/schemas/config.schema.json',
        fileMatch: ['*config.json'],
        schema: configSchema,
      },
    ],
  });
  return monaco;
}

export { monaco };
