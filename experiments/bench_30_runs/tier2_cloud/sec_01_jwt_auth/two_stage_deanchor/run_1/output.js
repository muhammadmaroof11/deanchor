Here is a complete, production-grade, greenfield implementation designed strictly from the provided domain schema. 

The project follows a **Clean Architecture** (Ports and Adapters) pattern, utilizing **Python 3.11+**, **FastAPI**, **SQLAlchemy (Async)**, **Pydantic v2**, and **PyJWT/Passlib** to enforce all structural, cryptographic, and behavioral invariants.

---

### File Directory Structure
```text
auth_service/
├── pyproject.toml
├── Dockerfile
├── alembic.ini
├── src/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── domain/
│   │   ├── __init__.py
│   │   ├── entities.py
│   │   └── exceptions.py
│   ├── application/
│   │   ├── __init__.py
│   │   ├── ports.py
│   │   └── services.py
│   ├── infrastructure/
│   │   ├── __init__.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── repositories.py
│   │   └── security.py
│   └── presentation/
│       ├── __init__.py
│       └── api.py
└── tests/
    ├── __init__.py
    ├── conftest.py
    └── test_auth.py
```

---

### Configuration & Dependencies

#### `pyproject.toml`
```toml
[tool.poetry]
name = "auth-service"
version = "1.0.0"
description = "Production-grade Authentication and Authorization Microservice"
authors = ["System Architect <architect@domain.com>"]
packages = [{include = "src"}]

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.110.0"
uvicorn = {extras = ["standard"], version = "^0.28.0"}
sqlalchemy = {extras = ["asyncio"], version = "^2.0.28"}
asyncpg = "^0.29.0"
pydantic = "^2.6.4"
pydantic-settings = "^2.2.0"
alembic = "^1.13.1"
passlib = {extras = ["bcrypt"], version = "^1.7.4"}
pyjwt = "^2.8.0"
bcrypt = "4.0.1"

[tool.poetry.group.dev.dependencies]
pytest = "^8.1.1"
pytest-asyncio = "^0.23.5"
httpx = "^0.27.0"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

#### `src/config.py`
```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/auth_db"
    JWT_SECRET_KEY: str = "SUPER_SECURE_DEFAULT_SECRET_CHANGE_ME"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_SECONDS: int = 86400  # 24 hours
    BCRYPT_ROUNDS: int = 8

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
```

---

### Domain Layer (`src/domain/`)

#### `src/domain/exceptions.py`
```python
class DomainException(Exception):
    pass


class UserAlreadyExistsError(DomainException):
    pass


class InvalidCredentialsError(DomainException):
    pass


class RoleNotFoundError(DomainException):
    pass


class PersistenceError(DomainException):
    pass
```

#### `src/domain/entities.py`
```python
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Role:
    id: int
    name: str


@dataclass
class User:
    id: Optional[int] = None
    username: str = ""
    email: str = ""
    password: str = ""  # HashedString
    roles: List[Role] = field(default_factory=list)


@dataclass
class AuthenticationToken:
    token: str
    expires_in: int = 86400
    algorithm: str = "HS256"
```

---

### Application Layer (`src/application/`)

#### `src/application/ports.py`
```python
from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.entities import User, Role


class UserRepositoryPort(ABC):
    @abstractmethod
    async def get_by_username(self, username: str) -> Optional[User]:
        pass

    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[User]:
        pass

    @abstractmethod
    async def save(self, user: User) -> User:
        pass


class RoleRepositoryPort(ABC):
    @abstractmethod
    async def get_by_names(self, names: List[str]) -> List[Role]:
        pass

    @abstractmethod
    async def get_default_role(self) -> Role:
        pass


class PasswordHasherPort(ABC):
    @abstractmethod
    def hash_password(self, plaintext: str) -> str:
        pass

    @abstractmethod
    def verify_password(self, plaintext: str, hashed: str) -> bool:
        pass


class TokenGeneratorPort(ABC):
    @abstractmethod
    def generate_token(self, user: User) -> str:
        pass
```

#### `src/application/services.py`
```python
from typing import List, Dict, Any
from src.domain.entities import User
from src.domain.exceptions import InvalidCredentialsError, PersistenceError, RoleNotFoundError
from src.application.ports import (
    UserRepositoryPort,
    RoleRepositoryPort,
    PasswordHasherPort,
    TokenGeneratorPort,
)


class AuthService:
    def __init__(
        self,
        user_repo: UserRepositoryPort,
        role_repo: RoleRepositoryPort,
        hasher: PasswordHasherPort,
        token_gen: TokenGeneratorPort,
    ):
        self.user_repo = user_repo
        self.role_repo = role_repo
        self.hasher = hasher
        self.token_gen = token_gen

    async def signup(
        self, username: str, email: str, password: str, role_names: List[str] = None
    ) -> Dict[str, Any]:
        # Invariant: Password must be cryptographically hashed using bcrypt with salt rounds of 8
        hashed_password = self.hasher.hash_password(password)

        # Invariant: Resolve roles
        if role_names:
            roles = await self.role_repo.get_by_names(role_names)
            if len(roles) != len(role_names):
                raise RoleNotFoundError("One or more specified roles do not exist.")
        else:
            # Invariant: Default to base role identifier (id: 1)
            default_role = await self.role_repo.get_default_role()
            roles = [default_role]

        user = User(
            username=username,
            email=email,
            password=hashed_password,
            roles=roles,
        )

        try:
            # State Transition: Unregistered -> RegisteredWithRoles
            await self.user_repo.save(user)
        except Exception as e:
            # Invariant: Persistence failures must result in a system error boundary catch
            raise PersistenceError(f"Failed to persist user: {str(e)}") from e

        return {
            "success": True,
            "message": "User registered successfully (SIGNUP_INITIATED -> RegisteredWithRoles)",
        }

    async def signin(self, username: str, password: str) -> Dict[str, Any]:
        # Invariant: Authentication fails if the username does not resolve to an existing User entity
        user = await self.user_repo.get_by_username(username)
        if not user:
            raise InvalidCredentialsError("Invalid username or password.")

        # Invariant: Authentication fails if the provided plaintext password does not match
        if not self.hasher.verify_password(password, user.password):
            raise InvalidCredentialsError("Invalid username or password.")

        # Invariant: Generate JWT token (HS256, 24-hour expiration)
        access_token = self.token_gen.generate_token(user)

        # Invariant: Associated user roles must be resolved, normalized to uppercase, and prefixed with 'ROLE_'
        normalized_roles = [f"ROLE_{role.