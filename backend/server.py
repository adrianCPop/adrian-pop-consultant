# server.py
import os
import uuid
import logging
from datetime import datetime

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional

from routes.articles import router as articles_router

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s"
)
logger = logging.getLogger("server")

# -----------------------------------------------------------------------------
# App & Router
# -----------------------------------------------------------------------------
app = FastAPI(
    title="Adrian Pop Portfolio API",
    description="Professional consulting portfolio backend API",
    version="1.0.0",
)
api_router = APIRouter(prefix="/api")

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
MONGO_URL = os.getenv(
    "MONGO_URL",
    # Fallback (adjust if you use auth in env instead)
    "mongodb://mongodb:27017/adrian_pop_portfolio"
)

MONGO_DB_NAME = os.getenv("MONGO_DB", "adrian_pop_portfolio")

# -----------------------------------------------------------------------------
# Globals (initialized on startup)
# -----------------------------------------------------------------------------
mongo_client: Optional[AsyncIOMotorClient] = None
db = None

# -----------------------------------------------------------------------------
# Models (example)
# -----------------------------------------------------------------------------
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str
# -----------------------------------------------------------------------------
# Lifecycle
# -----------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup():
    global mongo_client, db
    logger.info("Starting up the application...")
    logger.info(f"MongoDB URL: {MONGO_URL}")
    logger.info(f"Database: {MONGO_DB_NAME}")

    mongo_client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=2000)
    db = mongo_client[MONGO_DB_NAME]
    logger.info("Application startup complete.")

@app.on_event("shutdown")
async def on_shutdown():
    global mongo_client
    if mongo_client:
        mongo_client.close()
        logger.info("Mongo client closed.")

# -----------------------------------------------------------------------------
# Liveness & Readiness
# -----------------------------------------------------------------------------
@app.get("/health")
async def health():
    """Liveness probe: does not touch external deps."""
    return {
        "status": "ok",
        "service": "adrian-pop-portfolio",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

@app.get("/ready")
async def ready():
    """Readiness probe: verifies Mongo connectivity."""
    try:
        await db.command("ping")  # type: ignore
        return {
            "status": "ready",
            "database": "connected",
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "not-ready",
                "database": "disconnected",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat() + "Z",
            },
        )

# -----------------------------------------------------------------------------
# Root routes (no prefix)
# -----------------------------------------------------------------------------
@app.get("/")
async def root():
    return {
        "message": "Adrian Pop Portfolio API",
        "status": "running",
        "version": "1.0.0",
        "description": "Professional consulting portfolio backend",
    }

# -----------------------------------------------------------------------------
# API routes (prefixed with /api)
# -----------------------------------------------------------------------------
@api_router.get("/")
async def api_root():
    return {"message": "API root", "version": "1.0.0"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status(payload: StatusCheckCreate):
    item = StatusCheck(client_name=payload.client_name)
    # Example persistence (optional):
    try:
        await db.status_checks.insert_one(item.model_dump())  # type: ignore
    except Exception as e:
        logger.warning(f"Could not write status check: {e}")
    return item

api_router.include_router(articles_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
