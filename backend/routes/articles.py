from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import List
import logging
from ..models.article import MediumArticle, ArticlesResponse
from ..services.medium_service import medium_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/articles", tags=["articles"])

@router.get("/", response_model=ArticlesResponse)
async def get_medium_articles():
    """
    Fetch all published Medium articles for the configured user.
    
    Returns:
        ArticlesResponse: Contains list of articles with metadata
    
    Raises:
        HTTPException: If articles cannot be fetched
    """
    try:
        logger.info("Fetching Medium articles from RSS feed")
        articles = await medium_service.get_articles()
        
        if not articles:
            logger.warning("No articles retrieved from Medium RSS feed")
            # Return empty response instead of error for better UX
            return ArticlesResponse(
                articles=[],
                total_count=0,
                last_updated=datetime.now()
            )
        
        logger.info(f"Successfully retrieved {len(articles)} articles")
        return ArticlesResponse(
            articles=articles,
            total_count=len(articles),
            last_updated=datetime.now()
        )
    
    except Exception as e:
        logger.error(f"Failed to fetch Medium articles: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch articles from Medium. Please try again later."
        )

@router.get("/latest", response_model=List[MediumArticle])
async def get_latest_articles(limit: int = 5):
    """
    Fetch the most recent Medium articles with optional limit.
    
    Args:
        limit: Maximum number of articles to return (default: 5)
    
    Returns:
        List[MediumArticle]: Latest articles sorted by publication date
    """
    try:
        articles = await medium_service.get_articles()
        return articles[:limit]
    
    except Exception as e:
        logger.error(f"Failed to fetch latest articles: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch latest articles"
        )

@router.get("/health")
async def check_medium_integration():
    """
    Health check endpoint to verify Medium RSS feed accessibility.
    
    Returns:
        dict: Status information about Medium integration
    """
    try:
        rss_data = await medium_service.fetch_rss_data()
        if rss_data:
            return {
                "status": "healthy",
                "message": "Medium RSS feed is accessible",
                "rss_url": medium_service.rss_url,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "status": "unhealthy",
                "message": "Medium RSS feed is not accessible",
                "rss_url": medium_service.rss_url,
                "timestamp": datetime.now().isoformat()
            }
    
    except Exception as e:
        return {
            "status": "error",
            "message": f"Health check failed: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }