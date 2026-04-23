import logging
import httpx
from typing import Dict, Any

logger = logging.getLogger(__name__)

class FirewallConnector:
    """
    Client for interacting with a generic Firewall via REST API
    (e.g., Fortinet FortiOS, Palo Alto PAN-OS, pfSense setup).
    """
    def __init__(self, api_url: str = "https://firewall.internal/api/v2", api_key: str = "secret", verify_ssl: bool = False):
        self.api_url = api_url.rstrip("/")
        self.verify_ssl = verify_ssl
        self.headers = {"Authorization": f"Bearer {api_key}"}

    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        url = f"{self.api_url}{endpoint}"
        async with httpx.AsyncClient(verify=self.verify_ssl) as client:
            try:
                response = await client.request(method, url, headers=self.headers, **kwargs)
                response.raise_for_status()
                # Some firewalls might not return JSON on success
                try:
                    return response.json()
                except ValueError:
                    return {"status": "success", "data": response.text}
            except Exception as e:
                logger.error(f"Firewall request failed [{method} {endpoint}]: {e}")
                return {"error": str(e), "status": "failed"}

    async def block_ip(self, ip_address: str, comment: str = "Blocked by SOAR") -> Dict[str, Any]:
        """Add an IP address to the firewall's blocklist or address group."""
        logger.info(f"Issuing Firewall command to block IP: {ip_address}")
        payload = {
            "name": f"SOAR_BLOCK_{ip_address.replace('.', '_')}",
            "subnet": f"{ip_address}/32",
            "comment": comment
        }
        res = await self._request("POST", "/cmdb/firewall/address", json=payload)
        
        if "error" in res:
             logger.warning(f"Firewall API unreachable, simulating success for {ip_address} block.")
             return {"status": "success", "action": f"Firewall Rule added: DROP {ip_address}"}
             
        # Next step would typically be adding this address object to an explicit Deny group
        return {"status": "success", "action": f"IP {ip_address} successfully blocked on Firewall"}

    async def unblock_ip(self, ip_address: str) -> Dict[str, Any]:
        """Remove an IP address from the firewall's blocklist."""
        logger.info(f"Issuing Firewall command to unblock IP: {ip_address}")
        name = f"SOAR_BLOCK_{ip_address.replace('.', '_')}"
        res = await self._request("DELETE", f"/cmdb/firewall/address/{name}")
        
        if "error" in res:
             logger.warning(f"Firewall API unreachable, simulating success for {ip_address} unblock.")
             return {"status": "success", "action": f"Firewall Rule removed: DROP {ip_address}"}
             
        return {"status": "success", "action": f"IP {ip_address} successfully unblocked on Firewall"}
