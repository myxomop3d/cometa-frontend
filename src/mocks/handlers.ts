import { automatedSystemHandlers } from "./handlers/automated-system";
import { nodeHandlers } from "./handlers/node";
import { linkHandlers } from "./handlers/link";
import { interfaceHandlers } from "./handlers/interface";
import { flowGraphHandlers } from "./handlers/flow-graph";
import { boxHandlers } from "./handlers/box";
import { itemHandlers } from "./handlers/item";
import { thingHandlers } from "./handlers/thing";

export const handlers = [
  ...automatedSystemHandlers,
  ...nodeHandlers,
  ...linkHandlers,
  ...interfaceHandlers,
  ...flowGraphHandlers,
  ...boxHandlers,
  ...itemHandlers,
  ...thingHandlers,
];
