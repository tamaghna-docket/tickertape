"""
Platform Service - Wraps CustomerIntelligencePlatform for API integration

This module provides a service layer that integrates the platform with
progress tracking and WebSocket updates
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from researcher import (
    CustomerIntelligencePlatform,
    SaaSClient,
    EnterpriseCustomer,
    CustomerIntelligence
)
from backend.progress_tracker import MultiStageProgressTracker
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio


class PlatformService:
    """
    Service layer for CustomerIntelligencePlatform with progress tracking

    Wraps platform methods to emit progress updates via WebSocket
    """

    def __init__(
        self,
        openai_api_key: str,
        db_path: str = "customer_intel.db"
    ):
        """Initialize platform service"""
        self.platform = CustomerIntelligencePlatform(
            openai_api_key=openai_api_key,
            db_path=db_path
        )

    async def onboard_with_progress(
        self,
        company_name: str,
        website: str,
        ws_manager: Any,
        job_id: str,
        job_store: Any,
        deep_research: bool = True
    ) -> Dict[str, Any]:
        """
        Onboard a SaaS company with WebSocket progress updates

        Returns:
            Dictionary with onboarding results:
            {
                "company_name": str,
                "customers_discovered": int,
                "enterprise_customers": int,
                "products_found": int,
                "pricing_tiers_found": int,
                "icps_found": int,
                "personas_found": int
            }
        """
        # Create SaaS client
        saas_client = SaaSClient(name=company_name)

        # We'll need to modify the platform's onboard method to accept progress tracker
        # For now, we'll call it directly and emit progress manually

        # Create multi-stage tracker
        progress_tracker = MultiStageProgressTracker(ws_manager, job_id, job_store)

        try:
            # Pass progress tracker to the platform method
            await self.platform.onboard_saas_client(
                saas_client,
                website,
                deep_research=deep_research,
                progress_tracker=progress_tracker
            )

            # Get customer stats
            stats = self.platform.get_customer_stats(company_name)

            # Prepare result
            result = {
                "company_name": company_name,
                "customers_discovered": stats.get("total", 0),
                "enterprise_customers": stats.get("total", 0),  # All discovered customers have tickers
                "products_found": len(saas_client.products) if saas_client.products else 0,
                "pricing_tiers_found": len(saas_client.pricing_tiers) if saas_client.pricing_tiers else 0,
                "icps_found": len(saas_client.ideal_customer_profiles) if saas_client.ideal_customer_profiles else 0,
                "personas_found": len(saas_client.gtm_personas) if saas_client.gtm_personas else 0
            }

            return result

        except Exception as e:
            await ws_manager.send_progress(job_id, {
                "type": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            raise

    async def monitor_with_progress(
        self,
        saas_client_name: str,
        ws_manager: Any,
        job_id: str,
        job_store: Any,
        customer_age_days: int = 90
    ) -> Dict[str, Any]:
        """
        Monitor customers with WebSocket progress updates

        Returns:
            Dictionary with monitoring results:
            {
                "saas_client": str,
                "signals_found": int,
                "signals": List[Dict] - signal summaries
            }
        """
        progress_tracker = MultiStageProgressTracker(ws_manager, job_id, job_store)

        try:
            await ws_manager.send_progress(job_id, {
                "type": "stage_start",
                "stage": "monitoring",
                "message": f"Starting customer monitoring for {saas_client_name}",
                "timestamp": datetime.now().isoformat()
            })

            # Monitor customers with progress tracking
            intelligence_reports = await self.platform.monitor_client_customers(
                saas_client_name,
                customer_age_days=customer_age_days,
                progress_tracker=progress_tracker
            )

            await ws_manager.send_progress(job_id, {
                "type": "stage_complete",
                "stage": "monitoring",
                "message": f"Monitoring completed for {saas_client_name}",
                "signals_found": len(intelligence_reports),
                "timestamp": datetime.now().isoformat()
            })

            # Convert intelligence reports to signal summaries
            signals = []
            for intel in intelligence_reports:
                signals.append({
                    "ticker": intel.enterprise_customer.ticker or "N/A",
                    "company_name": intel.enterprise_customer.company_name,
                    "signal_type": intel.signal.signal_type,
                    "opportunity_type": intel.opportunity_type,
                    "urgency_score": intel.urgency_score,
                    "estimated_value": intel.estimated_opportunity_value,
                    "generated_at": intel.timestamp
                })

            result = {
                "saas_client": saas_client_name,
                "signals_found": len(signals),
                "signals": signals
            }

            return result

        except Exception as e:
            await ws_manager.send_progress(job_id, {
                "type": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            raise

    def get_full_intelligence_report(
        self,
        ticker: str,
        saas_client_name: str
    ) -> Optional[str]:
        """
        Get the full formatted intelligence report for a customer

        Args:
            ticker: Stock ticker symbol
            saas_client_name: SaaS client name

        Returns:
            Formatted report string or None if not found
        """
        # Load from database
        import sqlite3
        import json

        conn = sqlite3.connect(self.platform.db_path)
        c = conn.cursor()

        c.execute('''
            SELECT intelligence
            FROM intelligence
            WHERE ticker = ? AND saas_client = ?
            ORDER BY generated_at DESC
            LIMIT 1
        ''', (ticker, saas_client_name))

        result = c.fetchone()
        conn.close()

        if result:
            intel_data = json.loads(result[0])

            # Reconstruct CustomerIntelligence object
            # (This is simplified - full reconstruction would need all nested objects)
            return f"Intelligence report for {ticker} - {saas_client_name}"

        return None
