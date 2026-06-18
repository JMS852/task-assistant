import time
import os
import json
import hmac
import hashlib
import datetime as dt
from .base import AIProvider, AIResponse

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


class HunyuanProvider(AIProvider):
    name = 'hunyuan'

    def __init__(self):
        self.secret_id = os.environ.get('HUNYUAN_SECRET_ID', '')
        self.secret_key = os.environ.get('HUNYUAN_SECRET_KEY', '')
        self.endpoint = 'hunyuan.tencentcloudapi.com'

    def _sign(self, params: dict) -> dict:
        algorithm = 'TC3-HMAC-SHA256'
        timestamp = int(time.time())
        date = dt.datetime.utcfromtimestamp(timestamp).strftime('%Y-%m-%d')
        service = 'hunyuan'

        payload = json.dumps(params)
        canonical_headers = f'content-type:application/json\nhost:{self.endpoint}\n'
        signed_headers = 'content-type;host'
        hashed_payload = hashlib.sha256(payload.encode('utf-8')).hexdigest()
        canonical_request = f'POST\n/\n\n{canonical_headers}\n{signed_headers}\n{hashed_payload}'
        credential_scope = f'{date}/{service}/tc3_request'
        string_to_sign = f'{algorithm}\n{timestamp}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()}'

        def _sign_str(key: bytes, msg: str) -> bytes:
            return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()

        secret_date = _sign_str(('TC3' + self.secret_key).encode('utf-8'), date)
        secret_service = _sign_str(secret_date, service)
        secret_signing = _sign_str(secret_service, 'tc3_request')
        signature = hmac.new(secret_signing, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()

        authorization = f'{algorithm} Credential={self.secret_id}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}'
        return {
            'Authorization': authorization,
            'Content-Type': 'application/json',
            'Host': self.endpoint,
            'X-TC-Action': 'ChatCompletions',
            'X-TC-Timestamp': str(timestamp),
            'X-TC-Version': '2023-09-01',
        }

    def chat(self, prompt: str, temperature: float = 0.3) -> AIResponse:
        if not HAS_HTTPX:
            raise RuntimeError('httpx not installed')

        params = {
            'Model': 'hunyuan-lite',
            'Messages': [{'Role': 'user', 'Content': prompt}],
            'Temperature': temperature,
        }
        headers = self._sign(params)

        start = time.time()
        with httpx.Client(timeout=60) as client:
            resp = client.post(f'https://{self.endpoint}', headers=headers, json=params)
        elapsed = (time.time() - start) * 1000
        data = resp.json()

        if 'Response' in data and 'Choices' in data['Response']:
            content = data['Response']['Choices'][0]['Message']['Content']
        else:
            content = json.dumps(data)

        return AIResponse(
            content=content,
            model='hunyuan-lite',
            tokens_used=0,
            duration_ms=elapsed,
        )

    def is_available(self) -> bool:
        return bool(self.secret_id) and bool(self.secret_key) and HAS_HTTPX
