from pydantic import BaseModel, Field
from typing import List, Dict, Any


# 📊 OBSERVATION MODEL (STATE)
class Observation(BaseModel):
    threats: List[Dict[str, Any]] = Field(default_factory=list)
    visible_threats: List[Dict[str, Any]] = Field(default_factory=list)
    resources: Dict[str, Any] = Field(default_factory=dict)
    time: int = 0
    damage: int = 0

    class Config:
        extra = "allow"   # ✅ prevents crashes if extra fields appear


# 🎯 ACTION MODEL (API + OpenEnv SAFE)
class Action(BaseModel):
    actions: List[str] = Field(default_factory=list)

    class Config:
        extra = "ignore"  # ✅ ignore unexpected fields safely


# 💰 REWARD MODEL (STRICT NORMALIZATION)
class Reward(BaseModel):
    value: float = Field(..., ge=0.0, le=1.0)  # ✅ enforce 0–1 range

    class Config:
        extra = "ignore"