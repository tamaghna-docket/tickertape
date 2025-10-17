# Simple Usage Guide

## The Problem You Had

Before, you had to manually specify ALL of this:

```python
salesforce = SaaSClient(
    name="Salesforce",
    industry="CRM Platform",
    product_description="Cloud CRM for sales, service, marketing",
    typical_customer_profile="Enterprise 500+ employees",
    key_products=["Sales Cloud", "Service Cloud", "Marketing Cloud"],
    pricing_model="$50k-$500k ARR",
    expansion_opportunities=[
        "Additional clouds",
        "Seat expansion",
        "Industry solutions"
    ],
    churn_indicators=[
        "Layoffs",
        "Executive departures",
        "Budget cuts"
    ]
)
```

## The Solution: Just Provide Name & URL

Now you only need this:

```python
import asyncio
from researcher import CustomerIntelligencePlatform, SaaSClient

async def main():
    # Initialize platform
    platform = CustomerIntelligencePlatform(
        openai_api_key="your-api-key",
        db_path="customer_intel.db"
    )

    # THAT'S IT! Just name and website
    salesforce = SaaSClient(name="Salesforce")

    # Onboard - everything is auto-researched
    await platform.onboard_saas_client(salesforce, "salesforce.com")

    # Monitor customers
    reports = await platform.monitor_client_customers("Salesforce")

    # Print reports
    for intel in reports:
        print(platform.generate_report(intel))

if __name__ == "__main__":
    asyncio.run(main())
```

## What Gets Auto-Researched?

When you call `onboard_saas_client()` with `deep_research=True` (default), it automatically discovers:

### 1. **Company Metadata**
- Industry category
- Product description
- Typical customer profile
- Pricing model

### 2. **Products** (Full Details)
- Product names
- Descriptions
- Key features
- Use cases
- Target personas

### 3. **Pricing Tiers**
- Tier names (Starter, Pro, Enterprise, etc.)
- Price ranges
- Target segments
- Features per tier
- Limitations

### 4. **Ideal Customer Profiles (ICPs)**
- Segment names
- Company size ranges
- Industry verticals
- Key pain points
- Buying triggers
- Decision makers

### 5. **GTM Personas**
- Role titles (CTO, VP Sales, etc.)
- Department
- Seniority level
- Core focus areas
- Key metrics they care about
- Pain points
- Buying signals they respond to

### 6. **Strategic Insights**
- Expansion opportunities
- Churn indicators

## How It Works

```
1. You provide: Company name + website URL
   ↓
2. CompanyResearchAgent runs 10 parallel web searches
   ↓
3. GPT-4o parses results into structured data
   ↓
4. All fields auto-populate in SaaSClient
   ↓
5. Data saved to database (no need to research again)
   ↓
6. Customer discovery begins
   ↓
7. Intelligence reports use full context
```

## Example: Onboard Any SaaS Company

```python
# HubSpot
hubspot = SaaSClient(name="HubSpot")
await platform.onboard_saas_client(hubspot, "hubspot.com")

# Stripe
stripe = SaaSClient(name="Stripe")
await platform.onboard_saas_client(stripe, "stripe.com")

# Zoom
zoom = SaaSClient(name="Zoom")
await platform.onboard_saas_client(zoom, "zoom.us")
```

That's it! Each onboarding takes ~30 seconds but gives you:
- Complete product catalog
- Pricing information
- ICP definitions
- GTM persona profiles
- Strategic context

## Override If Needed

You can still override any field if you want:

```python
# Provide some custom info, auto-research the rest
custom_client = SaaSClient(
    name="MyCompany",
    industry="Custom Industry",  # Override this
    # Everything else auto-researched
)
await platform.onboard_saas_client(custom_client, "mycompany.com")
```

## Benefits

1. **10x faster onboarding**: 2 lines of code instead of 20+
2. **More accurate**: Real-time web research vs manual entry
3. **Always up-to-date**: Researched fresh each time
4. **Less error-prone**: No manual typos or outdated info
5. **Scalable**: Onboard 100 companies as easily as 1

## Performance

- **10 parallel research queries** with progress bar
- **3 parallel customer discovery queries**
- **~30 seconds** for full company research
- **Results cached** in database for instant re-use
