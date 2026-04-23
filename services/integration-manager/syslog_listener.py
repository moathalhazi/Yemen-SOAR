"""
SOAR Pro Integration Manager - Syslog Listener
Async UDP + TCP server that accepts real syslog messages (RFC 3164 / 5424)
and feeds them into the integration processing pipeline.
"""

import asyncio
import logging
from typing import Callable, Awaitable, Optional

logger = logging.getLogger(__name__)


class SyslogProtocol(asyncio.DatagramProtocol):
    """UDP syslog receiver (RFC 3164 / 5424)."""

    def __init__(self, callback: Callable[[str, str], Awaitable[None]]):
        self._callback = callback

    def connection_made(self, transport):
        self.transport = transport
        logger.info("Syslog UDP listener ready")

    def datagram_received(self, data: bytes, addr):
        try:
            message = data.decode("utf-8", errors="replace").strip()
            if message:
                source_ip = addr[0]
                asyncio.ensure_future(self._callback(message, source_ip))
        except Exception as e:
            logger.error(f"Syslog UDP receive error from {addr}: {e}")

    def error_received(self, exc):
        logger.error(f"Syslog UDP error: {exc}")


class SyslogTCPHandler:
    """TCP syslog receiver — handles newline-delimited syslog streams."""

    def __init__(self, callback: Callable[[str, str], Awaitable[None]]):
        self._callback = callback

    async def handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        addr = writer.get_extra_info("peername")
        source_ip = addr[0] if addr else "unknown"
        logger.info(f"Syslog TCP connection from {source_ip}")

        try:
            while True:
                # Syslog over TCP uses newline or octet-counting frame
                line = await asyncio.wait_for(reader.readline(), timeout=300)
                if not line:
                    break
                message = line.decode("utf-8", errors="replace").strip()
                if message:
                    await self._callback(message, source_ip)
        except asyncio.TimeoutError:
            logger.debug(f"Syslog TCP timeout from {source_ip}")
        except Exception as e:
            logger.error(f"Syslog TCP error from {source_ip}: {e}")
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass


class SyslogListener:
    """
    Combined UDP + TCP syslog listener.
    Starts both servers and routes received messages to a callback.
    """

    def __init__(
        self,
        callback: Callable[[str, str], Awaitable[None]],
        udp_port: int = 1514,
        tcp_port: int = 1514,
        bind_address: str = "0.0.0.0",
    ):
        self._callback = callback
        self._udp_port = udp_port
        self._tcp_port = tcp_port
        self._bind = bind_address
        self._udp_transport: Optional[asyncio.DatagramTransport] = None
        self._tcp_server: Optional[asyncio.AbstractServer] = None

    async def start(self):
        """Start both UDP and TCP syslog servers."""
        loop = asyncio.get_running_loop()

        # UDP
        try:
            transport, _ = await loop.create_datagram_endpoint(
                lambda: SyslogProtocol(self._callback),
                local_addr=(self._bind, self._udp_port),
            )
            self._udp_transport = transport
            logger.info(f"Syslog UDP listening on {self._bind}:{self._udp_port}")
        except OSError as e:
            logger.warning(f"Syslog UDP bind failed on :{self._udp_port}: {e} — continuing without UDP")

        # TCP
        try:
            handler = SyslogTCPHandler(self._callback)
            self._tcp_server = await asyncio.start_server(
                handler.handle_client,
                self._bind,
                self._tcp_port,
            )
            logger.info(f"Syslog TCP listening on {self._bind}:{self._tcp_port}")
        except OSError as e:
            logger.warning(f"Syslog TCP bind failed on :{self._tcp_port}: {e} — continuing without TCP")

    async def stop(self):
        """Shutdown listeners."""
        if self._udp_transport:
            self._udp_transport.close()
        if self._tcp_server:
            self._tcp_server.close()
            await self._tcp_server.wait_closed()
        logger.info("Syslog listeners stopped")
