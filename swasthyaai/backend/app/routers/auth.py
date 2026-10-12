from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.services.audit_service import create_audit_log

from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserResponse,
    UserCreateRequest,
    UserStatusUpdate,
    UserSupervisorUpdate,
)
from app.core.security import (
    verify_password,
    create_access_token,
    decode_access_token,
    hash_password,
)


router = APIRouter()

bearer_scheme = HTTPBearer()


def _user_from_token(credentials, db: Session) -> User:
    payload = decode_access_token(credentials.credentials)

    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user = db.execute(
        select(User).where(User.id == int(payload["sub"]))
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return user


def _valid_anm(db: Session, anm_id: int) -> User:
    anm = db.execute(
        select(User).where(User.id == anm_id)
    ).scalar_one_or_none()

    if anm is None or anm.role.upper() != "ANM":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The supervising ANM was not found"
        )

    if not anm.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The supervising ANM account is deactivated"
        )

    return anm


# ---------------------------------------------------------
# LOGIN
# POST /api/auth/login
# ---------------------------------------------------------

@router.post(
    "/login",
    response_model=TokenResponse
)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    result = db.execute(
        select(User).where(User.email == login_data.email)
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(
        login_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if hasattr(user, "active") and user.active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    access_token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# ---------------------------------------------------------
# GET CURRENT USER
# GET /api/auth/me
# ---------------------------------------------------------

@router.get(
    "/me",
    response_model=UserResponse
)
def get_me(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    result = db.execute(
        select(User).where(User.id == int(user_id))
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return user


# ---------------------------------------------------------
# CREATE USER
# POST /api/auth/users
#
# ADMIN ONLY
# ---------------------------------------------------------

@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def create_user(
    user_data: UserCreateRequest,
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db)
):
    # Decode admin token
    payload = decode_access_token(credentials.credentials)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    admin_id = payload.get("sub")

    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    # Get logged-in user from database
    admin = db.execute(
        select(User).where(User.id == int(admin_id))
    ).scalar_one_or_none()

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # ADMIN only
    if admin.role.upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN users can create new users"
        )

    # Validate role
    role = user_data.role.upper().strip()

    allowed_roles = {"ASHA", "ANM", "ADMIN"}

    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be ASHA, ANM, or ADMIN"
        )

    # Check duplicate email
    existing_user = db.execute(
        select(User).where(User.email == user_data.email)
    ).scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists"
        )

    # An ASHA worker must be placed under an active ANM
    anm_id = None

    if role == "ASHA":
        if user_data.anm_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Choose the supervising ANM for this ASHA worker"
            )

        anm_id = _valid_anm(db, user_data.anm_id).id

    elif user_data.anm_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only ASHA workers have a supervising ANM"
        )

    # Create user
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=role,
        village=user_data.village,
        phone=user_data.phone,
        anm_id=anm_id,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    create_audit_log(
        db=db,
        action="USER_CREATED",
        user_id=admin.id,
        entity_type="USER",
        entity_id=new_user.id,
        details={
            "created_user_email": new_user.email,
            "created_user_role": new_user.role,
            "anm_id": new_user.anm_id,
        },
    )

    db.commit()

    return new_user
# ---------------------------------------------------------
# ROLE-BASED DASHBOARD
# GET /api/auth/dashboard
# ---------------------------------------------------------


@router.get("/dashboard")
def get_dashboard(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db)
):
    payload = decode_access_token(credentials.credentials)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    user = db.execute(
        select(User).where(User.id == int(user_id))
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    role = user.role.upper()

    if role == "ASHA":
        dashboard = "/api/dashboard/asha"
    elif role == "ANM":
        dashboard = "/api/dashboard/anm"
    elif role == "ADMIN":
        dashboard = "/api/audit-logs"
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user role"
        )

    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": role,
        "dashboard": dashboard
    }
# ---------------------------------------------------------
# LIST USERS
# GET /api/auth/users
#
# ADMIN ONLY
# ---------------------------------------------------------


@router.get(
    "/users",
    response_model=list[UserResponse]
)
def list_users(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db)
):
    payload = decode_access_token(credentials.credentials)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    admin_id = payload.get("sub")

    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    admin = db.execute(
        select(User).where(User.id == int(admin_id))
    ).scalar_one_or_none()

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if admin.role.upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN users can view users"
        )

    users = db.execute(
        select(User).order_by(User.id)
    ).scalars().all()

    return users
# ---------------------------------------------------------
# UPDATE USER STATUS
# PUT /api/auth/users/{user_id}/status
#
# ADMIN ONLY
# ---------------------------------------------------------


@router.put(
    "/users/{user_id}/status",
    response_model=UserResponse
)
def update_user_status(
    user_id: int,
    status_data: UserStatusUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db)
):
    payload = decode_access_token(credentials.credentials)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    admin_id = payload.get("sub")

    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    admin = db.execute(
        select(User).where(User.id == int(admin_id))
    ).scalar_one_or_none()

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if admin.role.upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN users can change user status"
        )

    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent an admin from accidentally disabling their own account
    if user.id == admin.id and status_data.active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account"
        )

    user.active = status_data.active

    db.commit()
    db.refresh(user)
    create_audit_log(
        db=db,
        action="USER_STATUS_UPDATED",
        user_id=admin.id,
        entity_type="USER",
        entity_id=user.id,
        details={
            "email": user.email,
            "role": user.role,
            "active": user.active,
        },
    )

    db.commit()

    return user



# ---------------------------------------------------------
# CHANGE SUPERVISING ANM OF AN ASHA WORKER
# PUT /api/auth/users/{user_id}/anm
#
# ADMIN ONLY. Her patients move with her to the new ANM.
# ---------------------------------------------------------


@router.put(
    "/users/{user_id}/anm",
    response_model=UserResponse
)
def update_user_anm(
    user_id: int,
    data: UserSupervisorUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db)
):
    admin = _user_from_token(credentials, db)

    if admin.role.upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN users can change the supervising ANM"
        )

    user = db.execute(
        select(User).where(User.id == user_id)
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.role.upper() != "ASHA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only ASHA workers have a supervising ANM"
        )

    previous_anm_id = user.anm_id
    user.anm_id = (
        _valid_anm(db, data.anm_id).id
        if data.anm_id is not None
        else None
    )

    db.commit()
    db.refresh(user)
    create_audit_log(
        db=db,
        action="USER_ANM_UPDATED",
        user_id=admin.id,
        entity_type="USER",
        entity_id=user.id,
        details={
            "email": user.email,
            "previous_anm_id": previous_anm_id,
            "anm_id": user.anm_id,
        },
    )

    db.commit()

    return user


# ---------------------------------------------------------
# MY ASHA WORKERS
# GET /api/auth/my-ashas
#
# ANM ONLY: the ASHA workers she supervises.
# ---------------------------------------------------------


@router.get(
    "/my-ashas",
    response_model=list[UserResponse]
)
def list_my_ashas(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db)
):
    user = _user_from_token(credentials, db)

    if user.role.upper() != "ANM":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ANM users have ASHA workers"
        )

    return db.execute(
        select(User)
        .where(User.anm_id == user.id, User.role == "ASHA")
        .order_by(User.name)
    ).scalars().all()
