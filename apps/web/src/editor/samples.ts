import { diagramData } from '@mermaid-js/examples';

export interface Sample {
  title: string;
  code: string;
}
export interface SampleFamily {
  name: string;
  description: string;
  examples: Sample[];
}

const PRIORITY = ['Flowchart', 'Class', 'Sequence', 'Entity Relationship', 'State', 'Mindmap'];

const ZENUML: SampleFamily = {
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
  const fams: SampleFamily[] = diagramData
    .filter((d) => d.name && d.examples?.length)
    .map((d) => ({
      name: d.name.replace(/ (Diagram|Chart|Graph)$/, '').replace(/ (Diagram|Chart|Graph) /, ' '),
      description: d.description,
      examples: [...d.examples]
        .sort((a, b) => Number(b.isDefault ?? false) - Number(a.isDefault ?? false))
        .map((e) => ({ title: e.title, code: e.code })),
    }));
  fams.push(ZENUML);
  return fams.sort((a, b) => {
    const pa = PRIORITY.indexOf(a.name);
    const pb = PRIORITY.indexOf(b.name);
    if (pa >= 0 || pb >= 0) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    return a.name.localeCompare(b.name);
  });
})();
