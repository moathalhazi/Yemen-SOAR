"""
SOAR Pro — Forensic Integrity Engine
SHA-256 file hashing and hash-chain verification.

Integrity Model (inspired by NIST SP 800-86):
─────────────────────────────────────────────
  1. Every evidence file is hashed immediately upon collection using SHA-256.
  2. The hash is stored in a metadata.json alongside the evidence.
  3. Each metadata.json contains a `previous_hash` field pointing to the
     hash of the prior evidence file in collection order — forming a
     hash chain (similar to a blockchain/Merkle chain).
  4. A `chain_hash` is computed over all file hashes to produce a single
     integrity digest for the entire evidence set.

  Verification = re-hash every file and compare against stored hashes.
  If any file was tampered with, the hash chain breaks.

Chain of Custody Concept:
─────────────────────────
  Chain of custody is a legal documentation process that tracks:
     WHO collected the evidence
     WHEN it was collected
     WHAT was collected
     HOW it was stored
     WHETHER integrity was maintained (via SHA-256 verification)

  We implement this as metadata.json with hash links — each evidence
  file is a "link" in the custody chain, and any break in hashes
  indicates potential tampering.

NIST SP 800-86 Alignment:
─────────────────────────
  - Collection:   Systematic gathering of volatile data (processes, network)
  - Examination:  Structured JSON for programmatic analysis
  - Preservation: SHA-256 hashing ensures integrity at rest
  - Documentation: metadata.json serves as the custody record
"""

import hashlib
import json
import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# ── Genesis hash (the first link in any chain) ──
GENESIS_HASH = "0" * 64  # 64 zeros — represents the chain origin


def compute_sha256(data: bytes) -> str:
    """Compute SHA-256 hash of raw bytes and return hex digest."""
    return hashlib.sha256(data).hexdigest()


def compute_file_hash(filepath: str) -> str:
    """Compute SHA-256 hash of a file on disk."""
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            sha.update(chunk)
    return sha.hexdigest()


def compute_chain_hash(hashes: List[str]) -> str:
    """
    Compute a single integrity digest over all evidence hashes.
    This is the 'root hash' of the evidence chain.
    """
    combined = "".join(hashes)
    return hashlib.sha256(combined.encode()).hexdigest()


def save_evidence_file(
    evidence_dir: str,
    filename: str,
    data: Dict[str, Any],
) -> Dict[str, str]:
    """
    Serialize evidence data to a JSON file and compute its SHA-256 hash.

    Returns:
        {"filepath": ..., "sha256": ..., "size_bytes": ...}
    """
    filepath = os.path.join(evidence_dir, filename)
    content = json.dumps(data, indent=2, default=str).encode("utf-8")

    with open(filepath, "wb") as f:
        f.write(content)

    sha256 = compute_sha256(content)
    size = len(content)

    logger.info(f"Evidence saved: {filename} | SHA256={sha256[:16]}… | {size} bytes")

    return {
        "filepath": filepath,
        "filename": filename,
        "sha256": sha256,
        "size_bytes": size,
    }


def build_metadata(
    incident_id: str,
    evidence_files: List[Dict[str, str]],
    collected_by: str = "forensic-service",
) -> Dict[str, Any]:
    """
    Build the metadata.json for a complete evidence collection.
    Implements hash chaining: each file's `previous_hash` points to
    the hash of the file before it (or GENESIS_HASH for the first).

    Structure:
    {
      "incident_id": "...",
      "chain": [
        {"file": "system_info.json", "sha256": "abc...", "previous_hash": "000..."},
        {"file": "processes.json",   "sha256": "def...", "previous_hash": "abc..."},
        ...
      ],
      "chain_hash": "...",  // root hash of entire chain
    }
    """
    chain = []
    previous_hash = GENESIS_HASH

    for ef in evidence_files:
        link = {
            "file": ef["filename"],
            "sha256": ef["sha256"],
            "size_bytes": ef["size_bytes"],
            "previous_hash": previous_hash,
        }
        chain.append(link)
        previous_hash = ef["sha256"]

    # Compute root hash of entire chain
    all_hashes = [ef["sha256"] for ef in evidence_files]
    chain_hash = compute_chain_hash(all_hashes)

    metadata = {
        "incident_id": incident_id,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "collected_by": collected_by,
        "collection_tool": "SOAR Pro Forensic Service v1.0",
        "evidence_count": len(evidence_files),
        "chain": chain,
        "chain_hash": chain_hash,
        "integrity_algorithm": "SHA-256",
        "chain_model": "Sequential hash chain (GENESIS → file₁ → file₂ → … → fileₙ)",
        "nist_reference": "NIST SP 800-86 — Guide to Integrating Forensic Techniques into Incident Response",
    }

    return metadata


def verify_evidence(evidence_dir: str) -> Dict[str, Any]:
    """
    Verify integrity of all evidence files in a collection.

    Process:
      1. Load metadata.json
      2. For each file in the chain:
         a. Re-hash the file on disk
         b. Compare with stored SHA-256 — PASS or TAMPERED
         c. Verify previous_hash links to prior file's hash
      3. Re-compute chain_hash and compare with stored value

    Returns a structured verification report.
    """
    metadata_path = os.path.join(evidence_dir, "metadata.json")

    if not os.path.exists(metadata_path):
        return {
            "status": "error",
            "message": "metadata.json not found — evidence may be missing or deleted",
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }

    with open(metadata_path, "r") as f:
        metadata = json.load(f)

    chain = metadata.get("chain", [])
    stored_chain_hash = metadata.get("chain_hash", "")
    results = []
    all_valid = True
    previous_hash = GENESIS_HASH

    for link in chain:
        filename = link["file"]
        stored_hash = link["sha256"]
        stored_prev = link["previous_hash"]
        filepath = os.path.join(evidence_dir, filename)

        entry = {
            "file": filename,
            "stored_hash": stored_hash[:16] + "…",
        }

        # Check file exists
        if not os.path.exists(filepath):
            entry["status"] = "MISSING"
            entry["message"] = "Evidence file not found on disk"
            all_valid = False
            results.append(entry)
            previous_hash = stored_hash
            continue

        # Re-hash
        current_hash = compute_file_hash(filepath)
        hash_match = current_hash == stored_hash

        # Verify chain link
        chain_link_valid = stored_prev == previous_hash

        if hash_match and chain_link_valid:
            entry["status"] = "VERIFIED"
            entry["integrity"] = "intact"
        elif not hash_match:
            entry["status"] = "TAMPERED"
            entry["integrity"] = "compromised"
            entry["message"] = "File hash does not match stored hash — evidence may be altered"
            entry["expected_hash"] = stored_hash[:16] + "…"
            entry["actual_hash"] = current_hash[:16] + "…"
            all_valid = False
        elif not chain_link_valid:
            entry["status"] = "CHAIN_BROKEN"
            entry["integrity"] = "chain link invalid"
            entry["message"] = "Previous hash does not link correctly"
            all_valid = False

        results.append(entry)
        previous_hash = stored_hash

    # Verify root chain hash
    current_hashes = []
    for link in chain:
        filepath = os.path.join(evidence_dir, link["file"])
        if os.path.exists(filepath):
            current_hashes.append(compute_file_hash(filepath))
        else:
            current_hashes.append("MISSING")

    recalculated_chain_hash = compute_chain_hash(current_hashes) if "MISSING" not in current_hashes else "INCOMPLETE"
    chain_hash_valid = recalculated_chain_hash == stored_chain_hash

    return {
        "status": "verified" if all_valid and chain_hash_valid else "failed",
        "incident_id": metadata.get("incident_id"),
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "collected_at": metadata.get("collected_at"),
        "collected_by": metadata.get("collected_by"),
        "evidence_count": len(chain),
        "chain_hash_stored": stored_chain_hash[:16] + "…",
        "chain_hash_current": recalculated_chain_hash[:16] + "…" if recalculated_chain_hash != "INCOMPLETE" else "INCOMPLETE",
        "chain_hash_valid": chain_hash_valid,
        "overall_integrity": "ALL FILES INTACT" if all_valid else "INTEGRITY VIOLATION DETECTED",
        "files": results,
    }
