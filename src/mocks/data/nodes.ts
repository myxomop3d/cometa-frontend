import type { NodeDto } from "@/types/api";
import { automatedSystems } from "./automated-systems";

const as = (id: number) => automatedSystems.find((a) => a.id === id) ?? null;

export const nodes: NodeDto[] = [
  // ── Flow 99, PROD ────────────────────────────────────────────────
  {
    id: 1,
    insertedAt: "2025-11-03T10:15:00",
    updatedAt: "2026-01-12T09:30:00",
    nodeType: "INGRESS",
    name: "gm-ingress",
    environment: "PROD",
    automatedSystem: as(1451),
  },
  {
    id: 2,
    insertedAt: "2025-11-03T10:15:00",
    updatedAt: "2026-02-20T14:00:00",
    nodeType: "MICROSERVICE",
    name: "me-depo-adapter",
    environment: "PROD",
    automatedSystem: as(1451),
    data: {
      "application.yml": {
        server: { port: 8080 },
        spring: { application: { name: "me-depo-adapter" } },
        kafka: {
          "bootstrap-servers": "kafka-prod:9092",
          producer: { acks: "all", retries: 3 },
        },
      },
      "manifest.yml": {
        replicas: 3,
        resources: { cpu: "500m", memory: "512Mi" },
      },
    },
  },
  {
    id: 3,
    insertedAt: "2025-11-03T10:15:00",
    updatedAt: "2025-12-01T08:45:00",
    nodeType: "TOPIC",
    name: "gm.depo.otc-tcr.v1",
    environment: "PROD",
    automatedSystem: as(1751),
    data: {
      partitions: 12,
      replicationFactor: 3,
      "retention.ms": 604800000,
      "compression.type": "lz4",
    },
  },
  {
    id: 4,
    insertedAt: "2025-11-03T10:16:00",
    updatedAt: "2026-02-01T11:20:00",
    nodeType: "MICROSERVICE",
    name: "depo-writer",
    environment: "PROD",
    automatedSystem: as(1751),
  },
  {
    id: 5,
    insertedAt: "2025-11-03T10:16:00",
    updatedAt: "2025-11-03T10:16:00",
    nodeType: "EGRESS",
    name: "calypso-egress",
    environment: "PROD",
    automatedSystem: as(1751),
    data: {
      realHosts: "calypso-prod-01,calypso-prod-02",
      realPort: 8443,
      tls: "TLSv1.3",
    },
  },

  // ── Flow 99, DEV ─────────────────────────────────────────────────
  {
    id: 11,
    insertedAt: "2025-10-01T12:00:00",
    updatedAt: "2026-03-15T16:40:00",
    nodeType: "MICROSERVICE",
    name: "me-depo-adapter",
    environment: "DEV",
    automatedSystem: as(1451),
    data: {
      "application.yml": {
        server: { port: 8080 },
        kafka: { "bootstrap-servers": "kafka-dev:9092" },
      },
    },
  },
  {
    id: 12,
    insertedAt: "2025-10-01T12:00:00",
    updatedAt: "2025-10-01T12:00:00",
    nodeType: "TOPIC",
    name: "gm.depo.otc-tcr.v1",
    environment: "DEV",
    automatedSystem: as(1751),
    data: { partitions: 3, replicationFactor: 1 },
  },
  {
    id: 13,
    insertedAt: "2025-10-01T12:01:00",
    updatedAt: "2025-10-01T12:01:00",
    nodeType: "MICROSERVICE",
    name: "depo-writer",
    environment: "DEV",
    automatedSystem: as(1751),
  },

  // ── Flow 2, PROD ─────────────────────────────────────────────────
  {
    id: 21,
    insertedAt: "2025-09-10T09:00:00",
    updatedAt: "2025-09-10T09:00:00",
    nodeType: "MICROSERVICE",
    name: "quik-nto-adapter",
    environment: "PROD",
    automatedSystem: as(1),
  },
  {
    id: 22,
    insertedAt: "2025-09-10T09:00:00",
    updatedAt: "2025-09-10T09:00:00",
    nodeType: "TOPIC",
    name: "gm.quik.nto.v1",
    environment: "PROD",
    automatedSystem: as(1),
    data: { partitions: 6, replicationFactor: 3 },
  },
];
