import { SAMPLE_FAMILIES } from '../editor/samples';

/** Starting points offered when creating a board. */
export interface BoardTemplate {
  /** Also picks the illustration (DiagramArt). */
  id: 'empty' | 'sequence' | 'c4' | 'bpmn';
  name: string;
  /** What it is and when to use it. */
  description: string;
  /** Title for the new board. */
  title: string;
  code: string;
}

export const EMPTY_CODE = `flowchart TD
    %% Start writing your diagram here
`;

export const C4_CODE = `C4Context
    title System context: online store

    Person(customer, "Customer", "Browses and buys products")
    Person(support, "Support agent", "Handles orders and refunds")

    Enterprise_Boundary(company, "Our company") {
        System(store, "Online store", "Lets customers find and order products")
        SystemDb(orders, "Order database", "Orders, customers and stock")
    }

    Boundary(outside, "Outside services") {
        System_Ext(payments, "Payment provider", "Takes card payments")
        System_Ext(email, "Email service", "Sends order updates")
    }

    Rel(customer, store, "Places orders")
    Rel(support, store, "Manages orders")
    Rel(store, orders, "Reads and writes")
    Rel(store, payments, "Charges cards")
    Rel(store, email, "Sends emails")

    UpdateLayoutConfig($c4ShapeInRow="2", $c4BoundaryInRow="2")
`;

export const BPMN_CODE = `%% A BPMN-style process drawn with a flowchart:
%% lanes are subgraphs, events are circles, gateways are diamonds.
flowchart LR
    subgraph customer [Customer]
        start((Order placed)) --> pay(Pay for order)
    end
    subgraph shop [Shop]
        check(Check stock) --> inStock{In stock?}
        inStock -->|Yes| pack(Pack order)
        inStock -->|No| refund(Refund payment)
        refund --> cancelled(((Cancelled)))
    end
    subgraph courier [Courier]
        deliver(Deliver parcel) --> delivered(((Delivered)))
    end
    pay --> check
    pack --> deliver

    classDef event fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d
    classDef endEvent fill:#fee2e2,stroke:#dc2626,stroke-width:3px,color:#7f1d1d
    classDef task fill:#eff6ff,stroke:#2563eb,color:#1e3a8a
    classDef gateway fill:#fef9c3,stroke:#ca8a04,color:#713f12
    class start event
    class cancelled,delivered endEvent
    class pay,check,pack,refund,deliver task
    class inStock gateway
`;

const SEQUENCE = SAMPLE_FAMILIES.find((f) => f.id === 'sequence')!.examples[0]!;

/** Starting points, shown in the new-board picker and as "Most used" in the sample gallery. */
export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'empty',
    name: 'Empty',
    description: 'Start from scratch and write any Mermaid diagram yourself.',
    title: 'Untitled diagram',
    code: EMPTY_CODE,
  },
  {
    id: 'sequence',
    name: 'Sequence',
    description: 'Messages between people and systems, in the order they happen.',
    title: SEQUENCE.title,
    code: SEQUENCE.code,
  },
  {
    id: 'c4',
    name: 'C4',
    description:
      'People, systems and the links between them, from the big picture down to containers and components.',
    title: 'System context',
    code: C4_CODE,
  },
  {
    id: 'bpmn',
    name: 'BPMN',
    description:
      'A business process in swimlanes: start and end events, tasks, and yes/no decisions.',
    title: 'Order process',
    code: BPMN_CODE,
  },
];
