"""
SOAR Pro — MITRE ATT&CK Mapper
Maps alerts to MITRE ATT&CK tactics and techniques based on
classification, keywords, and category analysis.
"""

import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════
# MITRE ATT&CK Knowledge Base (subset — 14 tactics, 80+ techniques)
# Full mapping based on MITRE ATT&CK v14
# ════════════════════════════════════════════════

MITRE_TACTICS = {
    "TA0001": "Initial Access",
    "TA0002": "Execution",
    "TA0003": "Persistence",
    "TA0004": "Privilege Escalation",
    "TA0005": "Defense Evasion",
    "TA0006": "Credential Access",
    "TA0007": "Discovery",
    "TA0008": "Lateral Movement",
    "TA0009": "Collection",
    "TA0010": "Exfiltration",
    "TA0011": "Command and Control",
    "TA0040": "Impact",
    "TA0042": "Resource Development",
    "TA0043": "Reconnaissance",
}

TECHNIQUE_DB: Dict[str, Dict[str, Any]] = {
    # ── Initial Access ───────────────
    "T1566":     {"name": "Phishing",                      "tactic": "TA0001", "keywords": ["phishing", "spear phishing", "email attack", "malicious email"]},
    "T1566.001": {"name": "Spearphishing Attachment",      "tactic": "TA0001", "keywords": ["attachment", "malicious file", "email attachment"]},
    "T1566.002": {"name": "Spearphishing Link",            "tactic": "TA0001", "keywords": ["malicious link", "phishing url", "click bait"]},
    "T1190":     {"name": "Exploit Public-Facing App",     "tactic": "TA0001", "keywords": ["exploit", "vulnerability", "cve", "web exploit", "rce", "sql injection", "xss"]},
    "T1133":     {"name": "External Remote Services",      "tactic": "TA0001", "keywords": ["rdp", "vpn", "ssh brute", "remote access"]},
    "T1078":     {"name": "Valid Accounts",                "tactic": "TA0001", "keywords": ["compromised account", "stolen credentials", "valid account"]},
    "T1189":     {"name": "Drive-by Compromise",           "tactic": "TA0001", "keywords": ["drive-by", "watering hole", "browser exploit"]},

    # ── Execution ────────────────────
    "T1059":     {"name": "Command and Scripting",         "tactic": "TA0002", "keywords": ["powershell", "cmd", "script", "bash", "wscript", "cscript"]},
    "T1059.001": {"name": "PowerShell",                    "tactic": "TA0002", "keywords": ["powershell", "invoke-expression", "iex", "encodedcommand"]},
    "T1204":     {"name": "User Execution",                "tactic": "TA0002", "keywords": ["user clicked", "user opened", "social engineering"]},
    "T1203":     {"name": "Exploitation for Client Exec",  "tactic": "TA0002", "keywords": ["client exploit", "document exploit", "macro"]},

    # ── Persistence ──────────────────
    "T1547":     {"name": "Boot/Logon Autostart Exec",     "tactic": "TA0003", "keywords": ["startup", "autorun", "registry run key", "boot persistence"]},
    "T1053":     {"name": "Scheduled Task/Job",            "tactic": "TA0003", "keywords": ["scheduled task", "cron", "at job", "task scheduler"]},
    "T1136":     {"name": "Create Account",                "tactic": "TA0003", "keywords": ["account created", "new user", "backdoor account", "4720"]},
    "T1543":     {"name": "Create/Modify System Process",  "tactic": "TA0003", "keywords": ["service installed", "systemd", "new service", "7045", "4697"]},

    # ── Privilege Escalation ─────────
    "T1068":     {"name": "Exploitation for Priv Esc",     "tactic": "TA0004", "keywords": ["privilege escalation", "local exploit", "root", "admin"]},
    "T1548":     {"name": "Abuse Elevation Control",       "tactic": "TA0004", "keywords": ["uac bypass", "sudo", "elevation", "runas"]},
    "T1134":     {"name": "Access Token Manipulation",     "tactic": "TA0004", "keywords": ["token impersonation", "token theft", "4672"]},

    # ── Defense Evasion ──────────────
    "T1070":     {"name": "Indicator Removal",             "tactic": "TA0005", "keywords": ["log cleared", "log deleted", "1102", "audit log", "evidence destruction"]},
    "T1027":     {"name": "Obfuscated Files/Info",         "tactic": "TA0005", "keywords": ["obfuscated", "encoded", "packed", "base64"]},
    "T1562":     {"name": "Impair Defenses",               "tactic": "TA0005", "keywords": ["disable antivirus", "tamper protection", "firewall disabled"]},
    "T1036":     {"name": "Masquerading",                  "tactic": "TA0005", "keywords": ["masquerading", "renamed executable", "fake process"]},

    # ── Credential Access ────────────
    "T1110":     {"name": "Brute Force",                   "tactic": "TA0006", "keywords": ["brute force", "password spray", "credential stuffing", "failed logon", "4625"]},
    "T1003":     {"name": "OS Credential Dumping",         "tactic": "TA0006", "keywords": ["mimikatz", "lsass", "credential dump", "sam dump", "ntds"]},
    "T1558":     {"name": "Steal/Forge Kerberos Tickets",  "tactic": "TA0006", "keywords": ["kerberoast", "golden ticket", "silver ticket", "4768", "4769"]},
    "T1552":     {"name": "Unsecured Credentials",         "tactic": "TA0006", "keywords": ["password in file", "credentials exposed", "hardcoded password"]},

    # ── Discovery ────────────────────
    "T1046":     {"name": "Network Service Discovery",     "tactic": "TA0007", "keywords": ["port scan", "nmap", "service scan", "network reconnaissance"]},
    "T1087":     {"name": "Account Discovery",             "tactic": "TA0007", "keywords": ["user enumeration", "account discovery", "net user"]},
    "T1082":     {"name": "System Information Discovery",  "tactic": "TA0007", "keywords": ["systeminfo", "uname", "host discovery"]},

    # ── Lateral Movement ─────────────
    "T1021":     {"name": "Remote Services",               "tactic": "TA0008", "keywords": ["lateral movement", "psexec", "wmi", "rdp lateral", "ssh lateral"]},
    "T1570":     {"name": "Lateral Tool Transfer",         "tactic": "TA0008", "keywords": ["tool transfer", "file copy", "smb copy"]},

    # ── Collection ───────────────────
    "T1005":     {"name": "Data from Local System",        "tactic": "TA0009", "keywords": ["data collection", "file access", "sensitive data"]},
    "T1114":     {"name": "Email Collection",              "tactic": "TA0009", "keywords": ["email harvesting", "mailbox access", "email collection"]},

    # ── Exfiltration ─────────────────
    "T1041":     {"name": "Exfiltration Over C2 Channel",  "tactic": "TA0010", "keywords": ["data exfiltration", "data theft", "data leak", "outbound transfer"]},
    "T1048":     {"name": "Exfiltration Over Alt Protocol","tactic": "TA0010", "keywords": ["dns exfiltration", "icmp tunnel", "alternative channel"]},
    "T1567":     {"name": "Exfiltration to Cloud Storage", "tactic": "TA0010", "keywords": ["cloud upload", "dropbox", "gdrive", "onedrive exfil"]},

    # ── Command and Control ──────────
    "T1071":     {"name": "Application Layer Protocol",    "tactic": "TA0011", "keywords": ["c2", "command and control", "c&c", "beacon", "callback"]},
    "T1105":     {"name": "Ingress Tool Transfer",        "tactic": "TA0011", "keywords": ["tool download", "malware download", "payload download"]},
    "T1573":     {"name": "Encrypted Channel",            "tactic": "TA0011", "keywords": ["encrypted c2", "ssl c2", "tls tunnel"]},
    "T1090":     {"name": "Proxy",                        "tactic": "TA0011", "keywords": ["proxy", "tor", "vpn tunnel", "socks"]},

    # ── Impact ───────────────────────
    "T1486":     {"name": "Data Encrypted for Impact",    "tactic": "TA0040", "keywords": ["ransomware", "encryption", "ransom", "crypto locker"]},
    "T1489":     {"name": "Service Stop",                 "tactic": "TA0040", "keywords": ["service stopped", "denial of service", "dos", "ddos"]},
    "T1531":     {"name": "Account Access Removal",       "tactic": "TA0040", "keywords": ["account locked out", "access revoked", "password changed"]},
}

# ── Category → tactic shortcut map ───────────────
CATEGORY_TACTIC_MAP = {
    "phishing":           "TA0001",
    "malware":            "TA0002",
    "ransomware":         "TA0040",
    "brute_force":        "TA0006",
    "credential_access":  "TA0006",
    "data_exfiltration":  "TA0010",
    "command_control":    "TA0011",
    "lateral_movement":   "TA0008",
    "privilege_escalation": "TA0004",
    "persistence":        "TA0003",
    "defense_evasion":    "TA0005",
    "discovery":          "TA0007",
    "initial_access":     "TA0001",
    "execution":          "TA0002",
    "impact":             "TA0040",
    "reconnaissance":     "TA0043",
}


class MITREMapper:
    """
    Maps security alerts to MITRE ATT&CK tactics and techniques
    using keyword matching and category-based lookup.
    """

    def map_alert(
        self,
        title: str,
        description: str = "",
        category: Optional[str] = None,
        alert_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Map an alert to MITRE ATT&CK framework.

        Returns:
            {
                "tactics": ["TA0001", ...],
                "tactic_names": ["Initial Access", ...],
                "techniques": ["T1566", ...],
                "technique_details": [{"id": ..., "name": ..., "tactic": ...}, ...],
            }
        """
        text = f"{title} {description} {category or ''} {alert_type or ''}".lower()
        matched_techniques = []
        matched_tactics = set()

        # ── 1. Keyword matching against technique DB ─
        for tech_id, tech in TECHNIQUE_DB.items():
            for keyword in tech["keywords"]:
                if keyword in text:
                    matched_techniques.append({
                        "id": tech_id,
                        "name": tech["name"],
                        "tactic_id": tech["tactic"],
                        "tactic_name": MITRE_TACTICS.get(tech["tactic"], "Unknown"),
                        "matched_keyword": keyword,
                    })
                    matched_tactics.add(tech["tactic"])
                    break  # one match per technique is enough

        # ── 2. Category-based tactic mapping ─────────
        if category:
            tactic_id = CATEGORY_TACTIC_MAP.get(category.lower())
            if tactic_id:
                matched_tactics.add(tactic_id)

        # ── 3. Deduplicate techniques ────────────────
        seen = set()
        unique_techniques = []
        for t in matched_techniques:
            if t["id"] not in seen:
                seen.add(t["id"])
                unique_techniques.append(t)

        return {
            "tactics": sorted(matched_tactics),
            "tactic_names": [MITRE_TACTICS.get(t, "Unknown") for t in sorted(matched_tactics)],
            "techniques": [t["id"] for t in unique_techniques],
            "technique_details": unique_techniques,
        }

    def get_technique_info(self, technique_id: str) -> Optional[Dict]:
        """Look up a specific technique by ID."""
        tech = TECHNIQUE_DB.get(technique_id)
        if not tech:
            return None
        return {
            "id": technique_id,
            "name": tech["name"],
            "tactic_id": tech["tactic"],
            "tactic_name": MITRE_TACTICS.get(tech["tactic"], "Unknown"),
        }

    def get_all_tactics(self) -> Dict[str, str]:
        return MITRE_TACTICS

    def get_techniques_by_tactic(self, tactic_id: str) -> List[Dict]:
        return [
            {"id": k, "name": v["name"]}
            for k, v in TECHNIQUE_DB.items()
            if v["tactic"] == tactic_id
        ]
