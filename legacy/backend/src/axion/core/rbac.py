"""Role-based access control. Roles are hierarchical."""
from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from axion.models.org import OrgRole
from axion.schemas.auth import CurrentUser

# Higher = more powerful
_ROLE_RANK = {
    OrgRole.VIEWER: 1,
    OrgRole.OPERATOR: 2,
    OrgRole.BUILDER: 3,
    OrgRole.ADMIN: 4,
    OrgRole.OWNER: 5,
}


def role_at_least(actual: OrgRole | str | None, required: OrgRole) -> bool:
    """Check whether `actual` >= `required` in the role hierarchy."""
    if actual is None:
        return False
    if isinstance(actual, str):
        try:
            actual = OrgRole(actual)
        except ValueError:
            return False
    return _ROLE_RANK[actual] >= _ROLE_RANK[required]


def require_role(min_role: OrgRole) -> Callable[..., CurrentUser]:
    """FastAPI dependency that enforces a minimum role on the current user."""
    from axion.deps import get_current_user

    async def dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.is_superuser:
            return user
        if not role_at_least(user.role, min_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role {min_role.value} or higher",
            )
        return user

    return dep
