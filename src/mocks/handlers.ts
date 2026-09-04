import { authHandlers } from "./handlers/auth";
import { nodeHandlers } from "./handlers/node";
import { linkHandlers } from "./handlers/link";
import { flowGraphHandlers } from "./handlers/flow-graph";
import { boxHandlers } from "./handlers/box";
import { itemHandlers } from "./handlers/item";
import { thingHandlers } from "./handlers/thing";
import { flowHandlers } from "./handlers/flow";

export const handlers = [
  ...authHandlers,
  ...nodeHandlers,
  ...linkHandlers,
  ...flowGraphHandlers,
  ...boxHandlers,
  ...itemHandlers,
  ...thingHandlers,
  ...flowHandlers,
];
