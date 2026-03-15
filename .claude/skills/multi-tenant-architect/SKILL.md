---
name: multi-tenant-architect
description: Enforces multi-tenant data isolation, recursive N-level hierarchy (Platform → Org → Units, max 5 levels) with materialized path, feature entitlements with ceiling principle, tenant-aware FastAPI dependencies, and SOC2-ready audit patterns. Use this skill when writing tenant-scoped APIs, membership logic, permission checks, or feature-gated endpoints.
---

# Skill: Enterprise Multi-Tenant Architect

## Role

You are a Principal Security & Backend Engineer specializing in multi-tenant SaaS architecture. Your priority is **Absolute Tenant Isolation**, **Recursive Hierarchy with Ceiling Principle**, and **SOC2-ready** audit patterns. Stack: Python 3.11+, FastAPI, PostgreSQL, SQLAlchemy 2.0 (async), Pydantic v2, Redis.

---

## 1. Context & Purpose

Use this skill whenever generating backend code requiring:
- Tenant data isolation
- Recursive hierarchy (Platform → Org → N-level Units, max 5 levels)
- Feature entitlements with ceiling principle
- Custom role creation at any unit level
- Permission-gated API endpoints
- Audit logging for compliance

**Hierarchy (AWS Organizations pattern):**

```
Level 0: Organization       (the root — data isolation boundary)
Level 1: ├── Division       (e.g., "North Region")
Level 2: │   ├── Department (e.g., "Field Operations")
Level 3: │   │   ├── Team   (e.g., "Site-A Crew")
Level 4: │   │   │   └── Unit (e.g., "Night Shift")  ← MAX DEPTH
         │   │   │       └── 👤 Users
```

**Key Concepts:**
- **Organizational Unit**: A single self-referencing entity (replaces separate org/sub-org tables)
- **Materialized Path**: `/root-uuid/l1-uuid/l2-uuid` for fast hierarchy queries without recursive CTEs
- **`org_root_id`**: Every record points to Level 0 for simple RLS isolation
- **Ceiling Principle**: Child unit's entitlements ⊆ parent unit's entitlements. Always.
- **Permissions**: Granular `resource:action` pairs, checked at runtime via Redis cache

---

## 2. Core Architectural Principles (Non-Negotiable)

### P1 — Absolute Tenant Isolation
EVERY operational database table **MUST** include `org_root_id` (points to Level 0). All queries MUST be scoped by `org_root_id`. RLS enforces this at database level.

### P2 — Never Trust the Client
`org_root_id` and `unit_id` must **NEVER** be accepted from request body payloads. They **MUST** be extracted from the authenticated user's JWT tenant context.

### P3 — Ceiling Principle
If an Org (L0) has modules [1-10], a child Division (L1) can have at most [1-10]. If the Division has [1-7], a child Department (L2) can have at most [1-7]. This cascades down all 5 levels. **A child can NEVER exceed its parent's entitlements.**

### P4 — Decoupled Permissions
```
User → UserMembership (user ↔ unit + role)
     → Role → RolePermissions → Permissions (resource:action)
```
Users never have permissions directly. ALWAYS check permissions (`require_permission`), NEVER check role names (`if role == 'admin'` is **forbidden**).

### P5 — Materialized Path for Reads
Use `path` column for hierarchy queries. `WHERE path LIKE '/root-uuid/%'` to find all descendants. Split path to find ancestors. **Never** use recursive CTEs for standard read operations.

### P6 — Depth Cap at 5 Levels
Database constraint `CHECK (depth <= 4)` (0-indexed). This is a hard cap. No exceptions.

### P7 — Soft Deletion & Auditability
- **Never** hard-delete. All models use `SoftDeleteMixin` with `deleted_at`.
- **Every** write action must be audit-logged.
- Queries must auto-exclude soft-deleted rows.

### P8 — API Versioning
All routes prefixed with `/api/v1/`.

### P9 — Idempotency
All POST/PUT endpoints that create resources MUST support `Idempotency-Key` header.

---

## 3. Database Schema

### 3.1 Base Mixins

```python
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum as SAEnum, Index, Text, Integer, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func
import uuid

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class SoftDeleteMixin:
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

class TenantScopedMixin:
    """EVERY operational table MUST inherit this."""
    org_root_id = Column(UUID(as_uuid=True), ForeignKey("organizational_units.id"), nullable=False, index=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("organizational_units.id"), nullable=True, index=True)
```

### 3.2 Organizational Unit (The Core — Self-Referencing)

```python
class OrganizationalUnit(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "organizational_units"
    __table_args__ = (
        CheckConstraint("depth <= 4", name="ck_max_depth_5_levels"),
        Index("ix_ou_org_root", "org_root_id"),
        Index("ix_ou_parent", "parent_id"),
        Index("ix_ou_path", "path"),    # For LIKE queries on materialized path
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_root_id = Column(UUID(as_uuid=True), ForeignKey("organizational_units.id"), nullable=True)
        # NULL only when this IS the root (depth=0). All others point to root.
    parent_id = Column(UUID(as_uuid=True), ForeignKey("organizational_units.id"), nullable=True)
        # NULL = this IS the root org
    path = Column(String(500), nullable=False)
        # Materialized path: "/<root-uuid>/<l1-uuid>/<l2-uuid>"
        # Root's path: "/<root-uuid>"
    depth = Column(Integer, nullable=False, default=0)
        # 0 = Organization (root), 1 = Division, 2 = Department, 3 = Team, 4 = Unit
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False)
    status = Column(String(20), default="active")     # active | inactive | suspended
    settings = Column(JSONB, default={})
    subscription_plan_id = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=True)
        # Only on root (depth=0)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Relationships
    parent = relationship("OrganizationalUnit", remote_side=[id], foreign_keys=[parent_id])
    children = relationship("OrganizationalUnit", foreign_keys=[parent_id])
```

**Path examples:**
| Unit | Depth | Path |
|---|---|---|
| Acme Corp (root) | 0 | `/acme-uuid` |
| North Region | 1 | `/acme-uuid/north-uuid` |
| Field Ops | 2 | `/acme-uuid/north-uuid/fieldops-uuid` |
| Site Crew A | 3 | `/acme-uuid/north-uuid/fieldops-uuid/crew-uuid` |
| Night Shift | 4 | `/acme-uuid/north-uuid/fieldops-uuid/crew-uuid/night-uuid` |

### 3.3 Platform & Subscription

```python
class SubscriptionPlan(Base, TimestampMixin):
    __tablename__ = "subscription_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    max_users = Column(Integer, nullable=False)
    max_depth = Column(Integer, default=4)               # plan can restrict depth
    price_monthly = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


class Feature(Base, TimestampMixin):
    __tablename__ = "features"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(100), unique=True, nullable=False)  # 'module.vendors'
    name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)            # 'module', 'addon', 'integration'
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)


class PlanFeature(Base):
    __tablename__ = "plan_features"
    plan_id = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), primary_key=True)
    feature_id = Column(UUID(as_uuid=True), ForeignKey("features.id"), primary_key=True)
```

### 3.4 Feature Entitlements (Unified, Ceiling-Enforced)

```python
class UnitFeatureEntitlement(Base, TimestampMixin):
    __tablename__ = "unit_feature_entitlements"
    __table_args__ = (
        Index("uq_unit_feature", "unit_id", "feature_id", unique=True),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("organizational_units.id"), nullable=False)
    feature_id = Column(UUID(as_uuid=True), ForeignKey("features.id"), nullable=False)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    # CONSTRAINT: feature MUST exist in parent unit's entitlements (enforced at API layer)
```

### 3.5 User (Global — NOT tenant-scoped)

```python
class User(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(320), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=False)
    avatar_url = Column(Text, nullable=True)
    auth_provider = Column(String(20), default="email")
    is_super_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
```

### 3.6 RBAC Tables

```python
class Permission(Base):
    __tablename__ = "permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(150), unique=True, nullable=False)  # 'manpower:create'
    resource = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)
    feature_id = Column(UUID(as_uuid=True), ForeignKey("features.id"), nullable=False)
    description = Column(Text, nullable=True)


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    scope = Column(String(20), nullable=False)       # 'system' | 'unit'
    unit_id = Column(UUID(as_uuid=True), ForeignKey("organizational_units.id"), nullable=True)
        # NULL = system role, set = custom role for that unit
    is_system = Column(Boolean, default=False)
    is_default = Column(Boolean, default=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    permissions = relationship("Permission", secondary="role_permissions")


class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("permissions.id"), primary_key=True)
```

**System Default Roles (seeded, non-deletable):**

| Slug | Scope | Permissions |
|---|---|---|
| `super_admin` | system | ALL |
| `unit_admin` | unit | All within unit's entitlements + can create child units |
| `unit_member` | unit | Defined by unit admin |

### 3.7 User Membership

```python
class UserMembership(Base, TimestampMixin):
    __tablename__ = "user_memberships"
    __table_args__ = (
        Index("uq_user_unit", "user_id", "unit_id", unique=True),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("organizational_units.id"), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    status = Column(String(20), default="active")     # active | invited | suspended
    invited_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
```

### 3.8 Invitation

```python
class Invitation(Base, TimestampMixin):
    __tablename__ = "invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_root_id = Column(UUID(as_uuid=True), ForeignKey("organizational_units.id"), nullable=False)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("organizational_units.id"), nullable=False)
    email = Column(String(320), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    invited_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="pending")    # pending | accepted | expired | revoked
```

### 3.9 Audit Log

```python
class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_org_timestamp", "org_root_id", "timestamp"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_root_id = Column(UUID(as_uuid=True), ForeignKey("organizational_units.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String(20), nullable=False)        # CREATE | UPDATE | DELETE | LOGIN
    resource = Column(String(100), nullable=False)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    details = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
```

### 3.10 Operational Table Pattern

```python
class Manpower(Base, TimestampMixin, SoftDeleteMixin, TenantScopedMixin):
    __tablename__ = "manpower"
    __table_args__ = (
        Index("ix_manpower_org_root", "org_root_id"),
        Index("ix_manpower_unit", "unit_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # org_root_id, unit_id — inherited from TenantScopedMixin
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(500), nullable=False)
    status = Column(String(50), default="active")
```

### 3.11 PostgreSQL RLS

```sql
ALTER TABLE manpower ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON manpower
    USING (org_root_id = current_setting('app.current_org_root_id')::uuid);

CREATE POLICY superadmin_bypass ON manpower
    USING (current_setting('app.is_super_admin', true)::boolean = true);
```

```python
async def set_rls_context(db: AsyncSession, org_root_id: UUID, is_super_admin: bool):
    await db.execute(text(f"SET LOCAL app.current_org_root_id = '{org_root_id}'"))
    await db.execute(text(f"SET LOCAL app.is_super_admin = '{is_super_admin}'"))
```

---

## 4. JWT & Authentication

### 4.1 JWT Payload

```python
# Access Token (15 min)
{
    "sub": "user_uuid",
    "is_super_admin": false,
    "tenant": {
        "org_root_id": "root_uuid",
        "active_unit_id": "unit_uuid",
        "unit_path": "/root-uuid/l1-uuid/l2-uuid",
        "role": "unit_admin",
        "role_id": "role_uuid"
    },
    "exp": 1712345678,
    "jti": "unique_token_id"
}
```

### 4.2 Unit Switching

```python
@router.post("/api/v1/auth/switch-unit", response_model=TokenResponse)
async def switch_unit(
    body: SwitchUnitRequest,   # { unit_id }
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await verify_membership(current_user.id, body.unit_id, db)
    if not membership:
        raise HTTPException(403, "Not a member of this unit.")

    unit = await db.get(OrganizationalUnit, body.unit_id)
    role = await db.get(Role, membership.role_id)

    new_token = create_access_token(
        user_id=current_user.id,
        org_root_id=unit.org_root_id or unit.id,  # root points to itself
        active_unit_id=unit.id,
        unit_path=unit.path,
        role=role.slug,
        role_id=role.id,
    )
    return TokenResponse(access_token=new_token, token_type="bearer")
```

---

## 5. Security Dependencies (FastAPI)

### 5.1 Tenant Context

```python
@dataclass
class TenantContext:
    user: User
    is_super_admin: bool
    org_root_id: UUID | None
    active_unit: OrganizationalUnit | None
    membership: UserMembership | None
    role: Role | None
    unit_entitlements: list[str]     # feature codes available at active unit

    def has_features(self, *feature_codes: str) -> bool:
        return all(code in self.unit_entitlements for code in feature_codes)


async def get_tenant_context(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantContext:
    if current_user.is_super_admin:
        return TenantContext(
            user=current_user, is_super_admin=True,
            org_root_id=None, active_unit=None,
            membership=None, role=None, unit_entitlements=[],
        )

    unit_id = current_user.active_unit_id
    org_root_id = current_user.active_org_root_id
    if not unit_id:
        raise HTTPException(400, "No active unit. Call /auth/switch-unit.")

    membership = await get_cached_membership(current_user.id, unit_id, db)
    if not membership:
        raise HTTPException(403, "Not a member of this unit.")

    unit_entitlements = await get_cached_unit_entitlements(unit_id, db)
    await set_rls_context(db, org_root_id, False)

    unit = await db.get(OrganizationalUnit, unit_id)
    role = await db.get(Role, membership.role_id)

    return TenantContext(
        user=current_user, is_super_admin=False,
        org_root_id=org_root_id, active_unit=unit,
        membership=membership, role=role,
        unit_entitlements=unit_entitlements,
    )
```

### 5.2 Permission & Feature Dependencies

```python
def require_permission(*required_perms: str):
    """Gate by granular permission. Super admins always pass."""
    async def checker(
        ctx: TenantContext = Depends(get_tenant_context),
        redis: Redis = Depends(get_redis),
    ) -> TenantContext:
        if ctx.is_super_admin:
            return ctx
        user_perms = await get_cached_permissions(redis, ctx.user.id, ctx.active_unit.id)
        missing = set(required_perms) - set(user_perms)
        if missing:
            raise HTTPException(403, f"Missing permissions: {missing}")
        return ctx
    return checker


def require_feature(*feature_codes: str):
    """Gate by feature entitlement (ceiling principle)."""
    async def checker(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if ctx.is_super_admin:
            return ctx
        if not ctx.has_features(*feature_codes):
            raise HTTPException(403, "Feature not available in your plan.")
        return ctx
    return checker


def require_super_admin():
    """Platform-level only."""
    async def checker(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if not ctx.is_super_admin:
            raise HTTPException(403, "Super admin access required.")
        return ctx
    return checker
```

### 5.3 Ceiling Principle Enforcement

```python
async def validate_child_entitlement(
    parent_unit_id: UUID, feature_id: UUID, db: AsyncSession
) -> bool:
    """Verify parent unit has the feature before granting to child."""
    result = await db.execute(
        select(UnitFeatureEntitlement).where(
            UnitFeatureEntitlement.unit_id == parent_unit_id,
            UnitFeatureEntitlement.feature_id == feature_id,
            UnitFeatureEntitlement.is_active == True,
        )
    )
    return result.scalar_one_or_none() is not None


async def get_ancestor_ids(unit: OrganizationalUnit) -> list[UUID]:
    """Extract ancestor unit IDs from materialized path. O(1), no DB query."""
    parts = unit.path.strip("/").split("/")
    return [UUID(p) for p in parts]
```

---

## 6. Redis Caching Layer

### 6.1 Permission Cache (5-min TTL)

```python
PERMISSION_CACHE_TTL = 300

async def get_cached_permissions(redis: Redis, user_id: UUID, unit_id: UUID) -> list[str]:
    cache_key = f"perms:{user_id}:{unit_id}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    async with async_session_factory() as db:
        permissions = await query_user_permissions(user_id, unit_id, db)
        perm_strings = [f"{p.resource}:{p.action}" for p in permissions]
        await redis.setex(cache_key, PERMISSION_CACHE_TTL, json.dumps(perm_strings))
        return perm_strings
```

### 6.2 Entitlement Cache (10-min TTL)

```python
ENTITLEMENT_CACHE_TTL = 600

async def get_cached_unit_entitlements(unit_id: UUID, db: AsyncSession) -> list[str]:
    redis = get_redis()
    cache_key = f"entitlements:unit:{unit_id}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    result = await db.execute(
        select(Feature.code)
        .join(UnitFeatureEntitlement, UnitFeatureEntitlement.feature_id == Feature.id)
        .where(UnitFeatureEntitlement.unit_id == unit_id, UnitFeatureEntitlement.is_active == True)
    )
    codes = [row[0] for row in result.all()]
    await redis.setex(cache_key, ENTITLEMENT_CACHE_TTL, json.dumps(codes))
    return codes
```

---

## 7. Route Generation Standards

### 7.1 Feature-Gated CRUD Endpoint

```python
@router.post(
    "/api/v1/manpower",
    response_model=APIResponse[ManpowerResponse],
    status_code=201,
    dependencies=[
        Depends(require_feature("module.manpower")),
        Depends(require_permission("manpower:create")),
    ],
)
async def create_manpower(
    payload: ManpowerCreate,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    ctx: TenantContext = Depends(get_tenant_context),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    if idempotency_key:
        existing = await check_idempotency(idempotency_key, ctx.org_root_id)
        if existing:
            return existing

    new_record = Manpower(
        **payload.model_dump(),
        org_root_id=ctx.org_root_id,                      # RLS boundary
        unit_id=ctx.active_unit.id,                        # Specific unit
        created_by=ctx.user.id,
    )
    db.add(new_record)
    await db.flush()

    background_tasks.add_task(
        create_audit_log,
        org_root_id=ctx.org_root_id,
        user_id=ctx.user.id,
        action="CREATE", resource="manpower", resource_id=new_record.id,
    )

    await db.commit()
    await db.refresh(new_record)
    return APIResponse(data=new_record)
```

### 7.2 Scoped List with Unit Filtering

```python
@router.get(
    "/api/v1/manpower",
    dependencies=[
        Depends(require_feature("module.manpower")),
        Depends(require_permission("manpower:read")),
    ],
)
async def list_manpower(
    include_descendants: bool = Query(False),   # include child units' data?
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    query = select(Manpower).where(
        Manpower.org_root_id == ctx.org_root_id,
        Manpower.deleted_at.is_(None),
    )

    if include_descendants and ctx.active_unit:
        # Materialized path query — all descendants
        descendant_ids = await get_descendant_unit_ids(ctx.active_unit, db)
        query = query.where(Manpower.unit_id.in_(descendant_ids + [ctx.active_unit.id]))
    elif ctx.active_unit:
        query = query.where(Manpower.unit_id == ctx.active_unit.id)

    result = await db.execute(query)
    return APIResponse(data=result.scalars().all())


async def get_descendant_unit_ids(unit: OrganizationalUnit, db: AsyncSession) -> list[UUID]:
    """Fast descendant lookup via materialized path."""
    result = await db.execute(
        select(OrganizationalUnit.id).where(
            OrganizationalUnit.path.like(f"{unit.path}/%"),
            OrganizationalUnit.deleted_at.is_(None),
        )
    )
    return [row[0] for row in result.all()]
```

### 7.3 Creating Child Units

```python
@router.post(
    "/api/v1/units",
    dependencies=[Depends(require_permission("units:create"))],
)
async def create_child_unit(
    payload: CreateUnitRequest,   # { name, parent_id, feature_ids[] }
    ctx: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    parent = await db.get(OrganizationalUnit, payload.parent_id)
    if not parent:
        raise HTTPException(404, "Parent unit not found.")

    # Depth cap
    if parent.depth >= 4:
        raise HTTPException(400, "Maximum depth (5 levels) reached.")

    # Ceiling: validate all features exist in parent
    for fid in payload.feature_ids:
        if not await validate_child_entitlement(parent.id, fid, db):
            raise HTTPException(403, f"Feature {fid} not available in parent unit.")

    new_unit = OrganizationalUnit(
        org_root_id=parent.org_root_id or parent.id,
        parent_id=parent.id,
        path=f"{parent.path}/{uuid.uuid4()}",   # extend path
        depth=parent.depth + 1,
        name=payload.name,
        slug=slugify(payload.name),
        created_by=ctx.user.id,
    )
    db.add(new_unit)
    await db.flush()

    # Grant entitlements
    for fid in payload.feature_ids:
        db.add(UnitFeatureEntitlement(
            unit_id=new_unit.id, feature_id=fid, granted_by=ctx.user.id,
        ))

    # Update path with actual UUID
    new_unit.path = f"{parent.path}/{new_unit.id}"
    await db.commit()
    return APIResponse(data=new_unit)
```

---

## 8. Standardized Response Format

```python
class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T
    meta: dict | None = None

class APIErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail
```

---

## 9. Audit Logging

```python
async def create_audit_log(
    org_root_id: UUID | None, user_id: UUID,
    action: str, resource: str,
    resource_id: UUID | None = None, details: dict | None = None,
):
    """Background task — own DB session. Never pass request session."""
    async with async_session_factory() as db:
        db.add(AuditLog(
            org_root_id=org_root_id, user_id=user_id,
            action=action, resource=resource,
            resource_id=resource_id, details=details,
        ))
        await db.commit()
```

---

## 10. Testing Patterns (MANDATORY)

### 10.1 Cross-Org Isolation

```python
async def test_org_isolation(client, org_a, org_b):
    """Org A MUST NOT see Org B's data."""
    await client.post("/api/v1/manpower", json={"name": "Secret"}, headers=org_a_headers)
    resp = await client.get("/api/v1/manpower", headers=org_b_headers)
    assert "Secret" not in [m["name"] for m in resp.json()["data"]]
```

### 10.2 Ceiling Principle

```python
async def test_ceiling_blocks_unauthorized_feature(client, org_a):
    """Child unit cannot get features parent doesn't have."""
    resp = await client.post(
        f"/api/v1/units/{child_id}/entitlements",
        json={"feature_id": feature_not_in_parent},
        headers=org_a_admin_headers,
    )
    assert resp.status_code == 403
```

### 10.3 Depth Cap

```python
async def test_depth_cap_at_5(client, org_a):
    """Cannot create 6th level."""
    resp = await client.post(
        "/api/v1/units",
        json={"parent_id": level_4_unit_id, "name": "Too Deep"},
        headers=org_a_admin_headers,
    )
    assert resp.status_code == 400
```

---

## 11. Anti-Patterns

| ❌ Never | ✅ Always |
|---|---|
| `if role == 'admin'` | `require_permission("resource:action")` |
| Accept `org_root_id` from body | Extract from JWT context |
| Recursive CTE for reads | Materialized `path` with LIKE |
| `await db.delete(obj)` | `obj.deleted_at = func.now()` |
| Skip ceiling validation | Verify parent has feature before granting |
| Allow depth > 4 | `CHECK(depth <= 4)` constraint |
| Nest roles across units | Roles scoped to their unit only |
| Pass request `db` to background | Own session per background task |

---

## 12. Data Scoping Quick Reference

```
Super Admin  → No org filter (audit-logged)
Unit Admin   → WHERE org_root_id = root AND unit_id IN (self + descendants)
Unit Member  → WHERE org_root_id = root AND unit_id = active_unit (per permissions)
```

---

## 13. Checklist for New Features

- [ ] Table has `TenantScopedMixin` (`org_root_id` + `unit_id`)
- [ ] Table has `TimestampMixin` + `SoftDeleteMixin`
- [ ] Query scoped by `org_root_id` + unit filter
- [ ] Query excludes `.where(deleted_at.is_(None))`
- [ ] Feature gate: `require_feature("module.xxx")`
- [ ] Permission gate: `require_permission("resource:action")`
- [ ] Audit log dispatched on writes
- [ ] `Idempotency-Key` on POST/PUT
- [ ] Cross-org isolation test
- [ ] Ceiling test
- [ ] Depth cap test
- [ ] Redis invalidated on role/permission/entitlement change
- [ ] Background tasks use own DB session
