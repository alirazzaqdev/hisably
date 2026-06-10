from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    ResendOtpRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    VerifyOtpRequest,
)
from app.schemas.user import UserOut
from app.services import auth_service
from app.services.auth_service import AuthError

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_token_response(token_pair: auth_service.TokenPair) -> TokenResponse:
    return TokenResponse(access_token=token_pair.access_token, refresh_token=token_pair.refresh_token)


@router.post("/signup", response_model=UserOut, status_code=201)
async def signup(payload: SignupRequest, db: AsyncSession = Depends(get_db)) -> UserOut:
    try:
        user = await auth_service.signup(db, payload.email, payload.password)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    return UserOut.from_user(user)


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(payload: VerifyOtpRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        user = await auth_service.verify_otp(db, payload.email, payload.otp_code)
        token_pair = await auth_service.issue_token_pair(db, user)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    return _to_token_response(token_pair)


@router.post("/resend-otp", response_model=MessageResponse)
async def resend_otp(payload: ResendOtpRequest, db: AsyncSession = Depends(get_db)) -> MessageResponse:
    try:
        await auth_service.resend_otp(db, payload.email)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    return MessageResponse(message="A new verification code has been sent to your email.")


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        token_pair = await auth_service.login(db, payload.email, payload.password)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    return _to_token_response(token_pair)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        token_pair = await auth_service.refresh(db, payload.refresh_token)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    return _to_token_response(token_pair)


@router.post("/logout", response_model=MessageResponse)
async def logout(payload: LogoutRequest, db: AsyncSession = Depends(get_db)) -> MessageResponse:
    await auth_service.logout(db, payload.refresh_token)
    return MessageResponse(message="Logged out.")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)) -> MessageResponse:
    await auth_service.forgot_password(db, payload.email)
    return MessageResponse(message="If an account exists for this email, a reset code has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)) -> MessageResponse:
    try:
        await auth_service.reset_password(db, payload.email, payload.otp_code, payload.new_password)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    return MessageResponse(message="Password has been reset. You can now log in.")
