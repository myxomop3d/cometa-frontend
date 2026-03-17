import { automatedSystemHandlers } from "./handlers/automated-system";
import { nodeHandlers } from "./handlers/node";
import { linkHandlers } from "./handlers/link";
import { interfaceHandlers } from "./handlers/interface";
import { flowGraphHandlers } from "./handlers/flow-graph";

export const handlers = [
  ...automatedSystemHandlers,
  ...nodeHandlers,
  ...linkHandlers,
  ...interfaceHandlers,
  ...flowGraphHandlers,
];
