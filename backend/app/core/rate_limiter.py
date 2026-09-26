import time
from collections import defaultdict
from fastapi import Request, HTTPException


class RateLimiter:
    """Simple in-memory sliding-window rate limiter."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _cleanup(self, key: str, now: float) -> None:
        cutoff = now - self.window_seconds
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

    def check(self, request: Request) -> None:
        now = time.time()
        ip = self._get_client_ip(request)
        self._cleanup(ip, now)
        if len(self._requests[ip]) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "RATE_LIMITED",
                    "message": f"Too many requests. Limit: {self.max_requests} per {self.window_seconds}s",
                },
            )
        self._requests[ip].append(now)


# Global instance for general endpoint rate limiting
general_limiter = RateLimiter(max_requests=120, window_seconds=60)
