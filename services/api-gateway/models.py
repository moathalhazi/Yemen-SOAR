from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: Dict[str, Any]

class TokenData(BaseModel):
    user_id: Optional[UUID] = None
    username: Optional[str] = None
    roles: List[str] = []
    permissions: List[str] = []

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: UUID
    username: str
    email: Optional[str]
    full_name: Optional[str]
    phone: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    login_count: Optional[int] = 0
    last_login: Optional[datetime] = None
    playbooks_authored: Optional[int] = 0
    incidents_resolved: Optional[int] = 0
    is_active: bool
    roles: List[str]
    permissions: List[str]

class HealthResponse(BaseModel):
    status: str
    service: str

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str
    role_ids: List[UUID] = []

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    role_ids: Optional[List[UUID]] = None
    password: Optional[str] = None

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permission_ids: List[UUID] = []

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[List[UUID]] = None

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class Report(BaseModel):
    id: UUID
    name: str
    type: str
    format: str
    generated_at: datetime
    status: str
    created_by: Optional[UUID]

class ReportGenerateRequest(BaseModel):
    format: str
    include_alerts: bool = True
    include_incidents: bool = True
    include_audit_logs: bool = True
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    assigned_to: Optional[str] = None

class ReportSchedule(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    schedule_type: str
    format: str
    filters: Dict[str, Any]
    created_by: Optional[UUID] = None
    is_active: bool
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class ReportScheduleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    schedule_type: str
    format: str = "pdf"
    filters: Dict[str, Any] = {}
    is_active: bool = True

class ReportScheduleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schedule_type: Optional[str] = None
    format: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class ReportAnalyticsResponse(BaseModel):
    mttd_avg: float
    mttr_avg: float
    incidents_trend: List[Dict[str, Any]]
    severity_distribution: Dict[str, int]