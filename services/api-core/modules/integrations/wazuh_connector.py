import logging
import httpx
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class WazuhConnector:
    """
    Client for interacting with the Wazuh Manager API.
    Handles authentication, agent management, and Active Response triggers.
    """
    def __init__(self, base_url: str = "https://localhost:55000", user: str = "wazuh-wui", password: str = "wazuh-wui", verify_ssl: bool = False):
        self.base_url = base_url.rstrip("/")
        self.user = user
        self.password = password
        self.verify_ssl = verify_ssl
        self.token = None

    async def _authenticate(self):
        """Obtain a JWT from Wazuh Manager."""
        url = f"{self.base_url}/security/user/authenticate"
        async with httpx.AsyncClient(verify=self.verify_ssl) as client:
            try:
                response = await client.post(url, auth=(self.user, self.password))
                response.raise_for_status()
                data = response.json()
                self.token = data.get("data", {}).get("token")
            except Exception as e:
                logger.error(f"Wazuh authentication failed: {e}")
                raise

    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Wrapper for authenticated HTTP requests."""
        if not self.token:
            await self._authenticate()
        
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {self.token}"
        
        url = f"{self.base_url}{endpoint}"
        async with httpx.AsyncClient(verify=self.verify_ssl) as client:
            try:
                response = await client.request(method, url, headers=headers, **kwargs)
                if response.status_code == 401:
                    # Token expired, retry once
                    await self._authenticate()
                    headers["Authorization"] = f"Bearer {self.token}"
                    response = await client.request(method, url, headers=headers, **kwargs)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Wazuh request failed [{method} {endpoint}]: {e}")
                return {"error": str(e), "status": "failed"}

    async def get_agent_info(self, agent_id: str) -> Dict[str, Any]:
        """Retrieve details about a specific Wazuh agent."""
        res = await self._request("GET", f"/agents/{agent_id}")
        if "error" in res:
            return res
        return res.get("data", {}).get("affected_items", [{}])[0]

    async def trigger_active_response(self, agent_id: str, command: str, arguments: list = None) -> Dict[str, Any]:
        """
        Run an Active Response command on an agent.
        E.g., command="firewall-drop", arguments=["-", "192.168.1.100"]
        """
        payload = {
            "command": command,
            "custom": True
        }
        if arguments:
            payload["arguments"] = arguments

        # Note: API endpoint for active response might vary slightly by version. 
        # Usually PUT /active-response with a list of agents
        res = await self._request("PUT", "/active-response", params={"agents_list": agent_id}, json=payload)
        
        if "error" in res:
            logger.error(f"Active Response failed: {res['error']}")
            return {"status": "failed", "action": f"Wazuh Active Response '{command}' failed: {res['error']}"}
            
        return {"status": "success", "action": f"Wazuh Active Response '{command}' dispatched to Agent {agent_id}"}
    
    async def isolate_host(self, ip_address: str, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Higher level method to map 'isolate_host' conceptually to Wazuh.
        Requires agent_id or attempts to find the agent by IP.
        """
        if not agent_id:
            # Attempt to find agent by IP
            list_res = await self._request("GET", "/agents", params={"search": ip_address})
            items = list_res.get("data", {}).get("affected_items", [])
            if items:
                agent_id = items[0].get("id")
            else:
                return {"status": "failed", "action": f"Could not find Wazuh Agent for IP {ip_address}"}
        
        # 'host-isolate' would be a custom active response script configured on Wazuh
        return await self.trigger_active_response(agent_id, "host-isolate")
