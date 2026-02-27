import os
import time
import json
import hashlib
from groq import Groq
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# Support multiple comma-separated API keys for rotation
_api_keys = [k.strip() for k in os.getenv("GROQ_API_KEY", "").split(",") if k.strip()]
_current_key_index = 0
_call_count = 0

# Rate limiting: enforce minimum gap between API calls (seconds)
_MIN_REQUEST_GAP = 2  # Groq free tier is generous, but stay safe
_last_request_time = 0.0

# Response cache: avoid re-calling for identical prompts
_response_cache: dict[str, tuple[str, float]] = {}  # hash → (response, timestamp)
_CACHE_TTL = 600  # cache responses for 10 minutes

MODEL_NAME = "llama-3.3-70b-versatile"
BROWSER_SEARCH_MODEL = "openai/gpt-oss-20b"

# Create client
_client = Groq(api_key=_api_keys[0]) if _api_keys else None


class QuotaExceededError(Exception):
    """Raised when all API keys' quota is exhausted."""
    pass


def _rotate_key():
    """Switch to the next API key. Returns True if a new key is available."""
    global _current_key_index, _client
    if len(_api_keys) <= 1:
        return False
    _current_key_index = (_current_key_index + 1) % len(_api_keys)
    _client = Groq(api_key=_api_keys[_current_key_index])
    print(f"Rotated to API key #{_current_key_index + 1}")
    return True


def _cache_key(system_prompt: str, user_prompt: str) -> str:
    """Generate a cache key from prompts."""
    raw = f"{system_prompt}|||{user_prompt}"
    return hashlib.sha256(raw.encode()).hexdigest()


def get_groq_response(system_prompt: str, user_prompt: str) -> str:
    """Call Groq Llama 3.3 70B with a system instruction and user prompt.
    Includes rate limiting, caching, retry with backoff, and key rotation."""
    global _call_count, _last_request_time

    if not _client:
        raise QuotaExceededError("No GROQ_API_KEY configured in .env")

    # --- Check cache first ---
    cache_k = _cache_key(system_prompt, user_prompt)
    if cache_k in _response_cache:
        cached_response, cached_at = _response_cache[cache_k]
        if time.time() - cached_at < _CACHE_TTL:
            print(f"\n[GROQ CACHE HIT] {datetime.now().strftime('%H:%M:%S')} — returning cached response")
            return cached_response
        else:
            del _response_cache[cache_k]  # expired

    _call_count += 1
    total_chars = len(system_prompt) + len(user_prompt)
    print(f"\n[GROQ CALL #{_call_count}] {datetime.now().strftime('%H:%M:%S')}")
    print(f"  Model: {MODEL_NAME}")
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
    max_retries = 2  # retry up to 2 times on 429

    while tried_keys < len(_api_keys):
        for attempt in range(max_retries + 1):
            try:
                _last_request_time = time.time()
                chat_completion = _client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    model=MODEL_NAME,
                    temperature=0.3,
                    max_completion_tokens=1024,
                    top_p=0.9,
                )
                result = chat_completion.choices[0].message.content
                # Store in cache
                _response_cache[cache_k] = (result, time.time())
                return result
            except Exception as e:
                error_msg = str(e)
                is_rate_limit = "429" in error_msg or "rate" in error_msg.lower() or "quota" in error_msg.lower() or "limit" in error_msg.lower()
                if is_rate_limit and attempt < max_retries:
                    backoff = (attempt + 1) * 5  # 5s, then 10s
                    print(f"  429 rate limit — retrying in {backoff}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(backoff)
                    continue
                elif is_rate_limit:
                    tried_keys += 1
                    if _rotate_key():
                        break  # break inner for-loop, continue outer while
                    raise QuotaExceededError(
                        "Rate limit exceeded. Please wait a minute before trying again."
                    )
                raise  # non-rate-limit error
        else:
            tried_keys += 1
            if not _rotate_key():
                raise QuotaExceededError(
                    "Rate limit exceeded. Please wait a minute before trying again."
                )

    raise QuotaExceededError(
        "All API keys exhausted. Please wait a minute or add more keys to GROQ_API_KEY in .env (comma-separated)."
    )


def get_groq_browser_search_response(user_query: str) -> str:
    """Call Groq with browser_search tool using openai/gpt-oss-20b model.
    Returns real-time web research with citations. No caching (results should be fresh)."""
    global _call_count, _last_request_time

    if not _client:
        raise QuotaExceededError("No GROQ_API_KEY configured in .env")

    _call_count += 1
    print(f"\n[GROQ BROWSER SEARCH #{_call_count}] {datetime.now().strftime('%H:%M:%S')}")
    print(f"  Model: {BROWSER_SEARCH_MODEL}")
    print(f"  Query: {user_query[:100]}...")

    # --- Rate limiting ---
    elapsed = time.time() - _last_request_time
    if elapsed < _MIN_REQUEST_GAP:
        wait_time = _MIN_REQUEST_GAP - elapsed
        print(f"  Rate limiter: waiting {wait_time:.1f}s before calling API")
        time.sleep(wait_time)

    system_prompt = (
        "You are an expert research assistant with access to real-time web search. "
        "Use browser search to find the most relevant, up-to-date information. "
        "Summarize your findings clearly and concisely. "
        "Cite ALL sources with their URLs so the user can verify. "
        "Prefer academic papers, trusted publications, and official documentation. "
        "Structure your response with clear headings and bullet points when appropriate."
    )

    tried_keys = 0
    max_retries = 2

    while tried_keys < len(_api_keys):
        for attempt in range(max_retries + 1):
            try:
                _last_request_time = time.time()
                chat_completion = _client.chat.completions.create(
                    model=BROWSER_SEARCH_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_query},
                    ],
                    tools=[{"type": "browser_search"}],
                    temperature=0.3,
                    max_completion_tokens=2048,
                )

                # Debug: log full response structure
                message = chat_completion.choices[0].message
                print(f"  Response finish_reason: {chat_completion.choices[0].finish_reason}")
                print(f"  Message content type: {type(message.content)}, length: {len(message.content) if message.content else 0}")

                # Check for tool_calls — if model returned tool calls instead of content,
                # the executed_tools results may be in the response or we need to extract them
                if hasattr(message, 'tool_calls') and message.tool_calls:
                    print(f"  Tool calls found: {len(message.tool_calls)}")
                    for tc in message.tool_calls:
                        print(f"    Tool: {tc.function.name if hasattr(tc, 'function') else tc.type}")

                # Try to get content — for built-in tools, Groq executes server-side
                # and returns final content directly
                result = message.content

                # If content is None or empty, try to extract from executed_tools
                if not result:
                    # Log entire response for debugging
                    print(f"  [DEBUG] Full response object keys: {dir(chat_completion.choices[0])}")
                    print(f"  [DEBUG] Message keys: {dir(message)}")

                    # Some Groq responses include executed_tools with results
                    if hasattr(chat_completion, 'executed_tools') and chat_completion.executed_tools:
                        print(f"  Found executed_tools: {len(chat_completion.executed_tools)}")
                        parts = []
                        for et in chat_completion.executed_tools:
                            if hasattr(et, 'output'):
                                parts.append(str(et.output))
                        if parts:
                            result = "\n".join(parts)

                # If still empty, try dumping the raw response
                if not result:
                    try:
                        raw = chat_completion.model_dump()
                        print(f"  [DEBUG] Raw response dump: {json.dumps(raw, indent=2, default=str)[:2000]}")
                    except Exception as dump_err:
                        print(f"  [DEBUG] Could not dump response: {dump_err}")

                if not result:
                    result = "Browser search returned no content. The model may not have generated a response. Please try rephrasing your query."

                print(f"  Browser search completed — {len(result)} chars returned")
                return result
            except Exception as e:
                error_msg = str(e)
                is_rate_limit = "429" in error_msg or "rate" in error_msg.lower() or "quota" in error_msg.lower() or "limit" in error_msg.lower()
                if is_rate_limit and attempt < max_retries:
                    backoff = (attempt + 1) * 5
                    print(f"  429 rate limit — retrying in {backoff}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(backoff)
                    continue
                elif is_rate_limit:
                    tried_keys += 1
                    if _rotate_key():
                        break
                    raise QuotaExceededError(
                        "Rate limit exceeded. Please wait a minute before trying again."
                    )
                raise
        else:
            tried_keys += 1
            if not _rotate_key():
                raise QuotaExceededError(
                    "Rate limit exceeded. Please wait a minute before trying again."
                )

    raise QuotaExceededError(
        "All API keys exhausted. Please wait a minute or add more keys to GROQ_API_KEY in .env (comma-separated)."
    )


# Backward-compatible alias so callers don't need to change function names everywhere
get_gemini_response = get_groq_response
