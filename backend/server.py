from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(
    title="Adrian Pop Portfolio API",
    description="Professional consulting portfolio backend API",
    version="1.0.0"
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Root level routes (outside of /api prefix)
@app.get("/")
async def app_root():
    return {
        "message": "Adrian Pop Portfolio API", 
        "status": "running", 
        "version": "1.0.0",
        "description": "Professional consulting portfolio backend"
    }

@app.get("/health")
async def health_check():
    try:
        # Test database connection
        await db.admin.command('ping')
        db_status = "connected"
    except Exception as e:
        db_status = "disconnected"
        logger.error(f"Database health check failed: {e}")
    
    return {
        "status": "healthy",
        "service": "adrian-pop-portfolio",
        "timestamp": datetime.utcnow(),
        "database": db_status
    }

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def api_root():
    return {"message": "Hello World", "api_version": "1.0"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    try:
        status_dict = input.dict()
        status_obj = StatusCheck(**status_dict)
        _ = await db.status_checks.insert_one(status_obj.dict())
        return status_obj
    except Exception as e:
        logger.error(f"Error creating status check: {e}")
        raise

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    try:
        status_checks = await db.status_checks.find().to_list(1000)
        return [StatusCheck(**status_check) for status_check in status_checks]
    except Exception as e:
        logger.error(f"Error fetching status checks: {e}")
        raise

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db_client():
    logger.info("Starting up the application...")
    logger.info(f"MongoDB URL: {mongo_url}")
    logger.info(f"Database: {os.environ['DB_NAME']}")

@app.on_event("shutdown")
async def shutdown_db_client():
    logger.info("Shutting down the application...")
    client.close()
