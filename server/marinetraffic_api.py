import os
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS


MARINETRAFFIC_BASE_URL = "https://services.marinetraffic.com/api/exportvessels"

load_dotenv()

app = Flask(__name__)
CORS(app)


def _parse_float(value: Any, fallback: Any) -> Any:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _normalize_ship_type(raw_type: Any) -> str:
    ship_type = str(raw_type or "Other").strip()
    lowered = ship_type.lower()

    if "tanker" in lowered or lowered.startswith("8"):
        return "Tanker"
    if "cargo" in lowered or lowered.startswith("7"):
        return "Cargo"

    return ship_type if ship_type else "Other"


def _extract_value(vessel: Any, *keys: str) -> Any:
    if isinstance(vessel, dict):
        for key in keys:
            if key in vessel:
                return vessel[key]
            upper_key = key.upper()
            if upper_key in vessel:
                return vessel[upper_key]
            lower_key = key.lower()
            if lower_key in vessel:
                return vessel[lower_key]

    return None


def vessel_to_feature(vessel: Any) -> Optional[Dict[str, Any]]:
    latitude = _parse_float(_extract_value(vessel, "lat", "latitude"), None)
    longitude = _parse_float(_extract_value(vessel, "lon", "lng", "longitude"), None)

    if latitude is None or longitude is None:
        return None

    vessel_type = _normalize_ship_type(_extract_value(vessel, "shiptype", "type", "vessel_type"))

    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [longitude, latitude],
        },
        "properties": {
            "name": _extract_value(vessel, "shipname", "name", "vessel_name") or "Unknown vessel",
            "mmsi": _extract_value(vessel, "mmsi") or "",
            "imo": _extract_value(vessel, "imo") or "",
            "vesselType": vessel_type,
            "vesselTypeGroup": "Tanker" if vessel_type == "Tanker" else "Cargo" if vessel_type == "Cargo" else "Other",
            "timestamp": _extract_value(vessel, "timestamp", "lastpos", "time") or "",
        },
    }


def vessels_to_geojson(vessels: List[Any]) -> Dict[str, Any]:
    features = [feature for vessel in vessels if (feature := vessel_to_feature(vessel))]

    return {
        "type": "FeatureCollection",
        "features": features,
    }


def fetch_marinetraffic_vessels(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
) -> List[Any]:
    api_key = os.environ.get("MARINETRAFFIC_API_KEY")
    if not api_key:
        raise RuntimeError("Missing MARINETRAFFIC_API_KEY")

    url = (
        f"{MARINETRAFFIC_BASE_URL}/{api_key}"
        "/v:8/protocol:jsono/msgtype:extended/timespan:10"
        f"/minlat:{min_lat}/maxlat:{max_lat}/minlon:{min_lon}/maxlon:{max_lon}"
    )

    response = requests.get(url, timeout=15)
    response.raise_for_status()
    payload = response.json()

    if isinstance(payload, dict):
        return payload.get("DATA") or payload.get("data") or payload.get("vessels") or []

    return payload if isinstance(payload, list) else []


@app.get("/api/ships")
def get_ships():
    min_lat = _parse_float(request.args.get("minLat"), 25.0)
    max_lat = _parse_float(request.args.get("maxLat"), 50.0)
    min_lon = _parse_float(request.args.get("minLon"), -130.0)
    max_lon = _parse_float(request.args.get("maxLon"), -105.0)

    try:
        vessels = fetch_marinetraffic_vessels(min_lat, max_lat, min_lon, max_lon)
    except requests.HTTPError as error:
        return jsonify({"error": "MarineTraffic request failed", "details": str(error)}), 502
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 500

    return jsonify(vessels_to_geojson(vessels))


if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
