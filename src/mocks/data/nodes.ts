import type {
  NodeDto,
  NodeEgressDto,
  NodeMicroserviceDto,
  NodeTopicDto,
} from "@/types/api";

export const nodes: (
  | NodeMicroserviceDto
  | NodeTopicDto
  | NodeEgressDto
  | NodeDto
)[] = [
  {
    dtoType: "microservice",
    artifact: "me-depo-trades-murex-in-out",
    artifactVersion: "4.0.6",
    configUrl:
      "https://stash.sigma.sbrf.ru/projects/GMBUS/repos/config-repo/browse/me-depo-trades-murex-in-out",
    descriptionMd: null,
    faultTolerance:
      "active-active на нескольких кластерах Open Shift/Kuber",
    globalWhiteListHeaders: "",
    gmsbGen: "Gen4",
    id: 1,
    imageVersion: "m962j17r",
    interfaces: [],
    loadBalancing: "kafka-in: конкуренция потребителей kafka",
    name: "Микросервис me-depo-trades-murex-in-out",
    pelicanUrl:
      "https://stash.sigma.sbrf.ru/projects/GMBUS_UTILS/repos/pelican-gmsb-tests/browse/src/test/kotlin/ru/sberbank/gmsb/cib/pelican/tests/ait/me/depoOtcTcr/murex/MeDepoOtcTcrMurexTest.kt",
    resourceProfile:
      "resources:\r\n  limits:\r\n    cpu: 200m\r\n    memory: 620Mi\r\n  requests:\r\n    cpu: 100m\r\n    memory: 620Mi",
    scalability:
      "запуск дополнительных pod на каждом экземпляре Open Shift/Kuber",
    sourceUrl:
      "https://stash.sigma.sbrf.ru/projects/GMBUS/repos/me-depo-trades-murex-in-out/browse",
  },
  {
    dtoType: "topic",
    compressionType: "producer",
    descriptionMd: null,
    id: 2,
    interfaces: [],
    maxMessageBytes: 10485760,
    name: "Топик ME.DEPO.OTC-TCR.FIX.PAO",
    partitions: 5,
    replicationFactor: 6,
    retentionBytes: 367001600,
    retentionMs: 600000,
  },
  {
    dtoType: "topic",
    compressionType: "zstd",
    descriptionMd: null,
    id: 3,
    interfaces: [],
    maxMessageBytes: 10485760,
    name: "Топик ME.DEPO.OTC-TCR.FIX.PAO",
    partitions: 10,
    replicationFactor: 4,
    retentionBytes: -1,
    retentionMs: 604800000,
  },
  {
    dtoType: "topic",
    compressionType: "zstd",
    descriptionMd: null,
    id: 4,
    interfaces: [],
    maxMessageBytes: 10485760,
    name: "Топик ME.DEPO.OTC-TCR.FIXML.PAO.MUREX",
    partitions: 10,
    replicationFactor: 4,
    retentionBytes: -1,
    retentionMs: 604800000,
  },
  {
    dtoType: "egress",
    descriptionMd: null,
    id: 5,
    interfaces: [],
    name: "Егрес egressgateway-ci01142241-kafka",
    realHosts:
      "pvlsq-kssh00069.sigma.sbrf.ru, pvlsq-kssh00070.sigma.sbrf.ru, pvlsq-kssh00071.sigma.sbrf.ru, pvlsq-kssh00072.sigma.sbrf.ru, pvlsq-kssh00073.sigma.sbrf.ru, pvlsq-kssh00074.sigma.sbrf.ru",
    realPort: 9093,
    tls: "MTLS",
    virtualHost: "kafka.host",
  },
  {
    dtoType: "egress",
    descriptionMd: null,
    id: 6,
    interfaces: [],
    name: "Егрес egressgateway-ci01142241-db-murex-mx-db1",
    realHosts: "mx-db1.sigma.sbrf.ru",
    realPort: 6000,
    tls: "NONE",
    virtualHost: "mx-db1.db.host",
  },
  {
    dtoType: "egress",
    descriptionMd: null,
    id: 7,
    interfaces: [],
    name: "Егрес egressgateway-ci01142241-http-ecosystem-brd",
    realHosts: "brd.prom-138-139-apps.ocp-geo.ocp.sigma.sbrf.ru",
    realPort: 443,
    tls: "SIMPLE",
    virtualHost: "ecosystem-brd.host",
  },
  {
    dtoType: "node",
    descriptionMd: null,
    id: 8,
    interfaces: [],
    name: "АС Matching Engine",
  },
  {
    dtoType: "node",
    descriptionMd: null,
    id: 9,
    interfaces: [],
    name: "АС SEDR",
  },
  {
    dtoType: "node",
    descriptionMd: null,
    id: 10,
    interfaces: [],
    name: "АС Murex",
  },
  {
    dtoType: "node",
    descriptionMd: null,
    id: 11,
    interfaces: [],
    name: "Веб-сервис Ecosystem BRD",
  },
  {
    dtoType: "node",
    descriptionMd: null,
    id: 12,
    interfaces: [],
    name: "БД Murex STR",
  },
];
