import os
import time
import hashlib
import google.generativeai as genai
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# Support multiple comma-separated API keys for rotation
_api_keys = [k.strip() for k in os.getenv("GEMINI_API_KEY", "").split(",") if k.strip()]
_current_key_index = 0
_call_count = 0

# Rate limiting: enforce minimum gap between API calls (seconds)
_MIN_REQUEST_GAP = 4  # free tier allows ~15 RPM → 1 per 4s is safe
_last_request_time = 0.0

# Response cache: avoid re-calling Gemini for identical prompts
_response_cache: dict[str, tuple[str, float]] = {}  # hash → (response, timestamp)
_CACHE_TTL = 600  # cache responses for 10 minutes

if _api_keys:
    genai.configure(api_key=_api_keys[0])

DEFAULT_GENERATION_CONFIG = genai.GenerationConfig(
    temperature=0.3,
    max_output_tokens=1000,
    top_p=0.9,
)


class QuotaExceededError(Exception):
    """Raised when all Gemini API keys' quota is exhausted."""
    pass


def _rotate_key():
    """Switch to the next API key. Returns True if a new key is available."""
    global _current_key_index
    if len(_api_keys) <= 1:
        return False
    _current_key_index = (_current_key_index + 1) % len(_api_keys)
    genai.configure(api_key=_api_keys[_current_key_index])
    print(f"Rotated to API key #{_current_key_index + 1}")
    return True


def _cache_key(system_prompt: str, user_prompt: str) -> str:
    """Generate a cache key from prompts."""
    raw = f"{system_prompt}|||{user_prompt}"
    return hashlib.sha256(raw.encode()).hexdigest()


def get_gemini_response(system_prompt: str, user_prompt: str) -> str:
    """Call Gemini with a system instruction and user prompt.
    Includes rate limiting, caching, retry with backoff, and key rotation."""
    global _call_count, _last_request_time

    # --- Check cache first ---
    cache_k = _cache_key(system_prompt, user_prompt)
    if cache_k in _response_cache:
        cached_response, cached_at = _response_cache[cache_k]
        if time.time() - cached_at < _CACHE_TTL:
            print(f"\n[GEMINI CACHE HIT] {datetime.now().strftime('%H:%M:%S')} — returning cached response")
            return cached_response
        else:
            del _response_cache[cache_k]  # expired

    _call_count += 1
    total_chars = len(system_prompt) + len(user_prompt)
    print(f"\n[GEMINI CALL #{_call_count}] {datetime.now().strftime('%H:%M:%S')}")
    print(f"  System prompt: {len(system_prompt)} chars")
    print(f"  User prompt: {len(user_prompt)} chars")
    print(f"  Total: {total_chars} chars (~{total_chars // 4} tokens)")

    # --- Rate limiting: wait if too soon since last call ---
    elapsed = time.time() - _last_request_time
    if elapsed < _MIN_REQUEST_GAP:
        wait_time = _MIN_REQUEST_GAP - elapsed
        print(f"  Rate limiter: waiting {wait_time:.1f}s before calling API")
        time.sleep(wait_time)

    tried_keys = 0
    max_retries = 2  # retry up to 2 times on 429 (with same key before rotating)

    while tried_keys < len(_api_keys):
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash-lite",
            system_instruction=system_prompt,
        )
        for attempt in range(max_retries + 1):
            try:
                _last_request_time = time.time()
                response = model.generate_content(
                    user_prompt,
                    generation_config=DEFAULT_GENERATION_CONFIG,
                )
                result = response.text
                # Store in cache
                _response_cache[cache_k] = (result, time.time())
                return result
            except Exception as e:
                error_msg = str(e)
                is_rate_limit = "429" in error_msg or "quota" in error_msg.lower() or "rate" in error_msg.lower()
                if is_rate_limit and attempt < max_retries:
                    backoff = (attempt + 1) * 5  # 5s, then 10s
                    print(f"  429 rate limit — retrying in {backoff}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(backoff)
                    continue
                elif is_rate_limit:
                    # Exhausted retries for this key, try next key
                    tried_keys += 1
                    if _rotate_key():
                        break  # break inner for-loop, continue outer while
                    raise QuotaExceededError(
                        "Rate limit exceeded. Please wait 1-2 minutes before trying again."
                    )
                raise  # non-rate-limit error
        else:
            # for-loop completed without break → all retries failed, move to next key
            tried_keys += 1
            if not _rotate_key():
                raise QuotaExceededError(
                    "Rate limit exceeded. Please wait 1-2 minutes before trying again."
                )

    raise QuotaExceededError(
        "All API keys exhausted. Please wait 1-2 minutes or add more keys to GEMINI_API_KEY in .env (comma-separated)."
    )
