from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class Stage5ParsedMessage(BaseModel):
    type: Literal["driver", "load", "unknown"] = "unknown"
    origin: Optional[str] = None
    destination: Optional[str] = None
    weight_tons: Optional[float] = Field(default=None, gt=0.0, le=50.0)
    message: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class ForceMatchRequest(BaseModel):
    load_id: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    pickup_lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    pickup_lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    weight_tons: float = Field(default=10.0, gt=0.0, le=50.0)

    @model_validator(mode="after")
    def validate_location(self) -> "ForceMatchRequest":
        has_coords = self.pickup_lat is not None and self.pickup_lng is not None
        has_origin = self.origin is not None and self.origin.strip() != ""
        if not has_coords and not has_origin:
            raise ValueError("Provide pickup_lat/pickup_lng or origin.")
        return self