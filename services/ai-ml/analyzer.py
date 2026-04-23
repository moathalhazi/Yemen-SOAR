"""
SOAR Pro — AI Alert Analyzer
Uses a LOCAL LLM (DeepSeek-R1-Distill-Llama-8B) for security alert analysis.

Academic Context — Role of AI in SOAR:
──────────────────────────────────────
  AI augments human analysts in four key areas:

  1. ALERT EXPLANATION — Translates technical alerts into natural language
     reducing cognitive load on SOC analysts.

  2. RISK INTERPRETATION — Contextualizes the numerical risk score by
     explaining contributing factors and operational meaning.

  3. RESPONSE RECOMMENDATION — Suggests specific, actionable response
     steps based on alert category, accelerating MTTR.

  4. REPORT GENERATION — Produces structured incident summaries enabling
     faster reporting and post-incident review.

  Architecture:
    Primary:  Local LLM (DeepSeek-R1-Distill-Llama-8B via llama-cpp-python)
    Fallback: Deterministic rule-based engine

  Benefits of local model:
    - No external API dependency (air-gapped compatible)
    - Data sovereignty — no alert data leaves the system
    - Consistent latency — no network variability
    - Cost-effective — no per-token API charges
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# ── Local LLM Configuration ─────────────────────
MODEL_PATH = os.getenv("MODEL_PATH", "/app/models/DeepSeek-R1-Distill-Llama-8B-Q4_0.gguf")
N_CTX = int(os.getenv("MODEL_N_CTX", "4096"))
N_THREADS = int(os.getenv("MODEL_N_THREADS", "4"))
N_GPU_LAYERS = int(os.getenv("MODEL_N_GPU_LAYERS", "0"))  # 0 = CPU only

llm = None


def load_model():
    """Load the local GGUF model. Called once at startup."""
    global llm
    if not os.path.exists(MODEL_PATH):
        logger.warning(f"Model not found at {MODEL_PATH} — will use rule-based fallback")
        return

    try:
        from llama_cpp import Llama
        logger.info(f"Loading local LLM: {os.path.basename(MODEL_PATH)}")
        llm = Llama(
            model_path=MODEL_PATH,
            n_ctx=N_CTX,
            n_threads=N_THREADS,
            n_gpu_layers=N_GPU_LAYERS,
            verbose=False,
        )
        logger.info("Local LLM loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load local LLM: {e}")
        llm = None


# ════════════════════════════════════════════════
# KNOWLEDGE BASES (for deterministic fallback)
# ════════════════════════════════════════════════

SEVERITY_CONTEXT = {
    "low": {
        "urgency": "Low - monitor during normal operations",
        "sla": "Review within 24 hours",
        "escalation": "Log and monitor",
    },
    "medium": {
        "urgency": "Moderate - investigate during business hours",
        "sla": "Investigate within 4 hours",
        "escalation": "Escalate to SOC L2 if anomalous",
    },
    "high": {
        "urgency": "High - requires immediate investigation",
        "sla": "Investigate within 1 hour",
        "escalation": "Escalate to SOC L2/L3 immediately",
    },
    "critical": {
        "urgency": "Critical - active threat requiring immediate containment",
        "sla": "Immediate response required (< 15 mins)",
        "escalation": "Escalate to Incident Commander and CISO",
    },
}

CATEGORY_ACTIONS = {
    "phishing": [
        "Block sender domain at email gateway",
        "Search all mailboxes for similar emails",
        "Reset credentials for any users who clicked",
        "Analyze attachment/URL in sandbox",
        "Report phishing domain to registrar",
    ],
    "malware": [
        "Isolate the affected endpoint from network",
        "Block identified file hashes at EDR",
        "Run full AV scan on the host",
        "Collect memory dump for forensic analysis",
        "Check lateral movement indicators",
    ],
    "brute_force": [
        "Block the attacking source IP at the firewall",
        "Enforce temporary account lockout",
        "Enable enhanced authentication logging",
        "Verify no successful logins from the attacker",
        "Consider implementing CAPTCHA or MFA",
    ],
    "data_exfiltration": [
        "Block all outbound connections from the affected host",
        "Preserve network traffic logs for forensic review",
        "Identify all accessed files and data repositories",
        "Notify Data Protection Officer (DPO)",
        "Initiate legal hold on relevant data",
    ],
    "ransomware": [
        "Immediately isolate all affected systems",
        "DO NOT pay the ransom",
        "Activate backup restoration procedures",
        "Engage forensic team for root cause analysis",
        "Report to law enforcement (CERT/CSIRT)",
    ],
    "insider_threat": [
        "Preserve all user activity logs",
        "Restrict user access pending investigation",
        "Coordinate with HR and Legal departments",
        "Monitor for additional data access attempts",
        "Collect forensic evidence from the user's workstation",
    ],
    "vulnerability": [
        "Assess exploitability and exposure",
        "Apply patches or mitigations within SLA",
        "Scan for indicators of exploitation",
        "Update vulnerability management database",
        "Schedule follow-up verification scan",
    ],
}

DEFAULT_ACTIONS = [
    "Investigate the alert source and context",
    "Correlate with related alerts from the same timeframe",
    "Check threat intelligence for known indicators",
    "Document findings in the incident timeline",
    "Escalate if evidence of compromise is found",
]


# ════════════════════════════════════════════════
# ANALYZER CLASS
# ════════════════════════════════════════════════

class AlertAnalyzer:
    """
    Analyzes security alerts using a local LLM or deterministic rules.
    Returns structured analysis with explanation, risk interpretation,
    recommended actions, incident summary, and MITRE explanation.
    """

    async def analyze(self, alert: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a normalized alert.

        Returns:
            {
                "explanation": str,
                "risk_interpretation": str,
                "recommended_actions": [str],
                "incident_summary": str,
                "mitre_explanation": str | None,
                "ai_confidence": float,
                "analysis_method": "local_llm" | "rule_based",
                "model_name": str,
                "analyzed_at": str
            }
        """
        # Try local LLM first, fallback to rule-based
        if llm is not None:
            try:
                result = self._analyze_with_local_llm(alert)
                result["analysis_method"] = "local_llm"
                result["model_name"] = "DeepSeek-R1-Distill-Llama-8B-Q4_0"
                return result
            except Exception as e:
                logger.warning(f"Local LLM analysis failed, using fallback: {e}")

        result = self._analyze_rule_based(alert)
        result["analysis_method"] = "rule_based"
        result["model_name"] = "deterministic-engine-v1"
        return result

    # ── Local LLM Analysis ───────────────────────

    def _analyze_with_local_llm(self, alert: Dict[str, Any]) -> Dict[str, Any]:
        """Use the local DeepSeek model to analyze the alert."""
        prompt = self._build_prompt(alert)

        response = llm(
            prompt,
            max_tokens=1024,
            temperature=0.3,
            top_p=0.9,
            stop=["```", "\n\n\n"],
        )

        raw_text = response["choices"][0]["text"].strip()

        # Try to parse as JSON
        try:
            parsed = self._extract_json(raw_text)
        except Exception:
            parsed = None

        if parsed and isinstance(parsed, dict):
            return {
                "explanation": parsed.get("explanation", self._fallback_explanation(alert)),
                "risk_interpretation": parsed.get("risk_interpretation", ""),
                "recommended_actions": parsed.get("recommended_actions", DEFAULT_ACTIONS),
                "incident_summary": parsed.get("incident_summary", ""),
                "mitre_explanation": parsed.get("mitre_explanation"),
                "ai_confidence": min(parsed.get("ai_confidence", 0.8), 1.0),
                "analyzed_at": datetime.now(timezone.utc).isoformat(),
                "raw_response": raw_text[:500],
            }

        # If JSON parsing failed, use the raw text as explanation
        # and supplement with rule-based data
        rule_result = self._analyze_rule_based(alert)
        rule_result["explanation"] = raw_text[:600] if raw_text else rule_result["explanation"]
        rule_result["ai_confidence"] = 0.65
        rule_result["raw_response"] = raw_text[:500]
        return rule_result

    def _build_prompt(self, alert: Dict[str, Any]) -> str:
        """Build the prompt for the local LLM."""
        mitre_section = ""
        techniques = alert.get("mitre_techniques", [])
        if techniques:
            mitre_section = f"\nMITRE ATT&CK Techniques: {', '.join(techniques)}"

        indicators_str = ""
        indicators = alert.get("indicators", {})
        if any(indicators.get(k) for k in indicators):
            indicators_str = f"\nIndicators of Compromise: {json.dumps(indicators, default=str)}"

        return f"""<|begin_of_sentence|>You are a senior SOC analyst. Analyze this security alert and respond with JSON.

Alert:
- Title: {alert.get('title', 'Unknown')}
- Severity: {alert.get('severity', 'unknown')}
- Category: {alert.get('category', 'unknown')}
- Description: {alert.get('description', 'No description')}
- Risk Score: {alert.get('risk_score', 'N/A')}/100
- Source: {alert.get('source', alert.get('source_name', 'unknown'))}{mitre_section}{indicators_str}

Respond with this JSON structure:
{{"explanation": "what happened", "risk_interpretation": "risk meaning", "recommended_actions": ["action1", "action2", "action3"], "incident_summary": "brief summary", "mitre_explanation": "MITRE context", "ai_confidence": 0.8}}

JSON:
"""

    @staticmethod
    def _extract_json(text: str) -> Optional[Dict]:
        """Try to extract JSON from LLM output."""
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to find JSON block
        import re
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        return None

    @staticmethod
    def _fallback_explanation(alert: Dict) -> str:
        severity = alert.get("severity", "unknown")
        title = alert.get("title", "Unknown")
        return f"A {severity}-severity alert '{title}' requires investigation."

    # ── Rule-Based Fallback ──────────────────────

    def _analyze_rule_based(self, alert: Dict[str, Any]) -> Dict[str, Any]:
        """Deterministic rule-based analysis when LLM is unavailable."""
        title = alert.get("title", "Unknown Alert")
        severity = alert.get("severity", "medium").lower()
        category = (alert.get("category") or "general").lower()
        risk_score = alert.get("risk_score", 50)
        description = alert.get("description", "")
        source = alert.get("source", alert.get("source_name", "unknown"))
        techniques = alert.get("mitre_techniques", [])
        indicators = alert.get("indicators", {})

        sev_ctx = SEVERITY_CONTEXT.get(severity, SEVERITY_CONTEXT["medium"])

        # Build explanation
        has_iocs = any(indicators.get(k) for k in indicators) if indicators else False
        explanation = (
            f"A {severity}-severity alert '{title}' was detected from {source}. "
            f"{sev_ctx['urgency']}. "
            f"{'This alert includes indicators of compromise (IOCs) that should be investigated.' if has_iocs else 'No specific IOCs were identified in this alert.'}"
        )

        # Build risk interpretation
        safe_risk_score = risk_score if risk_score is not None else 50
        risk_level = "critical" if safe_risk_score >= 90 else "high" if safe_risk_score >= 75 else "medium" if safe_risk_score >= 50 else "low"
        risk_interpretation = (
            f"Risk Score: {safe_risk_score}/100 ({risk_level}). "
            f"Calculated using: Severity ({severity}) × Asset Criticality × Threat Confidence. "
            f"{sev_ctx['sla']}. {sev_ctx['escalation']}."
        )

        # Get recommended actions
        actions = CATEGORY_ACTIONS.get(category, DEFAULT_ACTIONS).copy()
        if safe_risk_score >= 80:
            actions.insert(0, "PRIORITY: Trigger automated forensic evidence collection")
        if safe_risk_score >= 90:
            actions.insert(0, "CRITICAL: Notify Incident Commander immediately")

        # Build incident summary
        incident_summary = (
            f"Incident Summary\n"
            f"----------------\n"
            f"Alert: {title}\n"
            f"Severity: {severity.upper()} | Risk Score: {safe_risk_score}/100\n"
            f"Source: {source}\n"
            f"Category: {category}\n"
            f"Description: {description or 'N/A'}\n"
            f"MITRE Techniques: {', '.join(techniques) if techniques else 'None mapped'}\n"
            f"Response SLA: {sev_ctx['sla']}\n"
            f"Recommended Escalation: {sev_ctx['escalation']}"
        )

        # MITRE explanation
        mitre_explanation = None
        if techniques:
            mitre_explanation = self._explain_mitre(techniques, category)

        return {
            "explanation": explanation,
            "risk_interpretation": risk_interpretation,
            "recommended_actions": actions,
            "incident_summary": incident_summary,
            "mitre_explanation": mitre_explanation,
            "ai_confidence": 0.75,
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
        }

    def chat_with_assistant(self, message: str, context: Optional[str] = None) -> Dict[str, Any]:
        """Process a chat message using the local LLM or fallback."""
        global llm

        system_prompt = (
            "You are a Senior Cybersecurity SOC Analyst (Tier 2/3) integrated inside a SOAR platform.\n\n"
            "CRITICAL RULES:\n"
            "- Do NOT mention you are an AI model, language model, or mention training data.\n"
            "- Respond as a professional SOC analyst with domain-expert authority.\n"
            "- Detect the user's language and respond in the same language.\n"
            "- If input is Arabic, respond in formal technical Arabic (فصحى تقنية).\n"
            "- If input is English, respond in English.\n"
            "- Maintain an authoritative, concise tone. No emojis. No casual language.\n"
            "- Answer ONLY cybersecurity and SOC-related questions.\n"
            "- Provide command examples and detection logic when relevant.\n"
            "- If data is insufficient, say: 'Insufficient evidence to classify with high confidence.' "
            "or 'البيانات غير كافية لاتخاذ قرار دقيق'.\n\n"
            "ALERT CLASSIFICATION (when analyzing an alert):\n"
            "1) Classify as: True Positive / False Positive / False Negative / True Negative\n"
            "2) Confidence score (0-100%)\n"
            "3) Explain: Indicators of compromise, behavioral patterns, threat intel alignment, log correlation\n"
            "4) Suggest: Response action, escalation or closure, additional investigation steps\n"
            "Output format:\n"
            "  Classification: / Confidence: / Severity: / Analysis: / Indicators: / Risk Impact: / Recommended Action: / Escalation Required: Yes/No\n\n"
            "INCIDENT ANALYSIS (when analyzing an incident):\n"
            "1) Root cause analysis, threat actor behavior, MITRE ATT&CK mapping\n"
            "2) Impact assessment, risk level (Low/Medium/High/Critical)\n"
            "3) Lateral movement possibility, containment strategy, remediation plan\n"
            "4) Correlate: alerts, logs, IP reputation, user behavior anomalies\n"
            "Output format:\n"
            "  Executive Summary: / Technical Analysis: / Threat Mapping: / Impact Assessment: / "
            "Risk Level: / Containment Strategy: / Remediation Plan: / Post-Incident Recommendations:\n"
        )

        prompt_parts = [system_prompt]

        if context:
            prompt_parts.append(f"Context about the current situation:\n{context}")

        prompt_parts.append(f"User: {message}\nAssistant:")

        full_prompt = "\n\n".join(prompt_parts)

        method = "deterministic"
        response_text = ""

        if llm is not None:
            try:
                response = llm(
                    prompt=full_prompt,
                    max_tokens=800,
                    temperature=0.4,
                    top_p=0.9,
                    stop=["User:", "\n\nUser:"],
                    echo=False
                )

                output_text = response['choices'][0]['text'].strip()
                # Strip any <think>...</think> reasoning blocks from DeepSeek
                import re
                output_text = re.sub(r'<think>[\s\S]*?</think>', '', output_text).strip()
                if output_text:
                    response_text = output_text
                    method = "local_llm"
            except Exception as e:
                logger.error(f"Error calling local LLM for chat: {e}")

        if not response_text:
            response_text = self._deterministic_chat_response(message, context)

        return {
            "response": response_text,
            "tokens_used": 0,
            "method": method
        }

    def _deterministic_chat_response(self, message: str, context: Optional[str] = None) -> str:
        """Domain-expert deterministic response when LLM is unavailable."""
        msg = message.lower()

        # Detect Arabic
        is_arabic = any('\u0600' <= c <= '\u06FF' for c in message)

        if is_arabic:
            if any(kw in msg for kw in ["تنبيه", "alert", "إنذار"]):
                return (
                    "إجراء التشغيل القياسي:\n"
                    "1. عزل النقطة الطرفية المتأثرة عن الشبكة فوراً\n"
                    "2. مراجعة سجلات حركة المرور الشبكية المرتبطة\n"
                    "3. حفظ سجلات النظام للتحليل الجنائي\n"
                    "4. فحص مؤشرات الاختراق (IOCs) في قاعدة بيانات التهديدات\n"
                    "5. تصعيد إلى محلل المستوى الثالث إذا تم تأكيد الاختراق"
                )
            if any(kw in msg for kw in ["حادث", "حادثة", "incident"]):
                return (
                    "تحليل الحوادث:\n"
                    "1. تحديد نطاق التأثير والأصول المتضررة\n"
                    "2. إجراء تحليل السبب الجذري\n"
                    "3. تطبيق إجراءات الاحتواء الفوري\n"
                    "4. توثيق الجدول الزمني للحادثة\n"
                    "5. إعداد خطة المعالجة والاستعادة"
                )
            return (
                "أنا متخصص في تحليل التنبيهات الأمنية والحوادث السيبرانية. "
                "يمكنني المساعدة في:\n"
                "- تصنيف التنبيهات (True/False Positive)\n"
                "- تحليل الحوادث وربطها بإطار MITRE ATT&CK\n"
                "- تقديم توصيات الاستجابة والاحتواء\n"
                "- تحليل مؤشرات الاختراق (IOCs)\n\n"
                "يرجى تقديم تفاصيل التنبيه أو الحادثة للتحليل."
            )

        # English responses
        if any(kw in msg for kw in ["alert", "triage", "classify"]):
            sev_hint = ""
            if context:
                ctx_lower = context.lower()
                if "critical" in ctx_lower:
                    sev_hint = "Given the CRITICAL severity, immediate containment is required.\n"
                elif "high" in ctx_lower:
                    sev_hint = "Given the HIGH severity, prioritize investigation within 1 hour.\n"
            return (
                f"{sev_hint}"
                "Standard Operating Procedure:\n"
                "1. Isolate the affected endpoint from the network immediately\n"
                "2. Review associated network traffic logs and DNS queries\n"
                "3. Preserve system logs and memory dump for forensic analysis\n"
                "4. Cross-reference IOCs against threat intelligence feeds\n"
                "5. Escalate to Tier 3 / Incident Commander if compromise is confirmed\n\n"
                "Provide the full alert details for a structured classification."
            )
        if any(kw in msg for kw in ["incident", "root cause", "rca"]):
            return (
                "Incident Analysis Framework:\n"
                "1. Scope Assessment — Identify all affected assets and lateral movement\n"
                "2. Root Cause Analysis — Trace initial access vector\n"
                "3. MITRE ATT&CK Mapping — Map observed TTPs to ATT&CK framework\n"
                "4. Containment — Isolate compromised systems, revoke credentials\n"
                "5. Eradication — Remove persistence mechanisms, patch vulnerabilities\n"
                "6. Recovery — Restore from clean backups, verify integrity\n"
                "7. Lessons Learned — Update detection rules and playbooks\n\n"
                "Provide the incident details for a full analysis."
            )
        if "mitre" in msg:
            return (
                "MITRE ATT&CK Framework:\n"
                "A globally-accessible knowledge base of adversary tactics, techniques, and procedures (TTPs) "
                "based on real-world observations.\n\n"
                "Key uses in SOC operations:\n"
                "- Map detected behaviors to known attack patterns\n"
                "- Identify gaps in detection coverage\n"
                "- Prioritize detection engineering efforts\n"
                "- Communicate threat context across teams\n\n"
                "Provide specific technique IDs (e.g., T1566.001) for detailed explanation."
            )
        if any(kw in msg for kw in ["ioc", "indicator", "compromise"]):
            return (
                "IOC Analysis Procedure:\n"
                "1. Extract observables: IPs, domains, file hashes (MD5/SHA256), URLs\n"
                "2. Query threat intelligence platforms: VirusTotal, AlienVault OTX, MISP\n"
                "3. Check internal SIEM for historical matches\n"
                "4. Assess confidence level and apply blocking rules if confirmed malicious\n"
                "5. Update local IOC feeds and detection signatures\n\n"
                "Provide the specific indicators for analysis."
            )
        return (
            "I specialize in security alert analysis, incident response, and threat intelligence.\n\n"
            "Available capabilities:\n"
            "- Alert classification (True/False Positive) with confidence scoring\n"
            "- Incident root cause analysis with MITRE ATT&CK mapping\n"
            "- IOC analysis and threat intelligence correlation\n"
            "- Response recommendations and containment strategies\n"
            "- Detection rule engineering (YARA, Sigma, Suricata)\n\n"
            "Provide alert or incident details for a structured analysis."
        )
    @staticmethod
    def _explain_mitre(techniques: List[str], category: str) -> str:
        """Generate a MITRE ATT&CK explanation."""
        from mitre_knowledge import TECHNIQUE_EXPLANATIONS

        lines = ["MITRE ATT&CK Analysis:"]
        for tech_id in techniques[:5]:
            explanation = TECHNIQUE_EXPLANATIONS.get(tech_id)
            if explanation:
                lines.append(f"  * {tech_id} ({explanation['name']}): {explanation['description']}")
            else:
                lines.append(f"  * {tech_id}: Technique identified - consult ATT&CK Navigator for details")

        lines.append(f"\nThis attack pattern is consistent with {category} operations.")
        return "\n".join(lines)
