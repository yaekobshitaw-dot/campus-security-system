# src/api/app.py - Updated with CORS
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
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
    risk_scores = {
        'fire': 0.8,
        'security_threat': 0.9,
        'medical': 0.7,
        'suspicious_package': 0.6,
        'assault': 0.9,
        'theft': 0.5,
        'other': 0.3
    }
    base_risk = risk_scores.get(incident.type, 0.5)
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
async def detect_hotzones():
    hotzones = [
        {
            "location": "Science Block 3",
            "risk_score": 0.85,
            "incident_count": 12,
            "incident_types": ["fire", "security_threat", "theft"]
        },
        {
            "location": "Main Parking Lot",
            "risk_score": 0.75,
            "incident_count": 8,
            "incident_types": ["theft", "vandalism"]
        },
        {
            "location": "Library",
            "risk_score": 0.45,
            "incident_count": 5,
            "incident_types": ["medical", "security_threat"]
        }
    ]
    return {"hotzones": hotzones}

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
