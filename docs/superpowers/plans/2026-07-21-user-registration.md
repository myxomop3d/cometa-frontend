# User Self-Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an unauthenticated user register from the login page — creating a user account, a person (or updating an existing one), and an optional person↔team link — then redirect to login.

**Architecture:** New public `POST /api/v1/auth/register` orchestrates account creation transactionally. Person and Team become CRUD resources on the existing `EntityGraphBaseCrud*` pattern (mirroring `Flow`); the team combobox reuses the Flow server-side search pattern (OData `$top` + `$filter`). Two public read endpoints (`check-sigma-login`, `person-by-email`) back the on-blur validations. Frontend adds a `/register` route with a react-hook-form + zod form.

**Tech Stack:** Backend — Java 17, Spring Boot 4 / Spring Security 7, Hibernate 7, Lombok, MapStruct, `ru.sber.cs.core` odata-mini lib, PostgreSQL. Frontend — React 19, Vite 8, TanStack Router/Query, react-hook-form, zod, shadcn/ui, vitest.

**Design spec:** `docs/superpowers/specs/2026-07-21-user-registration-design.md`

## Global Constraints

- **Two repos.** Backend at `F:\programming\cometa` (remote `github`, branch `feature/gm`). Frontend at `F:\programming\react\cometa-frontend` (remote `origin`, branch `feature/gm`). Each task's commit happens in that task's repo dir.
- **Default role code:** `"developer"` (exact string; `user_account.role_id` is NOT NULL).
- **New account is active immediately:** `is_active = true`.
- **Password:** minimum 8 characters; `passwordConfirm` must equal `password`.
- **sigmaLogin:** exactly 8 digits — regex `/^\d{8}$/`.
- **One account per person:** enforced at DB (unique index `idx_user_account_person_id`) and in `RegistrationService` (409).
- **Endpoint auth:** `SecurityConfig` already `permitAll` on `/api/v1/auth/**`, so `register`, `check-sigma-login`, `person-by-email` are public with no change. The **only** security change: permit `GET /api/v1/team`. Person CRUD stays authenticated.
- **DB changes** go through a new script in `db-scripts/ddl/`, then execute it against the DB (per project rule) — never ad-hoc DDL.
- **Mappers stay empty** (`@Mapper(config = CometaCommonMapperConfig.class)` interface, no methods), exactly like `FlowMapper`. `PersonDto`/`TeamDto` intentionally omit the entity's association fields (`Person.teams`, `Team.leader`) so MapStruct needs no custom mapping (unmapped-target defaults to WARN, which compiles).
- **Never edit** `src/routeTree.gen.ts` (auto-generated).
- **Backend build regenerates MapStruct/Lombok** — use the Maven wrapper from the backend root; a per-module compile with `-am` regenerates dependent generated sources.

---

## File Structure

**Backend (`F:\programming\cometa`):**
- `db-scripts/ddl/013_user_account_person_unique.sql` — one-account-per-person unique index (Task 1).
- `cometa-service-module/.../service/dto/PersonDto.java`, `TeamDto.java`, `RegisterRequest.java`.
- `cometa-persistence-module/.../repository/PersonCrudRepository.java`, `TeamCrudRepository.java`, `PersonRepository.java`, `TeamRepository.java`, `UserRoleRepository.java`; edit `UserAccountRepository.java`.
- `cometa-service-module/.../service/mapper/PersonMapper.java`, `TeamMapper.java`.
- `cometa-service-module/.../service/PersonService.java`, `TeamService.java`, `RegistrationService.java`; `service/exception/RegistrationConflictException.java`.
- `cometa-web-module/.../web/api/v1/PersonRestController.java`, `TeamRestController.java`; edit `AuthController.java`, `web/config/SecurityConfig.java`.
- `cometa-service-module/src/test/java/.../service/RegistrationServiceTest.java`.

**Frontend (`F:\programming\react\cometa-frontend`):**
- `src/types/api.ts` (edit — add DTOs/requests).
- `src/api/auth.ts` (edit — add register/check/person-by-email).
- `src/features/team/api.ts`, `src/features/team/components/team-combobox.tsx`.
- `src/features/register/schema.ts`, `helpers.ts`, `schema.test.ts`, `helpers.test.ts`.
- `src/routes/register.tsx`.
- `src/routes/login.tsx` (edit — Register button), `src/routes/__root.tsx` (edit — allowlist `/register`).

---

## Task 1: DB — one-account-per-person unique index

**Files:**
- Create: `F:\programming\cometa\db-scripts\ddl\013_user_account_person_unique.sql`

**Interfaces:**
- Produces: unique index `gmsb.idx_user_account_person_id` on `user_account(person_id)`.

- [ ] **Step 1: Write the DDL script**

`db-scripts/ddl/013_user_account_person_unique.sql`:
```sql
-- ============================================================
-- Одна учётная запись на одного человека.
-- Уникальный индекс на user_account.person_id — backstop против гонок
-- при саморегистрации (основная проверка — в RegistrationService).
-- ============================================================
CREATE UNIQUE INDEX idx_user_account_person_id ON gmsb.user_account (person_id);
```

- [ ] **Step 2: Execute it against the DB**

Run the script's SQL against the `gmsb` schema (Postgres MCP `pg_execute_sql`, transactional, or the project's usual psql path). Note: this succeeds only if no two existing `user_account` rows already share a `person_id` (the table was wiped in DDL 010, so it is empty or minimal).

- [ ] **Step 3: Verify the index exists**

Query:
```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = 'gmsb' AND indexname = 'idx_user_account_person_id';
```
Expected: one row `idx_user_account_person_id`.

- [ ] **Step 4: Commit** (cwd `F:\programming\cometa`)

```bash
git add db-scripts/ddl/013_user_account_person_unique.sql
git commit -m "feat(db): unique index enforcing one user_account per person"
```

---

## Task 2: Person CRUD resource

Mirror the `Flow` resource exactly. Person CRUD stays authenticated (no SecurityConfig change).

**Files:**
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/dto/PersonDto.java`
- Create: `cometa-persistence-module/src/main/java/ru/sberbank/cib/gmbus/repository/PersonCrudRepository.java`
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/mapper/PersonMapper.java`
- Create: `cometa-service-module/src/main/java/ru/sberbank/cib/gmbus/service/PersonService.java`
- Create: `cometa-web-module/src/main/java/ru/sberbank/cib/gmbus/web/api/v1/PersonRestController.java`

**Interfaces:**
- Produces: `PersonDto` (`id`, `insertedAt`, `updatedAt`, `email`, `lastName`, `firstName`, `middleName`); a Spring bean `PersonMapper` (`BaseCrudMapper<Person, PersonDto>`) reused by Task 5; `GET /api/v1/person` OData list.

- [ ] **Step 1: Create `PersonDto`**

```java
package ru.sberbank.cib.gmbus.service.dto;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@EqualsAndHashCode(callSuper = true)
public class PersonDto extends BaseEntityDto {

    private String email;
    private String lastName;
    private String firstName;
    private String middleName;

}
```

- [ ] **Step 2: Create `PersonCrudRepository`**

```java
package ru.sberbank.cib.gmbus.repository;

import org.springframework.stereotype.Repository;
import ru.sberbank.cib.gmbus.entity.auth.Person;

@Repository
public class PersonCrudRepository extends EntityGraphBaseCrudRepository<Person, Long> {
}
```

- [ ] **Step 3: Create `PersonMapper`** (empty, like `FlowMapper`)

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.mapstruct.Mapper;
import ru.sber.cs.core.odata.mini.repo.mapper.BaseCrudMapper;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.service.dto.PersonDto;

@Mapper(config = CometaCommonMapperConfig.class)
public interface PersonMapper extends BaseCrudMapper<Person, PersonDto> {

}
```

- [ ] **Step 4: Create `PersonService`**

```java
package ru.sberbank.cib.gmbus.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.service.dto.PersonDto;

@RequiredArgsConstructor
@Service
public class PersonService extends EntityGraphBaseCrudService<Person, PersonDto, Long> {

}
```

- [ ] **Step 5: Create `PersonRestController`**

```java
package ru.sberbank.cib.gmbus.web.api.v1;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.sberbank.cib.gmbus.service.dto.PersonDto;

@AllArgsConstructor
@Tag(name = "Person", description = "Физические лица")
@RestController
@RequestMapping("/api/${application.api.version}/person")
public class PersonRestController extends EntityGraphBaseCrudController<PersonDto, Long> {

}
```

- [ ] **Step 6: Compile (regenerates MapStruct)** (cwd `F:\programming\cometa`)

Run: `./mvnw -q -pl cometa-web-module -am test-compile`
Expected: BUILD SUCCESS (Person mapper/service/controller resolve; `ODataEntityGraphMiniService<?, PersonDto, Long>` bean = `PersonService`).

- [ ] **Step 7: Commit**

```bash
git add cometa-service-module cometa-persistence-module cometa-web-module
git commit -m "feat(person): expose Person as a CRUD resource"
```

---

## Task 3: Team CRUD resource + public team list

Mirror `Flow`. `TeamDto` omits `leader` (association) so `TeamMapper` stays empty. Permit public `GET /api/v1/team`.

**Files:**
- Create: `cometa-service-module/.../service/dto/TeamDto.java`
- Create: `cometa-persistence-module/.../repository/TeamCrudRepository.java`
- Create: `cometa-service-module/.../service/mapper/TeamMapper.java`
- Create: `cometa-service-module/.../service/TeamService.java`
- Create: `cometa-web-module/.../web/api/v1/TeamRestController.java`
- Modify: `cometa-web-module/.../web/config/SecurityConfig.java` (add one matcher)

**Interfaces:**
- Produces: `TeamDto` (`id`, `insertedAt`, `updatedAt`, `name`, `code`, `type`, `leaderRole`, `structure`); public `GET /api/v1/team` OData list (`$top`, `$filter`).

- [ ] **Step 1: Create `TeamDto`** (`type` is the enum name as String; `leader`/`code` note below)

```java
package ru.sberbank.cib.gmbus.service.dto;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@EqualsAndHashCode(callSuper = true)
public class TeamDto extends BaseEntityDto {

    private String name;
    private Integer code;
    private String type; // TeamType enum name (CHANGE / RUN) — MapStruct maps enum<->String by name.
    private String leaderRole;
    private String structure;

}
```

- [ ] **Step 2: Create `TeamCrudRepository`**

```java
package ru.sberbank.cib.gmbus.repository;

import org.springframework.stereotype.Repository;
import ru.sberbank.cib.gmbus.entity.auth.Team;

@Repository
public class TeamCrudRepository extends EntityGraphBaseCrudRepository<Team, Long> {
}
```

- [ ] **Step 3: Create `TeamMapper`** (empty)

```java
package ru.sberbank.cib.gmbus.service.mapper;

import org.mapstruct.Mapper;
import ru.sber.cs.core.odata.mini.repo.mapper.BaseCrudMapper;
import ru.sberbank.cib.gmbus.entity.auth.Team;
import ru.sberbank.cib.gmbus.service.dto.TeamDto;

@Mapper(config = CometaCommonMapperConfig.class)
public interface TeamMapper extends BaseCrudMapper<Team, TeamDto> {

}
```

- [ ] **Step 4: Create `TeamService`**

```java
package ru.sberbank.cib.gmbus.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.sberbank.cib.gmbus.entity.auth.Team;
import ru.sberbank.cib.gmbus.service.dto.TeamDto;

@RequiredArgsConstructor
@Service
public class TeamService extends EntityGraphBaseCrudService<Team, TeamDto, Long> {

}
```

- [ ] **Step 5: Create `TeamRestController`**

```java
package ru.sberbank.cib.gmbus.web.api.v1;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.sberbank.cib.gmbus.service.dto.TeamDto;

@AllArgsConstructor
@Tag(name = "Team", description = "Команды")
@RestController
@RequestMapping("/api/${application.api.version}/team")
public class TeamRestController extends EntityGraphBaseCrudController<TeamDto, Long> {

}
```

- [ ] **Step 6: Permit public read of the team list**

In `SecurityConfig.securityFilterChain`, add a matcher **before** `.anyRequest().authenticated()`. Add the `HttpMethod` import.

Add import near the other Spring imports:
```java
import org.springframework.http.HttpMethod;
```
Change the `authorizeHttpRequests` block to:
```java
.authorizeHttpRequests(auth -> auth
        .requestMatchers("/api/v1/auth/**").permitAll()
        .requestMatchers(HttpMethod.GET, "/api/v1/team", "/api/v1/team/**").permitAll()
        .requestMatchers("/swagger-ui/**", "/api-docs/**").permitAll()
        .requestMatchers("/actuator/health").permitAll()
        .anyRequest().authenticated()
)
```
(Team **writes** remain guarded — the base controller annotates `create/update/patch/delete` with `@PreAuthorize`, and only `GET` is permitted here.)

- [ ] **Step 7: Compile** (cwd `F:\programming\cometa`)

Run: `./mvnw -q -pl cometa-web-module -am test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 8: Commit**

```bash
git add cometa-service-module cometa-persistence-module cometa-web-module
git commit -m "feat(team): Team CRUD resource with public read for combobox"
```

---

## Task 4: Registration repositories + service (+ unit tests)

**Files:**
- Create: `cometa-persistence-module/.../repository/PersonRepository.java`
- Create: `cometa-persistence-module/.../repository/TeamRepository.java`
- Create: `cometa-persistence-module/.../repository/UserRoleRepository.java`
- Modify: `cometa-persistence-module/.../repository/UserAccountRepository.java`
- Create: `cometa-service-module/.../service/exception/RegistrationConflictException.java`
- Create: `cometa-service-module/.../service/dto/RegisterRequest.java`
- Create: `cometa-service-module/.../service/RegistrationService.java`
- Test: `cometa-service-module/src/test/java/ru/sberbank/cib/gmbus/service/RegistrationServiceTest.java`

**Interfaces:**
- Consumes: `UserAccountRepository.findBySigmaLogin` (existing), `PasswordEncoder` bean (existing, Argon2).
- Produces: `RegistrationService.register(RegisterRequest)` — throws `RegistrationConflictException(field, message)` for the two conflict cases; `RegisterRequest(sigmaLogin, email, lastName, firstName, middleName, password, teamId)`.

- [ ] **Step 1: Create the thin repositories**

`PersonRepository.java`:
```java
package ru.sberbank.cib.gmbus.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.sberbank.cib.gmbus.entity.auth.Person;

import java.util.Optional;

public interface PersonRepository extends JpaRepository<Person, Long> {
    Optional<Person> findByEmail(String email);
}
```

`TeamRepository.java`:
```java
package ru.sberbank.cib.gmbus.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.sberbank.cib.gmbus.entity.auth.Team;

public interface TeamRepository extends JpaRepository<Team, Long> {
}
```

`UserRoleRepository.java`:
```java
package ru.sberbank.cib.gmbus.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.sberbank.cib.gmbus.entity.auth.UserRole;

import java.util.Optional;

public interface UserRoleRepository extends JpaRepository<UserRole, Long> {
    Optional<UserRole> findByCode(String code);
}
```

> Note: `PersonRepository` (a `JpaRepository`) coexists with `PersonCrudRepository` (the odata-mini CRUD repo from Task 2) — different bean types for different jobs; both are valid Spring Data beans.

- [ ] **Step 2: Add `existsByPerson_Id` to `UserAccountRepository`**

Add this method inside the existing interface:
```java
    /** Проверить, есть ли уже учётная запись у данного человека (одна учётка на person). */
    boolean existsByPerson_Id(Long personId);
```

- [ ] **Step 3: Create `RegistrationConflictException`**

```java
package ru.sberbank.cib.gmbus.service.exception;

import lombok.Getter;

/** Конфликт при саморегистрации; field — целевое поле формы (sigmaLogin/email/teamId). */
@Getter
public class RegistrationConflictException extends RuntimeException {

    private final String field;

    public RegistrationConflictException(String field, String message) {
        super(message);
        this.field = field;
    }
}
```

- [ ] **Step 4: Create `RegisterRequest`**

```java
package ru.sberbank.cib.gmbus.service.dto;

public record RegisterRequest(
        String sigmaLogin,
        String email,
        String lastName,
        String firstName,
        String middleName,
        String password,
        Long teamId
) {}
```

- [ ] **Step 5: Write the failing test** `RegistrationServiceTest.java`

```java
package ru.sberbank.cib.gmbus.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.entity.auth.Team;
import ru.sberbank.cib.gmbus.entity.auth.UserAccount;
import ru.sberbank.cib.gmbus.entity.auth.UserRole;
import ru.sberbank.cib.gmbus.repository.PersonRepository;
import ru.sberbank.cib.gmbus.repository.TeamRepository;
import ru.sberbank.cib.gmbus.repository.UserAccountRepository;
import ru.sberbank.cib.gmbus.repository.UserRoleRepository;
import ru.sberbank.cib.gmbus.service.dto.RegisterRequest;
import ru.sberbank.cib.gmbus.service.exception.RegistrationConflictException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistrationServiceTest {

    @Mock UserAccountRepository userAccountRepository;
    @Mock PersonRepository personRepository;
    @Mock TeamRepository teamRepository;
    @Mock UserRoleRepository userRoleRepository;
    @Mock PasswordEncoder passwordEncoder;
    @InjectMocks RegistrationService service;

    private RegisterRequest req(Long teamId) {
        return new RegisterRequest("12345678", "a@b.ru", "Ivanov", "Ivan", "Ivanovich", "secret12", teamId);
    }

    private void stubHappyDefaults() {
        UserRole role = new UserRole();
        role.setCode("developer");
        lenient().when(userRoleRepository.findByCode("developer")).thenReturn(Optional.of(role));
        lenient().when(passwordEncoder.encode(any())).thenReturn("HASH");
        lenient().when(personRepository.save(any(Person.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void createsNewPersonAndAccount() {
        stubHappyDefaults();
        when(userAccountRepository.findBySigmaLogin("12345678")).thenReturn(Optional.empty());
        when(personRepository.findByEmail("a@b.ru")).thenReturn(Optional.empty());

        service.register(req(null));

        ArgumentCaptor<UserAccount> account = ArgumentCaptor.forClass(UserAccount.class);
        verify(userAccountRepository).save(account.capture());
        assertThat(account.getValue().getSigmaLogin()).isEqualTo("12345678");
        assertThat(account.getValue().getPasswordHash()).isEqualTo("HASH");
        assertThat(account.getValue().getIsActive()).isTrue();
        assertThat(account.getValue().getRole().getCode()).isEqualTo("developer");
        assertThat(account.getValue().getPerson().getEmail()).isEqualTo("a@b.ru");
    }

    @Test
    void updatesExistingPersonNames() {
        stubHappyDefaults();
        Person existing = new Person();
        existing.setEmail("a@b.ru");
        existing.setLastName("Old");
        when(userAccountRepository.findBySigmaLogin("12345678")).thenReturn(Optional.empty());
        when(personRepository.findByEmail("a@b.ru")).thenReturn(Optional.of(existing));
        when(userAccountRepository.existsByPerson_Id(any())).thenReturn(false);

        service.register(req(null));

        assertThat(existing.getLastName()).isEqualTo("Ivanov");
        assertThat(existing.getFirstName()).isEqualTo("Ivan");
    }

    @Test
    void rejectsWhenSigmaLoginTaken() {
        when(userAccountRepository.findBySigmaLogin("12345678"))
                .thenReturn(Optional.of(new UserAccount()));

        assertThatThrownBy(() -> service.register(req(null)))
                .isInstanceOf(RegistrationConflictException.class)
                .satisfies(e -> assertThat(((RegistrationConflictException) e).getField()).isEqualTo("sigmaLogin"));
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void rejectsWhenPersonAlreadyHasAccount() {
        Person existing = new Person();
        existing.setEmail("a@b.ru");
        when(userAccountRepository.findBySigmaLogin("12345678")).thenReturn(Optional.empty());
        when(personRepository.findByEmail("a@b.ru")).thenReturn(Optional.of(existing));
        when(userAccountRepository.existsByPerson_Id(any())).thenReturn(true);

        assertThatThrownBy(() -> service.register(req(null)))
                .isInstanceOf(RegistrationConflictException.class)
                .satisfies(e -> assertThat(((RegistrationConflictException) e).getField()).isEqualTo("email"));
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    void linksTeamWhenTeamIdProvided() {
        stubHappyDefaults();
        Team team = new Team();
        when(userAccountRepository.findBySigmaLogin("12345678")).thenReturn(Optional.empty());
        when(personRepository.findByEmail("a@b.ru")).thenReturn(Optional.empty());
        when(teamRepository.findById(42L)).thenReturn(Optional.of(team));

        service.register(req(42L));

        ArgumentCaptor<Person> person = ArgumentCaptor.forClass(Person.class);
        verify(personRepository, org.mockito.Mockito.atLeastOnce()).save(person.capture());
        assertThat(person.getValue().getTeams()).contains(team);
    }
}
```

- [ ] **Step 6: Run the test to verify it fails** (cwd `F:\programming\cometa`)

Run: `./mvnw -q -pl cometa-service-module -am test -Dtest=RegistrationServiceTest`
Expected: FAIL — `RegistrationService` does not exist yet (compilation error).

- [ ] **Step 7: Create `RegistrationService`**

```java
package ru.sberbank.cib.gmbus.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.entity.auth.Team;
import ru.sberbank.cib.gmbus.entity.auth.UserAccount;
import ru.sberbank.cib.gmbus.entity.auth.UserRole;
import ru.sberbank.cib.gmbus.repository.PersonRepository;
import ru.sberbank.cib.gmbus.repository.TeamRepository;
import ru.sberbank.cib.gmbus.repository.UserAccountRepository;
import ru.sberbank.cib.gmbus.repository.UserRoleRepository;
import ru.sberbank.cib.gmbus.service.dto.RegisterRequest;
import ru.sberbank.cib.gmbus.service.exception.RegistrationConflictException;

import java.util.HashSet;

@Service
@RequiredArgsConstructor
public class RegistrationService {

    private static final String DEFAULT_ROLE_CODE = "developer";

    private final UserAccountRepository userAccountRepository;
    private final PersonRepository personRepository;
    private final TeamRepository teamRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public void register(RegisterRequest req) {
        if (userAccountRepository.findBySigmaLogin(req.sigmaLogin()).isPresent()) {
            throw new RegistrationConflictException("sigmaLogin", "Already exists, please login");
        }

        Person person = personRepository.findByEmail(req.email()).orElse(null);
        if (person != null) {
            if (userAccountRepository.existsByPerson_Id(person.getId())) {
                throw new RegistrationConflictException("email", "This person already has an account, please login");
            }
            person.setLastName(req.lastName());
            person.setFirstName(req.firstName());
            person.setMiddleName(req.middleName());
        } else {
            person = new Person();
            person.setEmail(req.email());
            person.setLastName(req.lastName());
            person.setFirstName(req.firstName());
            person.setMiddleName(req.middleName());
        }
        person = personRepository.save(person);

        UserRole role = userRoleRepository.findByCode(DEFAULT_ROLE_CODE)
                .orElseThrow(() -> new IllegalStateException("Default role '" + DEFAULT_ROLE_CODE + "' not found"));

        UserAccount account = new UserAccount();
        account.setSigmaLogin(req.sigmaLogin());
        account.setPasswordHash(passwordEncoder.encode(req.password()));
        account.setIsActive(true);
        account.setRole(role);
        account.setPerson(person);
        userAccountRepository.save(account);

        if (req.teamId() != null) {
            Team team = teamRepository.findById(req.teamId())
                    .orElseThrow(() -> new RegistrationConflictException("teamId", "Selected team not found"));
            if (person.getTeams() == null) {
                person.setTeams(new HashSet<>());
            }
            person.getTeams().add(team);
            personRepository.save(person);
        }
    }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `./mvnw -q -pl cometa-service-module -am test -Dtest=RegistrationServiceTest`
Expected: PASS (5 tests).

- [ ] **Step 9: Commit**

```bash
git add cometa-persistence-module cometa-service-module
git commit -m "feat(auth): RegistrationService with one-account-per-person guards"
```

---

## Task 5: AuthController — register + check-sigma-login + person-by-email

**Files:**
- Modify: `cometa-web-module/src/main/java/ru/sberbank/cib/gmbus/web/api/v1/AuthController.java`

**Interfaces:**
- Consumes: `RegistrationService`, `PersonRepository`, `UserAccountRepository`, `PersonMapper`, `RegisterRequest`, `RegistrationConflictException`.
- Produces (all under `/api/v1/auth`, already public):
  - `POST /register` → `201` empty on success; `409 { messages:[{semantic:"E",target,message}] }` on conflict.
  - `GET /check-sigma-login?sigmaLogin=` → `200 { exists: boolean }`.
  - `GET /person-by-email?email=` → `200 { person: PersonDto|null, hasAccount: boolean }`.

- [ ] **Step 1: Replace `AuthController.java`**

```java
package ru.sberbank.cib.gmbus.web.api.v1;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;
import ru.sberbank.cib.gmbus.entity.auth.Person;
import ru.sberbank.cib.gmbus.repository.PersonRepository;
import ru.sberbank.cib.gmbus.repository.UserAccountRepository;
import ru.sberbank.cib.gmbus.service.RegistrationService;
import ru.sberbank.cib.gmbus.service.dto.PersonDto;
import ru.sberbank.cib.gmbus.service.dto.RegisterRequest;
import ru.sberbank.cib.gmbus.service.exception.RegistrationConflictException;
import ru.sberbank.cib.gmbus.service.mapper.PersonMapper;
import ru.sberbank.cib.gmbus.web.config.JwtService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Tag(name = "Auth", description = "Аутентификация")
@RestController
@RequestMapping("/api/${application.api.version}/auth")
@AllArgsConstructor
@SuppressWarnings("unused")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final RegistrationService registrationService;
    private final PersonRepository personRepository;
    private final UserAccountRepository userAccountRepository;
    private final PersonMapper personMapper;

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(@RequestBody LoginRequest request) {
        var auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.sigmaLogin(), request.password())
        );

        List<String> roles = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        String token = jwtService.generateToken(auth.getName(), roles);

        return ResponseEntity.ok(Map.of("token", token));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of(
                "sigmaLogin", user.getUsername(),
                "authorities", user.getAuthorities()
        ));
    }

    @PostMapping("/register")
    public ResponseEntity<Object> register(@RequestBody RegisterRequest request) {
        try {
            registrationService.register(request);
            return ResponseEntity.status(HttpStatus.CREATED).build();
        } catch (RegistrationConflictException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(errorEnvelope(e.getField(), e.getMessage()));
        } catch (DataIntegrityViolationException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(errorEnvelope(null, "Registration failed: already exists. Please login."));
        }
    }

    @GetMapping("/check-sigma-login")
    public ResponseEntity<Map<String, Object>> checkSigmaLogin(@RequestParam String sigmaLogin) {
        boolean exists = userAccountRepository.findBySigmaLogin(sigmaLogin).isPresent();
        return ResponseEntity.ok(Map.of("exists", exists));
    }

    @GetMapping("/person-by-email")
    public ResponseEntity<Map<String, Object>> personByEmail(@RequestParam String email) {
        Optional<Person> found = personRepository.findByEmail(email);
        Map<String, Object> body = new HashMap<>();
        body.put("person", found.map(personMapper::toDto).orElse(null));
        body.put("hasAccount", found.map(p -> userAccountRepository.existsByPerson_Id(p.getId())).orElse(false));
        return ResponseEntity.ok(body);
    }

    /** Envelope matching the frontend AppMessage[] contract. target may be null (→ root error). */
    private Object errorEnvelope(String target, String message) {
        Map<String, Object> m = new HashMap<>();
        m.put("semantic", "E");
        m.put("target", target);
        m.put("message", message);
        return Map.of("messages", List.of(m));
    }

    public record LoginRequest(String sigmaLogin, String password) {}
}
```

> Note: `PersonMapper.toDto` is the odata-mini `BaseCrudMapper` method (used the same way in `EntityGraphBaseCrudService`). The `errorEnvelope` uses a `HashMap` because `Map.of` rejects a null `target`.

- [ ] **Step 2: Compile** (cwd `F:\programming\cometa`)

Run: `./mvnw -q -pl cometa-web-module -am test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Full build + tests** (verifies the whole backend wires together)

Run: `./mvnw -q -pl cometa-service-module,cometa-web-module -am test`
Expected: BUILD SUCCESS; `RegistrationServiceTest` passes.

- [ ] **Step 4: Commit**

```bash
git add cometa-web-module
git commit -m "feat(auth): register, check-sigma-login, person-by-email endpoints"
```

---

## Task 6: Frontend types + auth API + team API

**Files:**
- Modify: `src/types/api.ts`
- Modify: `src/api/auth.ts`
- Create: `src/features/team/api.ts`

**Interfaces:**
- Produces: `PersonDto`, `TeamDto`, `RegisterRequest`, `CheckSigmaLoginResponse`, `PersonByEmailResponse`; `register()`, `checkSigmaLogin()`, `personByEmail()`; `teamApi.comboboxQueryOptions(search)`, `teamApi.detailQueryOptions(id)`.

- [ ] **Step 1: Add types to `src/types/api.ts`**

Append after the Auth section (after `UserProfile`):
```ts
// ────────────────────────────────────────────────────────────
// Registration
// ────────────────────────────────────────────────────────────

export interface PersonDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
}

export interface TeamDto {
  id: number;
  insertedAt: string | null;
  updatedAt: string | null;
  name: string | null;
  code: number | null;
  type: string | null;
  leaderRole: string | null;
  structure: string | null;
}

export interface RegisterRequest {
  sigmaLogin: string;
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  password: string;
  teamId: number | null;
}

export interface CheckSigmaLoginResponse {
  exists: boolean;
}

export interface PersonByEmailResponse {
  person: PersonDto | null;
  hasAccount: boolean;
}
```

- [ ] **Step 2: Add API calls to `src/api/auth.ts`**

Add imports to the existing type import:
```ts
import type {
  LoginRequest,
  LoginResponse,
  UserProfile,
  RegisterRequest,
  CheckSigmaLoginResponse,
  PersonByEmailResponse,
} from "@/types/api";
```
Append these functions (before the `export type { ... }` line) and extend the re-export:
```ts
/** Саморегистрация: создаёт учётку + person (+ связь с командой), редирект на логин. */
export async function register(request: RegisterRequest): Promise<void> {
  await apiFetch<void>("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

/** Проверка занятости sigmaLogin (on-blur). */
export async function checkSigmaLogin(
  sigmaLogin: string,
): Promise<CheckSigmaLoginResponse> {
  return apiFetch<CheckSigmaLoginResponse>(
    `/api/v1/auth/check-sigma-login?sigmaLogin=${encodeURIComponent(sigmaLogin)}`,
  );
}

/** Поиск person по email (on-blur): для автозаполнения ФИО и проверки наличия учётки. */
export async function personByEmail(
  email: string,
): Promise<PersonByEmailResponse> {
  return apiFetch<PersonByEmailResponse>(
    `/api/v1/auth/person-by-email?email=${encodeURIComponent(email)}`,
  );
}
```
And update the re-export line to include the new types:
```ts
export type {
  LoginRequest,
  LoginResponse,
  UserProfile,
  RegisterRequest,
  CheckSigmaLoginResponse,
  PersonByEmailResponse,
};
```

- [ ] **Step 3: Create `src/features/team/api.ts`** (mirror `flowApi` combobox)

```ts
import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/create-crud-api";
import { odataString } from "@/lib/odata/build-filter-params";
import type { ApiResponse, TeamDto } from "@/types/api";

/** Combobox options: server-side search — $top=20 + $filter over team name. */
function comboboxQueryOptions(search: string) {
  return queryOptions({
    queryKey: ["teams", "combobox", search] as const,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("$skip", "0");
      params.set("$top", "20");
      const q = search.trim();
      if (q) {
        const esc = odataString(q);
        params.set("$filter", `contains_ignoring_case(name, '${esc}')`);
      }
      return apiFetch<ApiResponse<TeamDto[]>>(`/api/v1/team?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });
}

/** Resolve a selected team's label by id (may fall outside the top-20 set). */
function detailQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["teams", "detail", id] as const,
    queryFn: () => apiFetch<ApiResponse<TeamDto>>(`/api/v1/team/${id}`),
  });
}

export const teamApi = { comboboxQueryOptions, detailQueryOptions };
```

- [ ] **Step 4: Type-check** (cwd `F:\programming\react\cometa-frontend`)

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/api.ts src/api/auth.ts src/features/team/api.ts
git commit -m "feat(register): types + auth/team API for registration"
```

---

## Task 7: Registration schema + pure helpers (+ tests)

Tests run under vitest `environment: "node"` — pure logic only (no DOM). The on-blur autofill and server-error mapping live in pure functions here so they are testable.

**Files:**
- Create: `src/features/register/schema.ts`
- Create: `src/features/register/helpers.ts`
- Test: `src/features/register/schema.test.ts`
- Test: `src/features/register/helpers.test.ts`

**Interfaces:**
- Produces: `registerFormSchema`, `RegisterFormValues`, `EMAIL_RE`, `registerFormToRequest(v)`, `namesToFill(current, person)`, `registerErrorFields(messages)`.

- [ ] **Step 1: Create `src/features/register/schema.ts`**

```ts
import { z } from "zod";
import type { RegisterRequest } from "@/types/api";

/** Basic email shape — also reused by the on-blur gate (deterministic, no zod version quirks). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerFormSchema = z
  .object({
    sigmaLogin: z.string().regex(/^\d{8}$/, "SIGMA login must be exactly 8 digits"),
    email: z.string().regex(EMAIL_RE, "Enter a valid email"),
    lastName: z.string().min(1, "Last name is required"),
    firstName: z.string().min(1, "First name is required"),
    middleName: z.string().min(1, "Middle name is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    passwordConfirm: z.string(),
    teamId: z.number().nullable(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Passwords must match",
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;

export function registerFormToRequest(v: RegisterFormValues): RegisterRequest {
  return {
    sigmaLogin: v.sigmaLogin,
    email: v.email,
    lastName: v.lastName,
    firstName: v.firstName,
    middleName: v.middleName,
    password: v.password,
    teamId: v.teamId,
  };
}
```

- [ ] **Step 2: Create `src/features/register/helpers.ts`**

```ts
import type { AppMessage, PersonDto } from "@/types/api";
import type { RegisterFormValues } from "./schema";

type NameField = "lastName" | "firstName" | "middleName";

/**
 * Given current name values and a person found by email, return only the name
 * fields to fill — those currently empty. Never overwrites user input.
 */
export function namesToFill(
  current: Pick<RegisterFormValues, NameField>,
  person: Pick<PersonDto, NameField>,
): Partial<Record<NameField, string>> {
  const out: Partial<Record<NameField, string>> = {};
  if (current.lastName.trim() === "") out.lastName = person.lastName;
  if (current.firstName.trim() === "") out.firstName = person.firstName;
  if (current.middleName.trim() === "") out.middleName = person.middleName;
  return out;
}

/** Form fields a server error may target; anything else maps to "root". */
const FIELD_TARGETS = new Set<string>(["sigmaLogin", "email", "teamId", "password"]);

export interface FieldError {
  field: keyof RegisterFormValues | "root";
  message: string;
}

/** Map server AppMessage[] to (field, message) pairs for RHF setError. */
export function registerErrorFields(messages: AppMessage[]): FieldError[] {
  return messages
    .filter((m) => m.semantic === "E")
    .map((m) => ({
      field:
        m.target && FIELD_TARGETS.has(m.target)
          ? (m.target as keyof RegisterFormValues)
          : "root",
      message: m.message,
    }));
}
```

- [ ] **Step 3: Write the failing tests**

`src/features/register/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { registerFormSchema, registerFormToRequest, EMAIL_RE } from "./schema";

const valid = {
  sigmaLogin: "12345678",
  email: "ivan@sber.ru",
  lastName: "Ivanov",
  firstName: "Ivan",
  middleName: "Ivanovich",
  password: "secret12",
  passwordConfirm: "secret12",
  teamId: null,
};

describe("registerFormSchema", () => {
  it("accepts a valid form", () => {
    expect(registerFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects sigmaLogin that is not exactly 8 digits", () => {
    expect(registerFormSchema.safeParse({ ...valid, sigmaLogin: "1234567" }).success).toBe(false);
    expect(registerFormSchema.safeParse({ ...valid, sigmaLogin: "123456789" }).success).toBe(false);
    expect(registerFormSchema.safeParse({ ...valid, sigmaLogin: "1234567a" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(registerFormSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });

  it("rejects a password shorter than 8", () => {
    const r = registerFormSchema.safeParse({ ...valid, password: "short", passwordConfirm: "short" });
    expect(r.success).toBe(false);
  });

  it("rejects mismatched password confirmation", () => {
    const r = registerFormSchema.safeParse({ ...valid, passwordConfirm: "secret13" });
    expect(r.success).toBe(false);
  });

  it("maps form values to a request payload", () => {
    expect(registerFormToRequest(valid)).toEqual({
      sigmaLogin: "12345678",
      email: "ivan@sber.ru",
      lastName: "Ivanov",
      firstName: "Ivan",
      middleName: "Ivanovich",
      password: "secret12",
      teamId: null,
    });
  });

  it("EMAIL_RE matches valid and rejects invalid", () => {
    expect(EMAIL_RE.test("a@b.ru")).toBe(true);
    expect(EMAIL_RE.test("a@b")).toBe(false);
  });
});
```

`src/features/register/helpers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { namesToFill, registerErrorFields } from "./helpers";
import type { AppMessage, PersonDto } from "@/types/api";

const person: PersonDto = {
  id: 1, insertedAt: null, updatedAt: null,
  email: "a@b.ru", lastName: "Ivanov", firstName: "Ivan", middleName: "Ivanovich",
};

describe("namesToFill", () => {
  it("fills all name fields when all are empty", () => {
    expect(namesToFill({ lastName: "", firstName: "", middleName: "" }, person)).toEqual({
      lastName: "Ivanov", firstName: "Ivan", middleName: "Ivanovich",
    });
  });

  it("does not overwrite fields the user already typed", () => {
    expect(namesToFill({ lastName: "Petrov", firstName: "", middleName: "  " }, person)).toEqual({
      firstName: "Ivan",
    });
  });
});

describe("registerErrorFields", () => {
  it("maps known targets to fields and unknown/null to root", () => {
    const messages: AppMessage[] = [
      { semantic: "E", message: "taken", target: "sigmaLogin", description: null },
      { semantic: "E", message: "dup", target: null, description: null },
      { semantic: "W", message: "ignored", target: "email", description: null },
    ];
    expect(registerErrorFields(messages)).toEqual([
      { field: "sigmaLogin", message: "taken" },
      { field: "root", message: "dup" },
    ]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail** (cwd frontend)

Run: `npx vitest run src/features/register`
Expected: FAIL — modules not found (schema/helpers not yet created) — or, if created out of order, assertion completeness. (After Steps 1–2 they should pass; if writing tests first, expect module-not-found.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/register`
Expected: PASS (all schema + helper tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/register/schema.ts src/features/register/helpers.ts src/features/register/schema.test.ts src/features/register/helpers.test.ts
git commit -m "feat(register): zod schema + pure autofill/error-mapping helpers"
```

---

## Task 8: Team combobox component

Adapted from `src/features/flow-graph/components/flow-combobox.tsx`, with a **"Not selected"** option and a nullable value.

**Files:**
- Create: `src/features/team/components/team-combobox.tsx`

**Interfaces:**
- Consumes: `teamApi.comboboxQueryOptions`, `teamApi.detailQueryOptions`, `DebouncedInput`, shadcn `Button`/`Popover`.
- Produces: `<TeamCombobox value={number | null} onChange={(id: number | null) => void} />`.

- [ ] **Step 1: Create `src/features/team/components/team-combobox.tsx`**

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { DebouncedInput } from "@/components/DebouncedInput";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { teamApi } from "@/features/team/api";
import type { TeamDto } from "@/types/api";

interface TeamComboboxProps {
  value: number | null;
  onChange: (teamId: number | null) => void;
}

function teamLabel(team: TeamDto): string {
  return team.name ?? `Team #${team.id}`;
}

export function TeamCombobox({ value, onChange }: TeamComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Server-side search: GET /api/v1/team?$top=20&$filter=contains_ignoring_case(name,...).
  const listQuery = useQuery(teamApi.comboboxQueryOptions(search));
  const teams = listQuery.data?.data ?? [];

  // Selected team may fall outside the top-20 result set — fetch its label by id.
  const detailQuery = useQuery({
    ...teamApi.detailQueryOptions(value as number),
    enabled: value !== null,
  });
  const selected = detailQuery.data?.data;

  const displayText =
    value === null
      ? "Not selected"
      : selected
        ? teamLabel(selected)
        : detailQuery.isLoading
          ? "Loading…"
          : "Not selected";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start text-left font-normal"
          />
        }
      >
        <span className="truncate">{displayText}</span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <DebouncedInput
              placeholder="Search teams…"
              value={search}
              onChange={setSearch}
              className="h-8 border-0 p-0 focus-visible:ring-0"
            />
          </div>
        </div>
        <ul className="max-h-72 overflow-y-auto">
          <li
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
              value === null ? "bg-accent/50" : ""
            }`}
          >
            <span className="italic text-muted-foreground">Not selected</span>
          </li>
          {teams.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              {listQuery.isFetching ? "Loading…" : "No results"}
            </li>
          )}
          {teams.map((team) => {
            const isSelected = team.id === value;
            return (
              <li
                key={team.id}
                onClick={() => {
                  onChange(team.id);
                  setOpen(false);
                }}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-accent ${
                  isSelected ? "bg-accent/50" : ""
                }`}
              >
                <div className="truncate font-medium">{teamLabel(team)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[team.code != null ? `#${team.code}` : null, team.type]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Type-check** (cwd frontend)

Run: `npx tsc --noEmit`
Expected: no errors. (If the `PopoverTrigger render={...}` prop shape differs from your base-ui version, mirror `flow-combobox.tsx` exactly — it is the reference.)

- [ ] **Step 3: Commit**

```bash
git add src/features/team/components/team-combobox.tsx
git commit -m "feat(team): server-side team combobox with Not-selected option"
```

---

## Task 9: Register route + form

**Files:**
- Create: `src/routes/register.tsx`

**Interfaces:**
- Consumes: `registerFormSchema`, `registerFormToRequest`, `namesToFill`, `registerErrorFields`, `EMAIL_RE`, `register`/`checkSigmaLogin`/`personByEmail`, `TeamCombobox`, `ApiError`, shadcn `Card`/`Input`/`Label`/`Button`.
- Produces: route `/register`.

- [ ] **Step 1: Create `src/routes/register.tsx`**

```tsx
// Регистрация: форма создания учётной записи + person (+ связь с командой).
import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus, ArrowLeft, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TeamCombobox } from "@/features/team/components/team-combobox";
import {
  registerFormSchema,
  registerFormToRequest,
  EMAIL_RE,
  type RegisterFormValues,
} from "@/features/register/schema";
import { namesToFill, registerErrorFields } from "@/features/register/helpers";
import { register as registerAccount, checkSigmaLogin, personByEmail } from "@/api/auth";
import { ApiError } from "@/lib/api/create-crud-api";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      sigmaLogin: "",
      email: "",
      lastName: "",
      firstName: "",
      middleName: "",
      password: "",
      passwordConfirm: "",
      teamId: null,
    },
  });

  const sigmaReg = register("sigmaLogin");
  const emailReg = register("email");

  async function onSigmaBlur(value: string) {
    if (!/^\d{8}$/.test(value)) return;
    try {
      const { exists } = await checkSigmaLogin(value);
      if (exists) {
        setError("sigmaLogin", { message: "Already exists, please login" });
      }
    } catch {
      // network/lookup failure is non-blocking; submit still re-validates server-side
    }
  }

  async function onEmailBlur(value: string) {
    if (!EMAIL_RE.test(value)) return;
    try {
      const { person, hasAccount } = await personByEmail(value);
      if (hasAccount) {
        setError("email", { message: "This person already has an account, please login" });
        return;
      }
      if (person) {
        const fills = namesToFill(
          {
            lastName: getValues("lastName"),
            firstName: getValues("firstName"),
            middleName: getValues("middleName"),
          },
          person,
        );
        for (const [field, val] of Object.entries(fills)) {
          setValue(field as keyof RegisterFormValues, val, { shouldValidate: true });
        }
      }
    } catch {
      // non-blocking
    }
  }

  const onSubmit = async (data: RegisterFormValues) => {
    clearErrors("root");
    try {
      await registerAccount(registerFormToRequest(data));
      toast.success("Account created — please sign in");
      navigate({ to: "/login" });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.messages.length > 0) {
        for (const { field, message } of registerErrorFields(err.messages)) {
          setError(field, { message });
        }
      } else {
        setError("root", {
          message: err instanceof Error ? err.message : "Registration failed.",
        });
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>Register a new Cometa account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Sigma login" htmlFor="sigmaLogin" error={errors.sigmaLogin?.message}>
              <Input
                id="sigmaLogin"
                placeholder="12345678"
                {...sigmaReg}
                onBlur={(e) => {
                  sigmaReg.onBlur(e);
                  void onSigmaBlur(e.target.value);
                }}
              />
            </Field>

            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                {...emailReg}
                onBlur={(e) => {
                  emailReg.onBlur(e);
                  void onEmailBlur(e.target.value);
                }}
              />
            </Field>

            <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
              <Input id="lastName" {...register("lastName")} />
            </Field>

            <Field label="First name" htmlFor="firstName" error={errors.firstName?.message}>
              <Input id="firstName" {...register("firstName")} />
            </Field>

            <Field label="Middle name" htmlFor="middleName" error={errors.middleName?.message}>
              <Input id="middleName" {...register("middleName")} />
            </Field>

            <Field label="Password" htmlFor="password" error={errors.password?.message}>
              <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
            </Field>

            <Field
              label="Password confirmation"
              htmlFor="passwordConfirm"
              error={errors.passwordConfirm?.message}
            >
              <Input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                {...register("passwordConfirm")}
              />
            </Field>

            <div className="space-y-2">
              <Label>Team</Label>
              <Controller
                control={control}
                name="teamId"
                render={({ field }) => (
                  <TeamCombobox value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            {errors.root && (
              <p className="text-sm text-destructive text-center">{errors.root.message}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="mr-2 size-4" />
              )}
              {isSubmitting ? "Creating…" : "Register"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate({ to: "/login" })}
              disabled={isSubmitting}
            >
              <ArrowLeft className="mr-2 size-4" />
              Return
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + build (regenerates the route tree)** (cwd frontend)

Run: `npm run build`
Expected: `tsc -b` passes and vite build succeeds; `src/routeTree.gen.ts` is regenerated to include `/register` (do not edit it by hand).

- [ ] **Step 3: Commit**

```bash
git add src/routes/register.tsx src/routeTree.gen.ts
git commit -m "feat(register): registration route and form"
```

---

## Task 10: Login "Register" button + router allowlist

**Files:**
- Modify: `src/routes/login.tsx`
- Modify: `src/routes/__root.tsx`

**Interfaces:**
- Consumes: `/register` route (Task 9).
- Produces: Register button on login; `/register` reachable while unauthenticated.

- [ ] **Step 1: Add the Register button to `src/routes/login.tsx`**

Import `useNavigate` and add `UserPlus` to the lucide import:
```ts
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogIn, KeyRound, UserPlus } from "lucide-react";
```
Inside `LoginPage`, get `navigate`:
```ts
  const navigate = useNavigate();
```
Add a third button after the "Sign in by certificate" button, still inside the `<form>`:
```tsx
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate({ to: "/register" })}
              disabled={isSubmitting}
            >
              <UserPlus className="mr-2 size-4" />
              Register
            </Button>
```

- [ ] **Step 2: Allow `/register` in `src/routes/__root.tsx`**

In `beforeLoad`, extend the guard so `/register` is not redirected:
```ts
    if (
      !token &&
      location.pathname !== "/login" &&
      location.pathname !== "/register" &&
      location.pathname !== "/forbidden"
    ) {
      throw redirect({ to: "/login" });
    }
```
In `RootLayout`, add `/register` to `isAuthPage` so the sidebar is hidden:
```ts
  const isAuthPage =
    router.state.location.pathname === "/login" ||
    router.state.location.pathname === "/register" ||
    router.state.location.pathname === "/forbidden";
```

- [ ] **Step 3: Build** (cwd frontend)

Run: `npm run build`
Expected: passes.

- [ ] **Step 4: Manual smoke (optional, if a backend/dev server is running)**

Start dev (`npm run dev -- --host`), open `/login`, click **Register** → `/register` loads without redirect. The two on-blur checks call `/api/v1/auth/check-sigma-login` and `/api/v1/auth/person-by-email`; the team combobox lists `/api/v1/team`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/login.tsx src/routes/__root.tsx
git commit -m "feat(register): Register button on login + public /register route"
```

---

## Self-Review notes

- **Spec coverage:** Register button (T10); form with all 8 inputs incl. team combobox (T9, T8); sigmaLogin 8-digit + on-blur uniqueness (T7 schema, T9 handler, T5 endpoint); email valid + on-blur person lookup with empty-only autofill (T7 `namesToFill`, T9 handler, T5 endpoint); one-account-per-person (T1 index, T4 service); create/update person + account + optional team link atomically (T4); redirect to login (T9); Return button (T9); default role developer / active / password-min-8 (Global Constraints, T4, T7).
- **Type consistency:** `RegisterRequest`/`PersonDto`/`TeamDto` identical across `types/api.ts` and backend DTOs; `existsByPerson_Id`, `findByEmail`, `findByCode`, `findBySigmaLogin` names match between service and repos; `teamId` is `number | null` end-to-end; error `target` values (`sigmaLogin`/`email`/`teamId`) match `FIELD_TARGETS`.
- **Known deviations from spec (intentional, noted):** `TeamDto` omits `leaderPersonId` (keeps `TeamMapper` empty; combobox doesn't need it). `SecurityConfig` only adds the team-GET matcher because `/api/v1/auth/**` is already public. Login-prefill after registration is omitted (redirect only).
```
