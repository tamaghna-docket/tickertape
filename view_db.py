#!/usr/bin/env python3
"""
Simple database viewer for customer_intel.db
Usage: python view_db.py
"""

import sqlite3
import json
from datetime import datetime

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def view_database():
    conn = sqlite3.connect('customer_intel.db')
    c = conn.cursor()

    # SaaS Clients
    print_section("SAAS CLIENTS")
    c.execute('SELECT name, config FROM saas_clients')
    for name, config in c.fetchall():
        client = json.loads(config)
        print(f"Name: {name}")
        print(f"Description: {client['product_description']}")
        print(f"Products: {', '.join(client['key_products'])}")
        print()

    # Enterprise Customers Count
    print_section("ENTERPRISE CUSTOMERS")
    c.execute('SELECT COUNT(*) FROM enterprise_customers')
    total = c.fetchone()[0]
    print(f"Total Customers: {total}\n")

    c.execute('SELECT ticker, company_name, saas_client FROM enterprise_customers ORDER BY company_name LIMIT 20')
    print("First 20 customers:")
    for ticker, company, saas in c.fetchall():
        print(f"  • {company:40} ({ticker}) - Client: {saas}")

    # Intelligence Reports
    print_section("INTELLIGENCE REPORTS")
    c.execute('SELECT COUNT(*) FROM intelligence')
    total_reports = c.fetchone()[0]
    print(f"Total Reports: {total_reports}\n")

    c.execute('''
        SELECT ticker, saas_client, generated_at, intelligence
        FROM intelligence
        ORDER BY generated_at DESC
        LIMIT 5
    ''')

    print("Latest 5 Reports:")
    for ticker, saas, gen_at, intel_json in c.fetchall():
        intel = json.loads(intel_json)
        print(f"\n  Ticker: {ticker}")
        print(f"  Customer: {intel['enterprise_customer']['company_name']}")
        print(f"  Signal: {intel['signal']['signal_type']}")
        print(f"  Opportunity: {intel['opportunity_type']}")
        print(f"  Urgency: {intel['urgency_score']:.2f}")
        print(f"  Value: {intel['estimated_opportunity_value']}")
        print(f"  Generated: {gen_at}")

    # Summary Stats
    print_section("SUMMARY STATISTICS")
    c.execute('''
        SELECT
            json_extract(intelligence, '$.opportunity_type') as opp_type,
            COUNT(*) as count
        FROM intelligence
        GROUP BY opp_type
    ''')
    print("Opportunities by Type:")
    for opp_type, count in c.fetchall():
        print(f"  {opp_type:20} {count:3}")

    conn.close()

if __name__ == "__main__":
    view_database()
