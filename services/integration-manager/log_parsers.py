"""
SOAR Pro Integration Manager - Real Log Parsers
Parses real log formats (Syslog RFC 3164/5424, CEF, Windows EVTX XML)
into a unified alert schema.  NO mock / synthetic data generation.
"""

import re
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple

logger = logging.getLogger(__name__)

# ========================================
# Unified Alert Schema (output of all parsers)
# ========================================

def blank_unified_alert() -> Dict[str, Any]:
    """Return a blank unified alert dictionary."""
    return {
        "source": "",
        "source_type": "",
        "external_id": None,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "severity": "medium",
        "category": None,
        "alert_type": None,
        "title": "",
        "description": "",
        "affected_assets": [],
        "indicators": {"ips": [], "domains": [], "hashes": [], "urls": [], "emails": []},
        "raw_data": {},
    }


# ========================================
# IOC Extraction Helpers
# ========================================

_IP_RE = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
)
_DOMAIN_RE = re.compile(
    r"\b(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|gov|edu|mil|co|info|biz|xyz|top|ru|cn|tk|de|uk|fr)\b",
    re.IGNORECASE,
)
_HASH_MD5_RE = re.compile(r"\b[a-fA-F0-9]{32}\b")
_HASH_SHA256_RE = re.compile(r"\b[a-fA-F0-9]{64}\b")
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_URL_RE = re.compile(r"https?://[^\s<>\"'{}|\\^`\[\]]+")
_CVE_RE = re.compile(r"CVE-\d{4}-\d{4,7}", re.IGNORECASE)


def extract_iocs(text: str) -> Dict[str, List[str]]:
    """Extract all Indicators of Compromise from free text."""
    ips = list(set(_IP_RE.findall(text)))
    # Filter private / loopback
    public_ips = [
        ip for ip in ips
        if not ip.startswith(("10.", "127.", "0.", "169.254."))
        and not ip.startswith("192.168.")
        and not _is_private_172(ip)
    ]
    return {
        "ips": public_ips or ips,  # keep originals if no public
        "domains": list(set(_DOMAIN_RE.findall(text))),
        "hashes": list(set(_HASH_SHA256_RE.findall(text) + _HASH_MD5_RE.findall(text))),
        "urls": list(set(_URL_RE.findall(text))),
        "emails": list(set(_EMAIL_RE.findall(text))),
    }


def _is_private_172(ip: str) -> bool:
    parts = ip.split(".")
    if parts[0] != "172":
        return False
    second = int(parts[1])
    return 16 <= second <= 31


# ========================================
# Syslog RFC 3164 Parser
# ========================================

# PRI = facility * 8 + severity
_SYSLOG_SEVERITY_MAP = {
    0: "critical",   # Emergency
    1: "critical",   # Alert
    2: "critical",   # Critical
    3: "high",       # Error
    4: "medium",     # Warning
    5: "medium",     # Notice
    6: "low",        # Informational
    7: "low",        # Debug
}

_RFC3164_RE = re.compile(
    r"<(\d{1,3})>"                          # PRI
    r"(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+"  # Timestamp
    r"([\w.\-]+)\s+"                        # Hostname
    r"(\S+?)(?:\[(\d+)\])?:\s+"             # Process[PID]
    r"(.*)",                                # Message
    re.DOTALL,
)

_RFC5424_RE = re.compile(
    r"<(\d{1,3})>\d?\s*"                    # PRI + VERSION
    r"(\d{4}-\d{2}-\d{2}T[\d:.+\-Z]+)\s+"  # ISO timestamp
    r"([\w.\-]+)\s+"                        # Hostname
    r"([\w.\-]+)\s+"                        # App-Name
    r"([\w.\-]+)\s+"                        # ProcID
    r"([\w.\-]+)\s+"                        # MsgID
    r"(?:\[.*?\]\s*)?"                      # Structured-Data (optional)
    r"(.*)",                                # Message
    re.DOTALL,
)


def parse_syslog(raw: str) -> Optional[Dict[str, Any]]:
    """
    Parse a real syslog message (RFC 3164 or 5424) into unified alert schema.
    Returns None if the message cannot be parsed.
    """
    raw = raw.strip()
    if not raw:
        return None

    alert = blank_unified_alert()
    alert["raw_data"] = {"raw_syslog": raw}
    alert["source_type"] = "syslog"

    # Try RFC 5424 first (stricter format)
    m = _RFC5424_RE.match(raw)
    if m:
        pri, ts, host, app, procid, msgid, msg = m.groups()
        pri = int(pri)
        sev_code = pri & 0x07
        facility_code = pri >> 3

        alert["severity"] = _SYSLOG_SEVERITY_MAP.get(sev_code, "medium")
        alert["occurred_at"] = ts
        alert["source"] = f"{host}/{app}"
        alert["title"] = f"[{app}] {msg[:120]}"
        alert["description"] = msg
        alert["affected_assets"] = [{"type": "host", "identifier": host, "criticality": 5}]
        alert["indicators"] = extract_iocs(msg)
        alert["raw_data"]["facility"] = facility_code
        alert["raw_data"]["severity_code"] = sev_code
        alert["raw_data"]["process"] = app
        alert["raw_data"]["pid"] = procid
        return alert

    # Try RFC 3164
    m = _RFC3164_RE.match(raw)
    if m:
        pri, ts, host, proc, pid, msg = m.groups()
        pri = int(pri)
        sev_code = pri & 0x07
        facility_code = pri >> 3

        alert["severity"] = _SYSLOG_SEVERITY_MAP.get(sev_code, "medium")
        alert["source"] = f"{host}/{proc}"
        alert["title"] = f"[{proc}] {msg[:120]}"
        alert["description"] = msg
        alert["affected_assets"] = [{"type": "host", "identifier": host, "criticality": 5}]
        alert["indicators"] = extract_iocs(msg)
        alert["raw_data"]["facility"] = facility_code
        alert["raw_data"]["severity_code"] = sev_code
        alert["raw_data"]["process"] = proc
        alert["raw_data"]["pid"] = pid

        # Try to parse syslog timestamp
        try:
            year = datetime.now().year
            dt = datetime.strptime(f"{year} {ts}", "%Y %b %d %H:%M:%S")
            alert["occurred_at"] = dt.replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            pass

        return alert

    # Fallback: treat entire message as an alert
    alert["source"] = "syslog_raw"
    alert["title"] = raw[:200]
    alert["description"] = raw
    alert["indicators"] = extract_iocs(raw)
    return alert


# ========================================
# CEF (Common Event Format) Parser
# Vendor: ArcSight, Sophos, Palo Alto, Fortinet, etc.
# Format: CEF:Version|Device Vendor|Device Product|Device Version|Signature ID|Name|Severity|Extensions
# ========================================

_CEF_HEADER_RE = re.compile(
    r"CEF:(\d+)\|"
    r"([^|]*)\|"   # Vendor
    r"([^|]*)\|"   # Product
    r"([^|]*)\|"   # Version
    r"([^|]*)\|"   # Signature ID
    r"([^|]*)\|"   # Name
    r"([^|]*)\|"   # Severity
    r"(.*)",       # Extensions
    re.DOTALL,
)

_CEF_SEVERITY_MAP = {
    "0": "low", "1": "low", "2": "low", "3": "low",
    "4": "medium", "5": "medium", "6": "medium",
    "7": "high", "8": "high",
    "9": "critical", "10": "critical",
}


def parse_cef(raw: str) -> Optional[Dict[str, Any]]:
    """
    Parse a real CEF log entry from a firewall / SIEM / EDR.
    Returns None if the format is invalid.
    """
    raw = raw.strip()
    m = _CEF_HEADER_RE.match(raw)
    if not m:
        return None

    version, vendor, product, dev_ver, sig_id, name, sev, extensions = m.groups()

    # Parse key=value extensions
    ext = _parse_cef_extensions(extensions)

    alert = blank_unified_alert()
    alert["source"] = f"{vendor} {product}"
    alert["source_type"] = "cef"
    alert["external_id"] = sig_id
    alert["severity"] = _CEF_SEVERITY_MAP.get(sev.strip(), "medium")
    alert["title"] = name.strip()
    alert["category"] = ext.get("cat", ext.get("deviceEventCategory", None))
    alert["alert_type"] = sig_id

    # Build description
    desc_parts = [f"Vendor: {vendor}", f"Product: {product}", f"Signature: {sig_id} — {name}"]
    if ext.get("msg"):
        desc_parts.append(f"Message: {ext['msg']}")
    if ext.get("act"):
        desc_parts.append(f"Action: {ext['act']}")
    alert["description"] = " | ".join(desc_parts)

    # Extract affected assets
    assets = []
    if ext.get("dhost") or ext.get("dst"):
        assets.append({
            "type": "host",
            "identifier": ext.get("dhost", ext.get("dst", "")),
            "criticality": 5,
        })
    if ext.get("shost") or ext.get("src"):
        assets.append({
            "type": "host",
            "identifier": ext.get("shost", ext.get("src", "")),
            "criticality": 3,
        })
    if ext.get("duser"):
        assets.append({"type": "user", "identifier": ext["duser"], "criticality": 5})
    alert["affected_assets"] = assets

    # IOCs
    iocs = extract_iocs(raw)
    # Add explicit CEF fields
    for ip_field in ("src", "dst", "sourceAddress", "destinationAddress"):
        if ext.get(ip_field) and ext[ip_field] not in iocs["ips"]:
            iocs["ips"].append(ext[ip_field])
    if ext.get("requestUrl"):
        iocs["urls"].append(ext["requestUrl"])
    alert["indicators"] = iocs

    # Timestamp
    for ts_field in ("rt", "end", "start", "deviceReceiptTime"):
        if ext.get(ts_field):
            alert["occurred_at"] = _try_parse_timestamp(ext[ts_field])
            break

    alert["raw_data"] = {
        "cef_version": version,
        "vendor": vendor,
        "product": product,
        "device_version": dev_ver,
        "signature_id": sig_id,
        "extensions": ext,
    }

    return alert


def _parse_cef_extensions(ext_str: str) -> Dict[str, str]:
    """Parse CEF key=value extension string."""
    result = {}
    # CEF extensions: key=value pairs separated by spaces
    # Values may contain spaces if they are the last value before next key=
    pattern = re.compile(r"(\w+)=((?:(?!\w+=).)*)", re.DOTALL)
    for match in pattern.finditer(ext_str):
        key, value = match.groups()
        result[key.strip()] = value.strip()
    return result


# ========================================
# Windows Event Log (EVTX XML) Parser
# ========================================

_SECURITY_EVENT_MAP = {
    "4625": {"title": "Failed Logon Attempt", "severity": "medium", "category": "Credential Access", "type": "brute_force"},
    "4624": {"title": "Successful Logon", "severity": "low", "category": "Initial Access", "type": "logon"},
    "4648": {"title": "Logon with Explicit Credentials", "severity": "medium", "category": "Credential Access", "type": "credential_use"},
    "4720": {"title": "User Account Created", "severity": "medium", "category": "Persistence", "type": "account_creation"},
    "4726": {"title": "User Account Deleted", "severity": "medium", "category": "Defense Evasion", "type": "account_deletion"},
    "4732": {"title": "Member Added to Security Group", "severity": "high", "category": "Privilege Escalation", "type": "group_modification"},
    "4688": {"title": "New Process Created", "severity": "low", "category": "Execution", "type": "process_creation"},
    "4697": {"title": "Service Installed", "severity": "high", "category": "Persistence", "type": "service_install"},
    "4657": {"title": "Registry Value Modified", "severity": "medium", "category": "Defense Evasion", "type": "registry_modification"},
    "1102": {"title": "Audit Log Cleared", "severity": "critical", "category": "Defense Evasion", "type": "log_tampering"},
    "4672": {"title": "Special Privileges Assigned to Logon", "severity": "medium", "category": "Privilege Escalation", "type": "privilege_use"},
    "4768": {"title": "Kerberos TGT Requested", "severity": "low", "category": "Credential Access", "type": "kerberos"},
    "4769": {"title": "Kerberos Service Ticket Requested", "severity": "low", "category": "Credential Access", "type": "kerberos"},
    "4771": {"title": "Kerberos Pre-Authentication Failed", "severity": "medium", "category": "Credential Access", "type": "kerberos_failure"},
    "5156": {"title": "Windows Filtering Platform Connection", "severity": "low", "category": "Network Activity", "type": "network"},
    "5157": {"title": "Windows Filtering Platform Blocked Connection", "severity": "medium", "category": "Network Activity", "type": "network_block"},
    "7045": {"title": "New Service Installed", "severity": "high", "category": "Persistence", "type": "service_install"},
}


def parse_evtx_xml(raw_xml: str) -> Optional[Dict[str, Any]]:
    """
    Parse a real Windows Event Log XML entry.
    Handles the standard EVTX XML schema from Windows Security / System / Application logs.
    """
    import xml.etree.ElementTree as ET

    raw_xml = raw_xml.strip()
    if not raw_xml:
        return None

    try:
        # Handle namespace
        raw_clean = re.sub(r'\sxmlns="[^"]*"', '', raw_xml, count=1)
        root = ET.fromstring(raw_clean)
    except ET.ParseError:
        logger.warning("Failed to parse EVTX XML")
        return None

    # Extract System fields
    system = root.find("System") or root.find(".//System")
    if system is None:
        return None

    event_id_el = system.find("EventID")
    event_id = event_id_el.text if event_id_el is not None else "0"

    computer_el = system.find("Computer")
    computer = computer_el.text if computer_el is not None else "unknown"

    time_el = system.find("TimeCreated")
    timestamp = time_el.get("SystemTime", "") if time_el is not None else ""

    provider_el = system.find("Provider")
    provider = provider_el.get("Name", "Windows") if provider_el is not None else "Windows"

    # Extract EventData fields
    event_data = {}
    ed = root.find("EventData") or root.find(".//EventData")
    if ed is not None:
        for data_el in ed.findall("Data"):
            name = data_el.get("Name", "")
            value = data_el.text or ""
            if name:
                event_data[name] = value

    # Map to unified alert
    event_meta = _SECURITY_EVENT_MAP.get(event_id, {
        "title": f"Windows Event {event_id}",
        "severity": "low",
        "category": "Unknown",
        "type": "windows_event",
    })

    alert = blank_unified_alert()
    alert["source"] = f"Windows/{provider}"
    alert["source_type"] = "evtx"
    alert["external_id"] = f"WinEvent-{event_id}"
    alert["severity"] = event_meta["severity"]
    alert["category"] = event_meta["category"]
    alert["alert_type"] = event_meta["type"]
    alert["occurred_at"] = timestamp or datetime.now(timezone.utc).isoformat()

    # Build title with context
    user = event_data.get("TargetUserName", event_data.get("SubjectUserName", ""))
    ip = event_data.get("IpAddress", event_data.get("SourceAddress", ""))
    title = event_meta["title"]
    if user:
        title += f" — User: {user}"
    if ip and ip != "-":
        title += f" — IP: {ip}"
    alert["title"] = title

    # Description
    desc_parts = [f"Event ID: {event_id}", f"Computer: {computer}", f"Provider: {provider}"]
    for k, v in event_data.items():
        if v and v != "-":
            desc_parts.append(f"{k}: {v}")
    alert["description"] = " | ".join(desc_parts)

    # Affected assets
    assets = [{"type": "host", "identifier": computer, "criticality": 5}]
    if user:
        assets.append({"type": "user", "identifier": user, "criticality": 5})
    alert["affected_assets"] = assets

    # IOCs
    iocs = extract_iocs(raw_xml)
    if ip and ip != "-" and ip not in iocs["ips"]:
        iocs["ips"].append(ip)
    alert["indicators"] = iocs

    alert["raw_data"] = {
        "event_id": event_id,
        "computer": computer,
        "provider": provider,
        "event_data": event_data,
        "raw_xml": raw_xml,
    }

    return alert


# ========================================
# Generic JSON Alert Parser
# ========================================

def parse_json_alert(raw_json: dict, source_name: str = "generic") -> Dict[str, Any]:
    """
    Normalize an arbitrary JSON alert payload into unified schema.
    Applies field-mapping heuristics for common SIEM/EDR outputs.
    """
    alert = blank_unified_alert()
    alert["source"] = source_name
    alert["source_type"] = "json"

    # Map common field names to unified schema
    _field_map = {
        "severity": ["severity", "risk_level", "priority", "level", "alert_severity", "criticality"],
        "title": ["title", "name", "alert_name", "summary", "subject", "event_name", "rule_name"],
        "description": ["description", "message", "details", "body", "event_description", "msg"],
        "occurred_at": ["timestamp", "occurred_at", "event_time", "created_at", "time", "date", "@timestamp"],
        "category": ["category", "type", "event_type", "classification", "tactic", "attack_type"],
        "external_id": ["id", "alert_id", "event_id", "external_id", "rule_id", "signature_id"],
    }

    for unified_field, candidates in _field_map.items():
        for candidate in candidates:
            value = raw_json.get(candidate)
            if value:
                alert[unified_field] = str(value) if unified_field != "occurred_at" else value
                break

    # Normalize severity string
    sev = str(alert.get("severity", "medium")).lower()
    sev_map = {
        "info": "low", "informational": "low", "1": "low", "debug": "low",
        "warning": "medium", "warn": "medium", "moderate": "medium", "2": "medium", "3": "medium",
        "error": "high", "major": "high", "4": "high",
        "emergency": "critical", "fatal": "critical", "5": "critical",
    }
    alert["severity"] = sev_map.get(sev, sev) if sev not in ("low", "medium", "high", "critical") else sev

    # Extract IOCs from entire JSON
    alert["indicators"] = extract_iocs(json.dumps(raw_json))

    # Extract source IPs and hostnames from common fields
    for ip_field in ("src_ip", "source_ip", "src", "attacker_ip", "remote_ip", "client_ip"):
        if raw_json.get(ip_field):
            if raw_json[ip_field] not in alert["indicators"]["ips"]:
                alert["indicators"]["ips"].append(raw_json[ip_field])

    # Affected assets from common fields
    assets = []
    for host_field in ("hostname", "host", "computer", "device_name", "endpoint", "dest_host", "dhost"):
        if raw_json.get(host_field):
            assets.append({"type": "host", "identifier": raw_json[host_field], "criticality": 5})
    for user_field in ("username", "user", "target_user", "duser", "account_name"):
        if raw_json.get(user_field):
            assets.append({"type": "user", "identifier": raw_json[user_field], "criticality": 5})
    alert["affected_assets"] = assets

    alert["raw_data"] = raw_json
    return alert


# ========================================
# Timestamp Helpers
# ========================================

def _try_parse_timestamp(ts_str: str) -> str:
    """Try to parse various timestamp formats, return ISO 8601."""
    formats = [
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%b %d %Y %H:%M:%S",
        "%b %d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%d/%b/%Y:%H:%M:%S %z",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(ts_str.strip(), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            continue

    # Try epoch seconds / milliseconds
    try:
        val = float(ts_str)
        if val > 1e12:  # milliseconds
            val /= 1000
        dt = datetime.fromtimestamp(val, tz=timezone.utc)
        return dt.isoformat()
    except (ValueError, OSError):
        pass

    return ts_str  # Return as-is if unparseable


# ========================================
# Auto-detect and parse
# ========================================

def auto_parse(raw: str, format_hint: str = "auto") -> Optional[Dict[str, Any]]:
    """
    Auto-detect log format and parse.
    format_hint: 'syslog_rfc3164', 'syslog_rfc5424', 'cef', 'evtx_xml', 'json', 'auto'
    """
    if format_hint == "cef" or (format_hint == "auto" and raw.strip().startswith("CEF:")):
        return parse_cef(raw)

    if format_hint in ("evtx_xml",) or (format_hint == "auto" and raw.strip().startswith("<Event")):
        return parse_evtx_xml(raw)

    if format_hint in ("syslog_rfc3164", "syslog_rfc5424", "syslog"):
        return parse_syslog(raw)

    if format_hint == "auto" and raw.strip().startswith("<"):
        # Syslog PRI prefix
        return parse_syslog(raw)

    if format_hint == "json" or (format_hint == "auto" and raw.strip().startswith("{")):
        try:
            data = json.loads(raw)
            return parse_json_alert(data)
        except json.JSONDecodeError:
            pass

    # Default: try syslog
    return parse_syslog(raw)
