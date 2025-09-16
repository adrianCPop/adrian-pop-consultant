from pydantic import BaseModel, HttpUrl
from datetime import datetime
from typing import Optional, List

class MediumArticle(BaseModel):
    title: str
    description: Optional[str] = None
    url: HttpUrl
    published_date: datetime
    reading_time: Optional[str] = None
    tags: Optional[List[str]] = []
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ArticlesResponse(BaseModel):
    articles: List[MediumArticle]
    total_count: int
    last_updated: datetime
    source: str = "Medium RSS Feed"