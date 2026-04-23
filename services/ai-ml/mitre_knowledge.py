"""
SOAR Pro — MITRE ATT&CK Knowledge Base for AI Explanations
Provides human-readable descriptions of ATT&CK techniques
used by the analyzer and report generator.
"""

TECHNIQUE_EXPLANATIONS = {
    # Initial Access
    "T1566":     {"name": "Phishing", "description": "Adversary sends fraudulent messages to gain access. Common vector: email with malicious attachment or link."},
    "T1566.001": {"name": "Spearphishing Attachment", "description": "Targeted email with malicious file attachment designed to exploit the victim's trust."},
    "T1566.002": {"name": "Spearphishing Link", "description": "Targeted email with a malicious URL leading to credential harvesting or malware download."},
    "T1190":     {"name": "Exploit Public-Facing App", "description": "Exploitation of a vulnerability in an internet-facing application (e.g., SQL injection, RCE)."},
    "T1133":     {"name": "External Remote Services", "description": "Abuse of remote access services (RDP, VPN, SSH) to gain initial access."},
    "T1078":     {"name": "Valid Accounts", "description": "Use of stolen or compromised credentials to access systems."},
    "T1189":     {"name": "Drive-by Compromise", "description": "User visits a compromised website that exploits the browser to deliver malware."},

    # Execution
    "T1059":     {"name": "Command and Scripting", "description": "Use of command-line interpreters or scripting languages to execute malicious code."},
    "T1059.001": {"name": "PowerShell", "description": "Abuse of PowerShell for execution, often with encoded commands to evade detection."},
    "T1204":     {"name": "User Execution", "description": "Adversary relies on user action (clicking, opening) to execute malicious content."},
    "T1203":     {"name": "Exploitation for Client Exec", "description": "Exploitation of software vulnerabilities in client applications (browsers, Office)."},

    # Persistence
    "T1547":     {"name": "Boot/Logon Autostart", "description": "Modification of startup entries (registry, startup folder) to maintain persistence."},
    "T1053":     {"name": "Scheduled Task/Job", "description": "Creation of scheduled tasks or cron jobs to maintain persistence."},
    "T1136":     {"name": "Create Account", "description": "Creation of new accounts (local or domain) as a backdoor for persistent access."},
    "T1543":     {"name": "Create/Modify System Process", "description": "Installation of a malicious service or modification of an existing one."},

    # Privilege Escalation
    "T1068":     {"name": "Exploitation for Priv Esc", "description": "Exploitation of a vulnerability to gain elevated privileges on the system."},
    "T1548":     {"name": "Abuse Elevation Control", "description": "Bypass of UAC or sudo mechanisms to execute code with elevated privileges."},
    "T1134":     {"name": "Access Token Manipulation", "description": "Manipulation of access tokens to impersonate other users or elevate privileges."},

    # Defense Evasion
    "T1070":     {"name": "Indicator Removal", "description": "Deletion or modification of logs, timestamps, or artifacts to cover tracks."},
    "T1027":     {"name": "Obfuscated Files/Info", "description": "Use of encoding, encryption, or packing to hide malicious content from detection."},
    "T1562":     {"name": "Impair Defenses", "description": "Disabling or modifying security tools (AV, EDR, firewall) to avoid detection."},
    "T1036":     {"name": "Masquerading", "description": "Renaming files or processes to appear legitimate and evade detection."},

    # Credential Access
    "T1110":     {"name": "Brute Force", "description": "Systematic attempt of passwords to gain unauthorized access. Includes password spraying and credential stuffing."},
    "T1003":     {"name": "OS Credential Dumping", "description": "Extraction of credentials from OS memory (LSASS), SAM database, or NTDS.dit."},
    "T1558":     {"name": "Kerberos Ticket Theft", "description": "Theft or forgery of Kerberos tickets (Golden/Silver Ticket, Kerberoasting)."},
    "T1552":     {"name": "Unsecured Credentials", "description": "Discovery of credentials stored insecurely in files, registries, or environment variables."},

    # Discovery
    "T1046":     {"name": "Network Service Discovery", "description": "Port scanning and service enumeration to map the network topology."},
    "T1087":     {"name": "Account Discovery", "description": "Enumeration of user and service accounts to identify potential targets."},

    # Lateral Movement
    "T1021":     {"name": "Remote Services", "description": "Use of remote services (SMB, RDP, SSH, WinRM) to move between systems."},
    "T1570":     {"name": "Lateral Tool Transfer", "description": "Transfer of tools and malware between systems within the compromised network."},

    # Exfiltration
    "T1041":     {"name": "Exfiltration Over C2", "description": "Theft of data by sending it over the existing command and control channel."},
    "T1048":     {"name": "Exfiltration Over Alt Protocol", "description": "Use of alternative protocols (DNS, ICMP) to exfiltrate data covertly."},
    "T1567":     {"name": "Exfiltration to Cloud", "description": "Upload of stolen data to cloud storage services (Dropbox, Google Drive)."},

    # Command and Control
    "T1071":     {"name": "Application Layer Protocol", "description": "Use of standard application protocols (HTTP, HTTPS, DNS) for C2 communication."},
    "T1105":     {"name": "Ingress Tool Transfer", "description": "Download of additional tools and malware after initial compromise."},
    "T1573":     {"name": "Encrypted Channel", "description": "Use of encryption for C2 channels to evade network monitoring."},

    # Impact
    "T1486":     {"name": "Data Encrypted for Impact", "description": "Encryption of data (ransomware) to demand payment for decryption keys."},
    "T1489":     {"name": "Service Stop", "description": "Stopping of critical services to cause disruption (DoS/DDoS)."},
    "T1531":     {"name": "Account Access Removal", "description": "Locking out legitimate users by changing passwords or disabling accounts."},
}


def get_technique_explanation(technique_id: str) -> dict:
    """Get the explanation for a single MITRE technique."""
    return TECHNIQUE_EXPLANATIONS.get(technique_id, {
        "name": "Unknown Technique",
        "description": f"Technique {technique_id} - consult MITRE ATT&CK Navigator for details."
    })


def explain_techniques(technique_ids: list) -> str:
    """Generate a human-readable explanation of multiple MITRE techniques."""
    if not technique_ids:
        return "No MITRE ATT&CK techniques were mapped to this alert."

    lines = []
    for tid in technique_ids[:10]:
        info = TECHNIQUE_EXPLANATIONS.get(tid)
        if info:
            lines.append(f"* {tid} - {info['name']}: {info['description']}")
        else:
            lines.append(f"* {tid}: Technique identified in ATT&CK framework")

    return "\n".join(lines)
