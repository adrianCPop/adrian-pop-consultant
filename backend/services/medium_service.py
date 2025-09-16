import asyncio
import httpx
import feedparser
import readtime
from bs4 import BeautifulSoup
from datetime import datetime
from dateutil import parser as date_parser
from typing import List, Optional
import logging
from ..models.article import MediumArticle

logger = logging.getLogger(__name__)

class MediumService:
    def __init__(self, medium_username: str = "adrian.c.pop"):
        self.medium_username = medium_username
        self.rss_url = f"https://medium.com/feed/@{self.medium_username}"
        self.timeout = 30
    
    async def fetch_rss_data(self) -> Optional[str]:
        """Fetch RSS data from Medium with proper error handling."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    self.rss_url,
                    headers={"User-Agent": "Portfolio Bot 1.0"}
                )
                response.raise_for_status()
                return response.text
        except httpx.TimeoutException:
            logger.error(f"Timeout occurred while fetching RSS from {self.rss_url}")
            return None
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error occurred: {e.response.status_code}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error occurred: {str(e)}")
            return None
    
    def clean_html_content(self, html_content: str) -> str:
        """Extract clean text from HTML content for reading time calculation."""
        soup = BeautifulSoup(html_content, 'html.parser')
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        return soup.get_text(strip=True)
    
    def calculate_reading_time(self, content: str) -> str:
        """Calculate reading time using Medium's algorithm with fallbacks."""
        try:
            # Primary method using readtime package
            clean_content = self.clean_html_content(content)
            if clean_content.strip():
                result = readtime.of_text(clean_content)
                return result.text
        except Exception as e:
            logger.warning(f"readtime calculation failed: {e}")
        
        try:
            # Fallback: Manual calculation using Medium's algorithm
            clean_content = self.clean_html_content(content)
            word_count = len(clean_content.split())
            # Medium uses ~265 WPM average
            minutes = max(1, round(word_count / 265))
            return f"{minutes} min read"
        except Exception as e:
            logger.warning(f"Manual reading time calculation failed: {e}")
        
        # Ultimate fallback
        return "1 min read"
    
    def parse_feed_entry(self, entry) -> Optional[MediumArticle]:
        """Parse individual RSS feed entry into MediumArticle model."""
        try:
            # Extract basic information
            title = getattr(entry, 'title', 'Untitled')
            description = getattr(entry, 'summary', '')
            url = getattr(entry, 'link', '')
            
            # Parse publication date
            published_date = datetime.now()
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                published_date = datetime(*entry.published_parsed[:6])
            elif hasattr(entry, 'published'):
                try:
                    published_date = date_parser.parse(entry.published)
                except:
                    pass
            
            # Extract tags if available
            tags = []
            if hasattr(entry, 'tags'):
                tags = [tag.term for tag in entry.tags if hasattr(tag, 'term')]
            
            # Calculate reading time from content
            reading_time = "1 min read"  # Default fallback
            if hasattr(entry, 'content') and entry.content:
                content = entry.content[0].value
                reading_time = self.calculate_reading_time(content)
            elif description:
                reading_time = self.calculate_reading_time(description)
            
            return MediumArticle(
                title=title,
                description=description,
                url=url,
                published_date=published_date,
                reading_time=reading_time,
                tags=tags
            )
        
        except Exception as e:
            logger.error(f"Error parsing feed entry: {str(e)}")
            return None
    
    async def get_articles(self) -> List[MediumArticle]:
        """Fetch and parse all articles from Medium RSS feed."""
        rss_data = await self.fetch_rss_data()
        if not rss_data:
            logger.warning("Failed to fetch RSS data, returning empty list")
            return []
        
        try:
            feed = feedparser.parse(rss_data)
            articles = []
            
            for entry in feed.entries:
                article = self.parse_feed_entry(entry)
                if article:
                    articles.append(article)
            
            # Sort articles by publication date (newest first)
            articles.sort(key=lambda x: x.published_date, reverse=True)
            return articles
        
        except Exception as e:
            logger.error(f"Error parsing RSS feed: {str(e)}")
            return []

# Create service instance
medium_service = MediumService()