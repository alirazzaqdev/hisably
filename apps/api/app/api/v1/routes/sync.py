from fastapi import APIRouter

router = APIRouter(prefix="/sync", tags=["sync"])

# TODO (Phase 1, module: Offline sync): POST /sync/push (idempotent via
# sync_log), GET /sync/pull?since=
