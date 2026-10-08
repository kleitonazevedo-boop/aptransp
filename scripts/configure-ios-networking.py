#!/usr/bin/env python3
"""Apply environment-scoped local network settings to the generated Capacitor Info.plist."""
import ipaddress
import os
import plistlib
import sys
from pathlib import Path
from urllib.parse import urlparse


def is_private_or_local(host: str) -> bool:
    lowered = host.lower()
    if lowered == "localhost" or lowered.endswith(".localhost"):
        return True
    try:
        address = ipaddress.ip_address(lowered)
    except ValueError:
        return False
    return address.is_private or address.is_loopback or address.is_link_local


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: configure-ios-networking.py <Info.plist>")
    plist_path = Path(sys.argv[1])
    environment = os.environ.get("APTRANSP_ENVIRONMENT", "").strip().lower()
    raw_url = os.environ.get("APTRANSP_API_URL", "").strip()
    if environment not in {"local", "production"}:
        raise SystemExit("APTRANSP_ENVIRONMENT must be local or production.")
    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise SystemExit("APTRANSP_API_URL must be an absolute HTTP(S) URL.")
    host = parsed.hostname.lower()
    local_host = is_private_or_local(host)

    if environment == "production" and (parsed.scheme != "https" or local_host):
        raise SystemExit("Production iOS builds require a public HTTPS API URL.")
    if environment == "local" and parsed.scheme == "http" and not local_host:
        raise SystemExit("Local HTTP is allowed only for a private/local API host.")

    with plist_path.open("rb") as stream:
        plist = plistlib.load(stream)

    # Never carry a global ATS relaxation into either environment.
    ats = plist.get("NSAppTransportSecurity", {})
    if not isinstance(ats, dict):
        ats = {}
    for key in (
        "NSAllowsArbitraryLoads",
        "NSAllowsArbitraryLoadsInWebContent",
        "NSAllowsArbitraryLoadsForMedia",
        "NSAllowsLocalNetworking",
    ):
        ats.pop(key, None)

    # Keep only the exact host exception required by this local HTTP test.
    ats.pop("NSExceptionDomains", None)
    if environment == "local" and local_host:
        plist["NSLocalNetworkUsageDescription"] = (
            "O APTRANSP acessa a API do homelab na rede local para verificar e baixar "
            "atualizações da base GTFS. As consultas de transporte continuam no SQLite local."
        )
    elif plist.get("NSLocalNetworkUsageDescription", "").startswith(
        "O APTRANSP acessa a API do homelab na rede local"
    ):
        plist.pop("NSLocalNetworkUsageDescription", None)

    if environment == "local" and parsed.scheme == "http":
        ats["NSExceptionDomains"] = {
            host: {
                "NSExceptionAllowsInsecureHTTPLoads": True,
                "NSIncludesSubdomains": False,
            }
        }
        print(f"iOS ATS: HTTP permitido somente para o host local {host}.")
    else:
        print(f"iOS ATS: nenhuma exceção HTTP local; ambiente {environment}.")

    if ats:
        plist["NSAppTransportSecurity"] = ats
    else:
        plist.pop("NSAppTransportSecurity", None)

    with plist_path.open("wb") as stream:
        plistlib.dump(plist, stream, sort_keys=False)

    with plist_path.open("rb") as stream:
        verified = plistlib.load(stream)
    verified_ats = verified.get("NSAppTransportSecurity", {})
    if environment == "production":
        if "NSExceptionDomains" in verified_ats or any(
            verified_ats.get(key) for key in (
                "NSAllowsArbitraryLoads",
                "NSAllowsArbitraryLoadsInWebContent",
                "NSAllowsArbitraryLoadsForMedia",
            )
        ):
            raise SystemExit("Production Info.plist unexpectedly permits local/insecure HTTP.")
    elif parsed.scheme == "http":
        domains = verified_ats.get("NSExceptionDomains", {})
        if set(domains) != {host} or not domains[host].get("NSExceptionAllowsInsecureHTTPLoads"):
            raise SystemExit("Local ATS exception was not restricted to the configured API host.")


if __name__ == "__main__":
    main()
