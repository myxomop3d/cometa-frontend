# `./mvnw test` without `clean` fails test compilation

Confirmed reproducible 2026-09-23 on the backend repo (`cometa`). Not new, but
previously recorded only as folklore ("mappers act up, run clean").

## Problem

Running `./mvnw test` (or `install`) on a tree that already has populated
`target/` directories fails in `cometa-service-module` test compilation:

```
[ERROR] ...AutomatedSystemMapperWriteTest.java: cannot access Person
[ERROR]   class file for Person not found
[ERROR] ...AutomatedSystemMapperWriteTest.java: incompatible types:
          AutomatedSystem cannot be converted to ru.sberbank.cib.gmbus.entity.AutomatedSystem
```

The tell is a class failing to convert **to itself** — two class objects for
one fully-qualified name. On an incremental build the service module's test
compilation resolves `cometa-persistence-module` from both the sibling
`target/classes` and a stale `.m2` jar. It hits ordinary entities (`Person`,
`AutomatedSystem`, `NodeAggrType`, `MicroserviceNameAggrData`), not only
MapStruct output, so it is broader than the fork-javac issue addressed by
commits `4dd4f36` and `f9ce665`.

Reproduced deterministically:

| command | result |
|---|---|
| `./mvnw test` on a populated tree | FAIL |
| `./mvnw clean test` | BUILD SUCCESS (106 tests) |

## Why it is worth fixing rather than documenting

The failure looks random, so it gets misdiagnosed. During the Node→TechComponent
link work a subagent hit it, retried once, got a pass, and reported it as a
transient Windows file-lock fluke; it then reproduced immediately on the next
clean-less build. Anyone can lose an hour to this, and the mitigation (always
`clean`) costs a full rebuild on every test run.

## Where to look

- Backend repo (`cometa`): root `pom.xml` (compiler plugin / annotation
  processing config), and the two prior attempts at this class of problem,
  commits `4dd4f36` "fork javac to stop silent MapStruct mapper corruption"
  and `f9ce665`
- `cometa/docs/superpowers/plans/2026-09-23-node-tech-component-link.md`
  — *Build and test commands*, which records the `clean` and `-am` rules
