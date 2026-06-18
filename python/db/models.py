from dataclasses import dataclass
from typing import Optional


@dataclass
class Task:
    id: str
    title: str
    description: str
    priority: str
    deadline: Optional[str]
    source: str
    sender: str
    group_name: Optional[str]
    source_message_id: Optional[str]
    status: str
    confidence: float
    context_missing: bool
    sort_order: Optional[float]
    created_at: str
    updated_at: str


@dataclass
class RawMessage:
    id: str
    source: str
    sender: str
    group_name: Optional[str]
    content: str
    context_json: Optional[str]
    captured_at: str
    processed: bool
