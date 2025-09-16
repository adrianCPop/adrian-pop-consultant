#!/usr/bin/env python3
"""
Backend Test Suite for Medium RSS Integration
Tests the new Medium RSS integration endpoints for Adrian Pop's portfolio.
"""

import asyncio
import httpx
import json
import time
from datetime import datetime
from typing import Dict, List, Any
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

class MediumRSSIntegrationTester:
    def __init__(self):
        self.base_url = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
        self.api_base = f"{self.base_url}/api"
        self.timeout = 30
        self.test_results = []
        
    def log_test(self, test_name: str, status: str, details: str = "", response_time: float = 0):
        """Log test results"""
        result = {
            'test': test_name,
            'status': status,
            'details': details,
            'response_time': f"{response_time:.2f}s" if response_time > 0 else "N/A",
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        print(f"[{status}] {test_name}: {details}")
        
    async def test_articles_main_endpoint(self):
        """Test GET /api/articles/ - Main endpoint to fetch all Medium articles"""
        test_name = "Articles Main Endpoint"
        try:
            start_time = time.time()
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.api_base}/articles/")
                response_time = time.time() - start_time
                
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ['articles', 'total_count', 'last_updated', 'source']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(test_name, "FAIL", 
                                f"Missing required fields: {missing_fields}", response_time)
                    return False
                
                # Validate articles structure
                articles = data.get('articles', [])
                if not isinstance(articles, list):
                    self.log_test(test_name, "FAIL", 
                                "Articles field is not a list", response_time)
                    return False
                
                # Test article structure if articles exist
                if articles:
                    article = articles[0]
                    required_article_fields = ['title', 'url', 'published_date']
                    missing_article_fields = [field for field in required_article_fields 
                                            if field not in article]
                    
                    if missing_article_fields:
                        self.log_test(test_name, "FAIL", 
                                    f"Article missing required fields: {missing_article_fields}", 
                                    response_time)
                        return False
                    
                    # Validate URL format
                    if not article['url'].startswith('https://'):
                        self.log_test(test_name, "FAIL", 
                                    f"Invalid article URL format: {article['url']}", response_time)
                        return False
                    
                    # Check if articles are sorted by date (newest first)
                    if len(articles) > 1:
                        first_date = datetime.fromisoformat(articles[0]['published_date'].replace('Z', '+00:00'))
                        second_date = datetime.fromisoformat(articles[1]['published_date'].replace('Z', '+00:00'))
                        if first_date < second_date:
                            self.log_test(test_name, "FAIL", 
                                        "Articles not sorted by date (newest first)", response_time)
                            return False
                
                self.log_test(test_name, "PASS", 
                            f"Retrieved {len(articles)} articles successfully", response_time)
                return True
            else:
                self.log_test(test_name, "FAIL", 
                            f"HTTP {response.status_code}: {response.text}", response_time)
                return False
                
        except Exception as e:
            self.log_test(test_name, "ERROR", f"Exception: {str(e)}")
            return False
    
    async def test_articles_latest_endpoint(self):
        """Test GET /api/articles/latest?limit=N - Get latest N articles"""
        test_name = "Articles Latest Endpoint"
        try:
            # Test with default limit
            start_time = time.time()
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.api_base}/articles/latest")
                response_time = time.time() - start_time
                
            if response.status_code == 200:
                articles = response.json()
                
                if not isinstance(articles, list):
                    self.log_test(test_name, "FAIL", 
                                "Response is not a list", response_time)
                    return False
                
                # Test with custom limit
                test_limit = 3
                start_time = time.time()
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(f"{self.api_base}/articles/latest?limit={test_limit}")
                    response_time = time.time() - start_time
                
                if response.status_code == 200:
                    limited_articles = response.json()
                    
                    if len(limited_articles) > test_limit:
                        self.log_test(test_name, "FAIL", 
                                    f"Returned {len(limited_articles)} articles, expected max {test_limit}", 
                                    response_time)
                        return False
                    
                    # Validate article structure
                    if limited_articles:
                        article = limited_articles[0]
                        required_fields = ['title', 'url', 'published_date']
                        missing_fields = [field for field in required_fields if field not in article]
                        
                        if missing_fields:
                            self.log_test(test_name, "FAIL", 
                                        f"Article missing fields: {missing_fields}", response_time)
                            return False
                    
                    self.log_test(test_name, "PASS", 
                                f"Latest endpoint working, returned {len(limited_articles)} articles with limit {test_limit}", 
                                response_time)
                    return True
                else:
                    self.log_test(test_name, "FAIL", 
                                f"HTTP {response.status_code} with limit parameter", response_time)
                    return False
            else:
                self.log_test(test_name, "FAIL", 
                            f"HTTP {response.status_code}: {response.text}", response_time)
                return False
                
        except Exception as e:
            self.log_test(test_name, "ERROR", f"Exception: {str(e)}")
            return False
    
    async def test_articles_health_endpoint(self):
        """Test GET /api/articles/health - Health check for Medium RSS integration"""
        test_name = "Articles Health Endpoint"
        try:
            start_time = time.time()
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.api_base}/articles/health")
                response_time = time.time() - start_time
                
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ['status', 'message', 'timestamp']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(test_name, "FAIL", 
                                f"Missing required fields: {missing_fields}", response_time)
                    return False
                
                status = data.get('status')
                if status not in ['healthy', 'unhealthy', 'error']:
                    self.log_test(test_name, "FAIL", 
                                f"Invalid status value: {status}", response_time)
                    return False
                
                # Check if RSS URL is included
                if 'rss_url' in data:
                    rss_url = data['rss_url']
                    if not rss_url.startswith('https://medium.com/feed/@'):
                        self.log_test(test_name, "FAIL", 
                                    f"Invalid RSS URL format: {rss_url}", response_time)
                        return False
                
                self.log_test(test_name, "PASS", 
                            f"Health check status: {status} - {data.get('message', '')}", 
                            response_time)
                return True
            else:
                self.log_test(test_name, "FAIL", 
                            f"HTTP {response.status_code}: {response.text}", response_time)
                return False
                
        except Exception as e:
            self.log_test(test_name, "ERROR", f"Exception: {str(e)}")
            return False
    
    async def test_data_quality(self):
        """Test data quality - verify articles match Adrian's Medium profile"""
        test_name = "Data Quality Validation"
        try:
            start_time = time.time()
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.api_base}/articles/")
                response_time = time.time() - start_time
                
            if response.status_code == 200:
                data = response.json()
                articles = data.get('articles', [])
                
                if not articles:
                    self.log_test(test_name, "FAIL", 
                                "No articles found for data quality validation", response_time)
                    return False
                
                quality_issues = []
                
                for i, article in enumerate(articles):
                    # Check URL points to Medium
                    if not article['url'].startswith('https://medium.com/'):
                        quality_issues.append(f"Article {i+1}: URL doesn't point to Medium")
                    
                    # Check title is not empty
                    if not article.get('title', '').strip():
                        quality_issues.append(f"Article {i+1}: Empty title")
                    
                    # Check published date is valid
                    try:
                        pub_date = datetime.fromisoformat(article['published_date'].replace('Z', '+00:00'))
                        if pub_date > datetime.now():
                            quality_issues.append(f"Article {i+1}: Future publication date")
                    except:
                        quality_issues.append(f"Article {i+1}: Invalid date format")
                    
                    # Check reading time format (should be "X min" or "X min read")
                    reading_time = article.get('reading_time', '')
                    if reading_time and not (reading_time.endswith('min read') or reading_time.endswith('min')):
                        quality_issues.append(f"Article {i+1}: Invalid reading time format")
                
                if quality_issues:
                    self.log_test(test_name, "FAIL", 
                                f"Data quality issues: {'; '.join(quality_issues[:3])}", 
                                response_time)
                    return False
                
                self.log_test(test_name, "PASS", 
                            f"Data quality validated for {len(articles)} articles", response_time)
                return True
            else:
                self.log_test(test_name, "FAIL", 
                            f"HTTP {response.status_code}: {response.text}", response_time)
                return False
                
        except Exception as e:
            self.log_test(test_name, "ERROR", f"Exception: {str(e)}")
            return False
    
    async def test_error_handling(self):
        """Test error handling with invalid parameters"""
        test_name = "Error Handling"
        try:
            # Test invalid limit parameter
            start_time = time.time()
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.api_base}/articles/latest?limit=invalid")
                response_time = time.time() - start_time
                
            # Should handle gracefully (either 400 or default behavior)
            if response.status_code not in [200, 400, 422]:
                self.log_test(test_name, "FAIL", 
                            f"Unexpected status code {response.status_code} for invalid limit", 
                            response_time)
                return False
            
            # Test very large limit
            start_time = time.time()
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.api_base}/articles/latest?limit=999999")
                response_time = time.time() - start_time
                
            if response.status_code != 200:
                self.log_test(test_name, "FAIL", 
                            f"Failed to handle large limit parameter: {response.status_code}", 
                            response_time)
                return False
            
            self.log_test(test_name, "PASS", 
                        "Error handling working correctly", response_time)
            return True
            
        except Exception as e:
            self.log_test(test_name, "ERROR", f"Exception: {str(e)}")
            return False
    
    async def test_performance(self):
        """Test performance - response times should be reasonable"""
        test_name = "Performance Test"
        try:
            # Test main endpoint performance
            start_time = time.time()
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.api_base}/articles/")
                response_time = time.time() - start_time
                
            if response.status_code != 200:
                self.log_test(test_name, "FAIL", 
                            f"Performance test failed due to HTTP {response.status_code}", 
                            response_time)
                return False
            
            # Check if response time is reasonable (under 10 seconds as specified)
            if response_time > 10:
                self.log_test(test_name, "FAIL", 
                            f"Response time too slow: {response_time:.2f}s (should be under 10s)", 
                            response_time)
                return False
            
            # Test concurrent requests
            concurrent_tasks = []
            for _ in range(3):
                task = self.make_concurrent_request()
                concurrent_tasks.append(task)
            
            start_time = time.time()
            results = await asyncio.gather(*concurrent_tasks, return_exceptions=True)
            concurrent_time = time.time() - start_time
            
            # Check if any concurrent requests failed
            failed_requests = [r for r in results if isinstance(r, Exception)]
            if failed_requests:
                self.log_test(test_name, "FAIL", 
                            f"Concurrent requests failed: {len(failed_requests)} out of 3", 
                            concurrent_time)
                return False
            
            self.log_test(test_name, "PASS", 
                        f"Performance acceptable: {response_time:.2f}s single, {concurrent_time:.2f}s concurrent", 
                        response_time)
            return True
            
        except Exception as e:
            self.log_test(test_name, "ERROR", f"Exception: {str(e)}")
            return False
    
    async def make_concurrent_request(self):
        """Helper method for concurrent request testing"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(f"{self.api_base}/articles/latest?limit=2")
            return response.status_code == 200
    
    async def run_all_tests(self):
        """Run all tests and return summary"""
        print(f"Starting Medium RSS Integration Tests...")
        print(f"Backend URL: {self.base_url}")
        print(f"API Base URL: {self.api_base}")
        print("=" * 60)
        
        # Run all tests
        tests = [
            self.test_articles_main_endpoint(),
            self.test_articles_latest_endpoint(),
            self.test_articles_health_endpoint(),
            self.test_data_quality(),
            self.test_error_handling(),
            self.test_performance()
        ]
        
        results = await asyncio.gather(*tests, return_exceptions=True)
        
        # Calculate summary
        passed = sum(1 for r in results if r is True)
        failed = sum(1 for r in results if r is False)
        errors = sum(1 for r in results if isinstance(r, Exception))
        
        print("=" * 60)
        print(f"TEST SUMMARY:")
        print(f"PASSED: {passed}")
        print(f"FAILED: {failed}")
        print(f"ERRORS: {errors}")
        print(f"TOTAL: {len(tests)}")
        
        # Print detailed results
        print("\nDETAILED RESULTS:")
        for result in self.test_results:
            status_symbol = "✅" if result['status'] == "PASS" else "❌" if result['status'] == "FAIL" else "⚠️"
            print(f"{status_symbol} {result['test']}: {result['details']} ({result['response_time']})")
        
        return passed, failed, errors

async def main():
    """Main test runner"""
    tester = MediumRSSIntegrationTester()
    passed, failed, errors = await tester.run_all_tests()
    
    # Exit with appropriate code
    if failed > 0 or errors > 0:
        exit(1)
    else:
        exit(0)

if __name__ == "__main__":
    asyncio.run(main())