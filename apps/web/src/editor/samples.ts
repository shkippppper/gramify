import { diagramData } from '@mermaid-js/examples';

export interface Sample {
  title: string;
  code: string;
}
export interface SampleFamily {
  /** Stable slug, e.g. `flowchart`, `entity-relationship`: picks the family's illustration. */
  id: string;
  name: string;
  description: string;
  examples: Sample[];
  /** Notations of the same diagram type, offered as a choice on its tile (Railroad). */
  variants?: { label: string; example: Sample }[];
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const PRIORITY = ['Flowchart', 'Class', 'Sequence', 'Entity Relationship', 'State', 'Mindmap'];

const ZENUML: SampleFamily = {
  id: 'zenuml',
  name: 'ZenUML',
  description: 'Sequence diagrams with a code-like syntax',
  examples: [
    {
      title: 'Order Service',
      code: `zenuml
    title Order Service
    @Actor Client #FFEBE6
    @Boundary OrderController #0747A6
    @EC2 <<BFF>> OrderService #E3FCEF
    group BusinessService {
      @Lambda PurchaseService
      @AzureFunction InvoiceService
    }

    @Starter(Client)
    // \`POST /orders\`
    OrderController.post(payload) {
      OrderService.create(payload) {
        order = new Order(payload)
        if(order != null) {
          par {
            PurchaseService.createPO(order)
            InvoiceService.createInvoice(order)
          }
        }
      }
    }`,
    },
  ],
};

export const SAMPLE_FAMILIES: SampleFamily[] = (() => {
  const all: SampleFamily[] = diagramData
    .filter((d) => d.name && d.examples?.length)
    .map((d) => {
      const name = d.name
        .replace(/ (Diagram|Chart|Graph)$/, '')
        .replace(/ (Diagram|Chart|Graph) /, ' ');
      return {
        id: slug(name),
        name,
        description: d.description,
        examples: [...d.examples]
          .sort((a, b) => Number(b.isDefault ?? false) - Number(a.isDefault ?? false))
          .map((e) => ({ title: e.title, code: e.code })),
      };
    });

  // Mermaid ships one family per railroad notation (IR, EBNF, ABNF, PEG): show them as one
  // Railroad type whose tile offers the notation.
  const railroads = all.filter((f) => f.name.startsWith('Railroad'));
  const fams = all.filter((f) => !f.name.startsWith('Railroad'));
  if (railroads.length) {
    const variants = railroads.map((f) => ({
      label: /\(([^)]+)\)/.exec(f.name)?.[1] ?? f.name,
      examples: f.examples,
    }));
    fams.push({
      id: 'railroad',
      name: 'Railroad',
      description: `Grammar rules as railroad (syntax) diagrams, in ${variants.map((v) => v.label).join(', ')} notation`,
      examples: variants.flatMap((v) =>
        v.examples.map((e) => ({ ...e, title: `${v.label} · ${e.title}` })),
      ),
      variants: variants.map((v) => ({ label: v.label, example: v.examples[0]! })),
    });
  }
  fams.push(ZENUML);
  return fams.sort((a, b) => {
    const pa = PRIORITY.indexOf(a.name);
    const pb = PRIORITY.indexOf(b.name);
    if (pa >= 0 || pb >= 0) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    return a.name.localeCompare(b.name);
  });
})();
