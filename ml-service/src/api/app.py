# src/api/app.py - Updated with CORS
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
import random
import uvicorn

app = FastAPI(title="Campus Security ML Service")

# ✅ Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (for development)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IncidentData(BaseModel):
    type: str
    description: Optional[str] = ""
    severity: Optional[str] = "medium"
    location: Optional[str] = ""
    building: Optional[str] = ""
    room: Optional[str] = ""

class HotzoneData(BaseModel):
    campus_locations: List[Dict[str, Any]] = Field(default_factory=list)
    incidents: List[Dict[str, Any]] = Field(default_factory=list)

RISK_SCORES = {
    'fire': 0.8,
    'security_threat': 0.9,
    'medical': 0.7,
    'suspicious_package': 0.6,
    'assault': 0.9,
    'theft': 0.5,
    'other': 0.3
}

def calculate_hotzones(campus_locations, incidents):
    hotzones = []
    for location in campus_locations:
        name = str(location.get('name') or '').strip()
        location_id = location.get('location_id')
        if not name or not location_id or location.get('is_active') is False:
            continue

        normalized_name = name.casefold()
        matching_incidents = [
            incident for incident in incidents
            if (
                location_id is not None
                and incident.get('campus_location_id') is not None
                and str(incident.get('campus_location_id')) == str(location_id)
            ) or any(
                str(incident.get(field) or '').strip().casefold() == normalized_name
                for field in ('location_name', 'building')
            )
        ]
        if not matching_incidents:
            continue

        scores = [RISK_SCORES.get(str(incident.get('type') or ''), 0.5) for incident in matching_incidents]
        hotzones.append({
            'location_id': location_id,
            'location': name,
            'risk_score': round(sum(scores) / len(scores), 2),
            'incident_count': len(matching_incidents),
            'incident_types': sorted({
                str(incident['type'])
                for incident in matching_incidents
                if incident.get('type')
            })
        })
    return hotzones

@app.get("/")
async def root():
    return {
        "message": "Campus Security ML Service",
        "status": "running"
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ml"}

@app.post("/predict/risk")
async def predict_risk(incident: IncidentData):
    base_risk = RISK_SCORES.get(incident.type, 0.5)
    confidence = round(random.uniform(0.6, 0.9), 2)
    
    if base_risk >= 0.8:
        risk_level = "critical"
        action = "Immediate emergency response"
        response_time = 2
    elif base_risk >= 0.6:
        risk_level = "high"
        action = "Dispatch security team"
        response_time = 5
    elif base_risk >= 0.4:
        risk_level = "medium"
        action = "Assign patrol to investigate"
        response_time = 10
    else:
        risk_level = "low"
        action = "Monitor and document"
        response_time = 15
    
    return {
        "risk_level": risk_level,
        "confidence": confidence,
        "suggested_action": action,
        "estimated_response_time": response_time,
        "incident_type": incident.type
    }

@app.post("/detect/hotzones")
async def detect_hotzones(data: HotzoneData):
    return {
        "hotzones": calculate_hotzones(data.campus_locations, data.incidents)
    }

@app.post("/classify/incident")
async def classify_incident(incident: IncidentData):
    keywords = {
        'critical': ['gun', 'shooting', 'fire', 'explosion', 'attack', 'bleeding', 'unconscious'],
        'high': ['fight', 'assault', 'threat', 'robbery', 'flood', 'storm'],
        'medium': ['injury', 'suspicious', 'lost', 'damage'],
        'low': ['noise', 'disturbance', 'concern']
    }
    
    text = incident.description.lower() if incident.description else ""
    severity = "low"
    
    for level, words in keywords.items():
        for word in words:
            if word in text:
                severity = level
                break
        if severity != "low":
            break
    
    confidence = round(random.uniform(0.6, 0.9), 2)
    
    return {
        "severity": severity,
        "confidence": confidence,
        "priority_score": round(confidence * random.uniform(1, 5), 2)
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5001)
