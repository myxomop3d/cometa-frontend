import type { LinkDto } from "@/types/api";
import { interfaces } from "./interfaces";

function findInterface(id: number) {
  return interfaces.find((i) => i.id === id)!;
}

export const links: LinkDto[] = [
  {
    id: 1001,
    flowId: 1,
    clientInterface: findInterface(601),
    serverInterface: findInterface(101),
    dataFlowDirection: "CLIENT_TO_SERVER",
  },
  {
    id: 1002,
    flowId: 1,
    clientInterface: findInterface(102),
    serverInterface: findInterface(301),
    dataFlowDirection: "CLIENT_TO_SERVER",
  },
  {
    id: 1003,
    flowId: 2,
    clientInterface: findInterface(602),
    serverInterface: findInterface(201),
    dataFlowDirection: "CLIENT_TO_SERVER",
  },
  {
    id: 1004,
    flowId: 2,
    clientInterface: findInterface(601),
    serverInterface: findInterface(202),
    dataFlowDirection: "CLIENT_TO_SERVER",
  },
  {
    id: 1005,
    flowId: 1,
    clientInterface: findInterface(302),
    serverInterface: findInterface(603),
    dataFlowDirection: "CLIENT_TO_SERVER",
  },
  {
    id: 1006,
    flowId: 3,
    clientInterface: findInterface(902),
    serverInterface: findInterface(701),
    dataFlowDirection: "CLIENT_TO_SERVER",
  },
  {
    id: 1007,
    flowId: 3,
    clientInterface: findInterface(702),
    serverInterface: findInterface(1001),
    dataFlowDirection: "CLIENT_TO_SERVER",
  },
  {
    id: 1008,
    flowId: 3,
    clientInterface: findInterface(601),
    serverInterface: findInterface(901),
    dataFlowDirection: "CLIENT_TO_SERVER",
  },
];
