"""
Customer Intelligence Platform - Complete Standalone Version
Everything you need in one file

Usage:
    python customer_intelligence.py

Dependencies:
    pip install edgartools openai beautifulsoup4 lxml agents-sdk
"""

import asyncio
import json
import sqlite3
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path

import openai
from agents import Agent, Runner, WebSearchTool, ModelSettings
from openai import AsyncOpenAI
from openai.types.shared import Reasoning
from bs4 import BeautifulSoup
from edgar import Company, set_identity
from tqdm.asyncio import tqdm

# Configure
set_identity("your.email@company.com")


# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class BuyingSignal:
    """A detected buying signal from SEC filing"""
    signal_type: str
    confidence: float
    summary: str
    key_details: Dict[str, Any]
    filing_date: datetime
    company: str
    ticker: str
    filing_url: str
    
    def to_dict(self):
        d = asdict(self)
        d['filing_date'] = self.filing_date.isoformat()
        return d


@dataclass
class Product:
    """A product offered by the SaaS company"""
    name: str
    description: str
    key_features: List[str]
    use_cases: List[str]
    target_personas: List[str]


@dataclass
class PricingTier:
    """A pricing tier for a product"""
    name: str
    price_range: str
    target_segment: str
    key_features: List[str]
    limitations: List[str]


@dataclass
class ICP:
    """Ideal Customer Profile"""
    segment_name: str
    company_size: str
    industry_verticals: List[str]
    key_pain_points: List[str]
    buying_triggers: List[str]
    decision_makers: List[str]


@dataclass
class GTMPersona:
    """Go-to-Market Persona"""
    role_title: str
    department: str
    seniority_level: str
    core_focus_areas: List[str]
    key_metrics: List[str]
    pain_points: List[str]
    buying_signals_they_care_about: List[str]


@dataclass
class SaaSClient:
    """A B2B SaaS company that's YOUR customer"""
    name: str

    # Basic fields (auto-populated from research if not provided)
    industry: str = ""
    product_description: str = ""
    typical_customer_profile: str = ""
    key_products: List[str] = None
    pricing_model: str = ""
    expansion_opportunities: List[str] = None
    churn_indicators: List[str] = None

    # Enhanced research data (auto-populated from research)
    products: List[Product] = None
    pricing_tiers: List[PricingTier] = None
    ideal_customer_profiles: List[ICP] = None
    gtm_personas: List[GTMPersona] = None

    def __post_init__(self):
        if self.key_products is None:
            self.key_products = []
        if self.expansion_opportunities is None:
            self.expansion_opportunities = []
        if self.churn_indicators is None:
            self.churn_indicators = []
        if self.products is None:
            self.products = []
        if self.pricing_tiers is None:
            self.pricing_tiers = []
        if self.ideal_customer_profiles is None:
            self.ideal_customer_profiles = []
        if self.gtm_personas is None:
            self.gtm_personas = []


@dataclass
class EnterpriseCustomer:
    """One of your SaaS client's enterprise customers"""
    company_name: str
    ticker: Optional[str]
    industry: str
    saas_client: str
    relationship_details: Dict[str, Any]
    last_seen: str = ""  # ISO timestamp of when this customer was last discovered

    def __post_init__(self):
        if not self.last_seen:
            self.last_seen = datetime.now().isoformat()


@dataclass
class PersonaInsight:
    """Persona-specific insight and recommendation"""
    persona_role: str
    relevance_score: float
    why_this_matters: str
    specific_talking_points: List[str]
    recommended_products: List[str]
    suggested_approach: str
    key_metrics_to_highlight: List[str]


@dataclass
class CustomerIntelligence:
    """Actionable intelligence about a customer"""
    signal: BuyingSignal
    enterprise_customer: EnterpriseCustomer
    saas_client: SaaSClient

    # Analysis
    signal_implications: str
    relationship_impact: str
    opportunity_type: str
    urgency_score: float
    estimated_opportunity_value: str

    # Context-aware analysis
    relevant_products: List[str]
    relevant_pricing_tiers: List[str]
    matching_icp_segments: List[str]

    # Persona-specific insights
    persona_insights: List[PersonaInsight]

    # Recommendations
    recommended_action: str
    suggested_products: List[str]
    suggested_email: str
    talking_points: List[str]

    # Metadata
    generated_at: datetime
    confidence_score: float


# ============================================================================
# SIGNAL DETECTION (from SEC filings)
# ============================================================================

class TextExtractor:
    """Extract and clean text from SEC filings"""
    
    @staticmethod
    def clean_html(html: str) -> str:
        """Remove HTML tags and clean text"""
        if not html:
            return ""
        
        soup = BeautifulSoup(html, 'html.parser')
        
        for script in soup(["script", "style"]):
            script.decompose()
        
        text = soup.get_text()
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return text
    
    @staticmethod
    def extract_from_8k(filing) -> Dict[str, Any]:
        """Extract all text from 8-K filing"""
        result = {
            'main_text': '',
            'press_release_text': '',
            'combined_text': '',
            'items': []
        }
        
        try:
            obj = filing.obj()
            
            if hasattr(obj, 'items'):
                result['items'] = obj.items
            
            try:
                main_text = filing.text()
                if main_text:
                    result['main_text'] = main_text
            except:
                pass
            
            if hasattr(obj, 'has_press_release') and obj.has_press_release:
                try:
                    press_releases = obj.press_releases
                    attachments = press_releases.attachments
                    
                    for attachment in attachments:
                        html = attachment.download()
                        clean_text = TextExtractor.clean_html(html)
                        result['press_release_text'] += clean_text + "\n\n"
                except Exception as e:
                    pass
            
            combined_parts = []
            if result['main_text']:
                combined_parts.append(result['main_text'])
            if result['press_release_text']:
                combined_parts.append(result['press_release_text'])
            
            result['combined_text'] = "\n\n".join(combined_parts)
            
        except Exception as e:
            pass
        
        return result


class SignalDetector:
    """Detect buying signals from filing text using LLM"""
    
    def __init__(self, openai_api_key: str):
        self.client = openai.OpenAI(api_key=openai_api_key)
        self.model = "gpt-4o-mini"
    
    def extract_signals(self, text: str, company: str, ticker: str,
                       filing_date: datetime, filing_url: str,
                       items: List[str]) -> List[BuyingSignal]:
        """Extract signals using LLM"""
        
        if not text or len(text) < 100:
            return []
        
        text = text[:50000]  # Truncate
        
        system_prompt = """Extract B2B buying signals from SEC filing.

Signal types: executive_hire, funding_round, acquisition, expansion, partnership, ipo, revenue_growth, product_launch, technology_investment, restructuring

Return JSON:
{
  "signals": [
    {
      "signal_type": "executive_hire",
      "confidence": 0.85,
      "summary": "Brief description",
      "key_details": {"names": "...", "amount": "..."}
    }
  ]
}

Return {"signals": []} if none found."""

        user_prompt = f"""Company: {company} ({ticker})
Date: {filing_date.strftime('%Y-%m-%d')}
Items: {', '.join(items)}

{text}

Extract signals:"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            parsed = json.loads(content.strip())
            signals_data = parsed.get('signals', [])
            
            signals = []
            for sig in signals_data:
                signal = BuyingSignal(
                    signal_type=sig['signal_type'],
                    confidence=sig['confidence'],
                    summary=sig['summary'],
                    key_details=sig.get('key_details', {}),
                    filing_date=filing_date,
                    company=company,
                    ticker=ticker,
                    filing_url=filing_url
                )
                signals.append(signal)
            
            return signals
            
        except Exception as e:
            print(f"Signal extraction error: {e}")
            return []


# ============================================================================
# COMPANY RESEARCH AGENT
# ============================================================================

class CompanyResearchAgent:
    """Deep research on SaaS company's products, ICP, and GTM strategy"""

    def __init__(self, openai_api_key: str):
        self.openai_client = AsyncOpenAI(api_key=openai_api_key)
        self.search_agent = Agent(
            name="CompanyResearcher",
            tools=[WebSearchTool()],
            instructions="""You are a B2B SaaS market research analyst.

Search for detailed information about SaaS companies including:
- Product features, capabilities, and use cases
- Pricing tiers and packaging
- Target customer profiles and ICPs
- GTM personas and their priorities
- Competitive positioning

Focus on factual, recent information from company websites, press releases,
analyst reports, and industry publications.""",
            model="gpt-5",
            model_settings=ModelSettings(
                reasoning=Reasoning(effort="high")
            )
        )

    async def research_company(self, saas_company: str, website: str, progress_tracker=None) -> Dict[str, Any]:
        """Comprehensive company research using parallel searches

        Args:
            saas_company: Name of the SaaS company
            website: Company website
            progress_tracker: Optional ProgressTracker for WebSocket updates
        """

        print(f"\n🔬 Deep research on {saas_company}...")

        # Define all research queries as dictionary
        searches = {
            "products": f"{saas_company} products features capabilities site:{website}",
            "product_details": f"{saas_company} product suite key features benefits use cases",
            "pricing": f"{saas_company} pricing tiers plans packages site:{website}",
            "pricing_details": f"{saas_company} enterprise pricing professional starter plans",
            "icp": f"{saas_company} ideal customer profile target market customer segments",
            "icp_details": f"{saas_company} typical customer company size industry verticals",
            "gtm_personas": f"{saas_company} buyer personas decision makers purchasing roles",
            "gtm_roles": f"{saas_company} who buys sales process stakeholders champions",
            "customer_pain_points": f"{saas_company} customer challenges problems solves pain points",
            "buying_triggers": f"{saas_company} buying signals when customers buy implementation triggers"
        }

        # Helper function for individual searches
        async def search_category(category, query):
            try:
                result = await Runner.run(self.search_agent, query)

                # Optional: Log reasoning steps and tool calls with output
                if hasattr(result, 'new_items') and result.new_items:
                    print(f"\n  📋 {category} - Agent steps:")
                    for i, item in enumerate(result.new_items, 1):
                        item_type = type(item).__name__
                        output = str(getattr(item, 'output', ''))[:200]

                        if 'Reasoning' in item_type:
                            print(f"    {i}. 🧠 Reasoning: {output}...")
                        elif 'ToolCall' in item_type:
                            tool_name = getattr(item, 'name', 'unknown')
                            print(f"    {i}. 🔧 Tool: {tool_name} | Output: {output}...")
                        elif 'Message' in item_type:
                            print(f"    {i}. 💬 Message: {output}...")

                return category, result.final_output
            except Exception as e:
                print(f"  ⚠️  Research error for {category}: {e}")
                return category, ""

        # Run all searches in parallel
        tasks = [search_category(cat, query) for cat, query in searches.items()]

        # Use progress tracker if provided, otherwise use tqdm
        if progress_tracker:
            # Create a stage tracker for research (if MultiStageProgressTracker)
            if hasattr(progress_tracker, 'stage'):
                stage_tracker = progress_tracker.stage("research", total_tasks=len(searches))
            else:
                stage_tracker = progress_tracker

            # Wrap tasks with progress tracker
            tracked_tasks = [
                stage_tracker.track_task(task_name, task)
                for task_name, task in zip(searches.keys(), tasks)
            ]
            results = await asyncio.gather(*tracked_tasks)
        else:
            # Fallback to tqdm for CLI usage
            results = await tqdm.gather(*tasks, desc="Researching company")

        # Collect results by category
        research_data = {category: output for category, output in results}

        # Parse into structured data using LLM
        structured_data = await self._parse_research(saas_company, research_data)

        print(f"  ✓ Research complete: {len(structured_data.get('products', []))} products, "
              f"{len(structured_data.get('gtm_personas', []))} personas identified")

        return structured_data

    async def _parse_research(self, company: str, research_data: Dict[str, str]) -> Dict[str, Any]:
        """Parse unstructured research into structured data using LLM"""

        prompt = f"""Parse this B2B SaaS company research into structured JSON.

Company: {company}

RESEARCH DATA:
{json.dumps(research_data, indent=2)}

Return JSON with this EXACT structure:
{{
  "company_metadata": {{
    "industry": "Industry category (e.g., CRM, Marketing Automation)",
    "product_description": "One-sentence description of what the company does",
    "typical_customer_profile": "Typical customer (e.g., Enterprise 1000+ employees)",
    "pricing_model": "General pricing range (e.g., $50k-$500k ARR)"
  }},
  "products": [
    {{
      "name": "Product Name",
      "description": "What it does",
      "key_features": ["Feature 1", "Feature 2"],
      "use_cases": ["Use case 1", "Use case 2"],
      "target_personas": ["Persona 1", "Persona 2"]
    }}
  ],
  "pricing_tiers": [
    {{
      "name": "Tier Name (e.g., Professional, Enterprise)",
      "price_range": "$X-Y per user/month or $Xk-Yk ARR",
      "target_segment": "SMB/Mid-market/Enterprise",
      "key_features": ["Feature 1", "Feature 2"],
      "limitations": ["Limitation 1", "Limitation 2"]
    }}
  ],
  "ideal_customer_profiles": [
    {{
      "segment_name": "Segment name",
      "company_size": "Employee count range",
      "industry_verticals": ["Industry 1", "Industry 2"],
      "key_pain_points": ["Pain 1", "Pain 2"],
      "buying_triggers": ["Trigger 1", "Trigger 2"],
      "decision_makers": ["Role 1", "Role 2"]
    }}
  ],
  "gtm_personas": [
    {{
      "role_title": "e.g., VP of Sales, CTO",
      "department": "e.g., Sales, Engineering",
      "seniority_level": "C-level/VP/Director/Manager",
      "core_focus_areas": ["Focus 1", "Focus 2"],
      "key_metrics": ["Metric 1", "Metric 2"],
      "pain_points": ["Pain 1", "Pain 2"],
      "buying_signals_they_care_about": ["Signal 1", "Signal 2"]
    }}
  ],
  "expansion_opportunities": ["Opportunity 1", "Opportunity 2"],
  "churn_indicators": ["Indicator 1", "Indicator 2"]
}}

Extract as much detail as possible. If information is not found, provide best estimates based on typical B2B SaaS patterns."""

        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a B2B SaaS market research analyst. Parse research data into structured JSON."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0
            )

            parsed = json.loads(response.choices[0].message.content)
            return parsed

        except Exception as e:
            print(f"  ⚠️  Parse error: {e}")
            return {
                "company_metadata": {},
                "products": [],
                "pricing_tiers": [],
                "ideal_customer_profiles": [],
                "gtm_personas": [],
                "expansion_opportunities": [],
                "churn_indicators": []
            }


# ============================================================================
# CUSTOMER DISCOVERY AGENTS
# ============================================================================

class CustomerDiscoveryAgent:
    """Discovers enterprise customers of a SaaS company"""
    
    def __init__(self, openai_api_key: str):
        self.openai_client = AsyncOpenAI(api_key=openai_api_key)
        self.discovery_agent = Agent(
            name="CustomerDiscoveryAgent",
            tools=[WebSearchTool()],
            instructions="""Find enterprise customers of B2B SaaS companies.

Search for:
- Company website customers page
- Case studies and testimonials
- Press releases about customer wins
- LinkedIn posts mentioning customers
- Industry publications

Focus on publicly traded enterprise customers.""",
            model="gpt-5",
            model_settings=ModelSettings(
                reasoning=Reasoning(effort="high")
            )
        )
    
    async def discover_customers(self, saas_company: str, website: str, progress_tracker=None) -> List[Dict[str, str]]:
        """Discover enterprise customers

        Args:
            saas_company: Name of the SaaS company
            website: Company website
            progress_tracker: Optional ProgressTracker for WebSocket updates
        """

        print(f"\n🔍 Discovering customers of {saas_company}...")

        # Define searches as a dictionary
        searches = {
            "enterprise_list": f"{saas_company} enterprise customers list",
            "case_studies": f"{saas_company} customer case studies Fortune 500",
            "website_search": f'site:{website} "customer" OR "case study"'
        }

        # Helper function to run individual search
        async def search_category(category, query):
            try:
                result = await Runner.run(self.discovery_agent, query)

                # Optional: Log reasoning steps and tool calls with output
                if hasattr(result, 'new_items') and result.new_items:
                    print(f"\n  📋 {category} - Agent steps:")
                    for i, item in enumerate(result.new_items, 1):
                        item_type = type(item).__name__
                        output = str(getattr(item, 'output', ''))[:200]

                        if 'Reasoning' in item_type:
                            print(f"    {i}. 🧠 Reasoning: {output}...")
                        elif 'ToolCall' in item_type:
                            tool_name = getattr(item, 'name', 'unknown')
                            print(f"    {i}. 🔧 Tool: {tool_name} | Output: {output}...")
                        elif 'Message' in item_type:
                            print(f"    {i}. 💬 Message: {output}...")

                customers = self._parse_customer_list(result.final_output)
                return category, customers
            except Exception as e:
                print(f"  ⚠️  Query error for {category}: {e}")
                return category, []

        # Run all searches in parallel
        tasks = [search_category(category, query) for category, query in searches.items()]

        # Use progress tracker if provided, otherwise use tqdm
        if progress_tracker:
            # Create a stage tracker for discovery (if MultiStageProgressTracker)
            if hasattr(progress_tracker, 'stage'):
                stage_tracker = progress_tracker.stage("discovery", total_tasks=len(searches))
            else:
                stage_tracker = progress_tracker

            # Wrap tasks with progress tracker
            tracked_tasks = [
                stage_tracker.track_task(task_name, task)
                for task_name, task in zip(searches.keys(), tasks)
            ]
            results = await asyncio.gather(*tracked_tasks)
        else:
            # Fallback to tqdm for CLI usage
            results = await tqdm.gather(*tasks, desc="Searching for customers")

        # Combine all results
        all_customers = []
        for category, customers in results:
            all_customers.extend(customers)

        # Deduplicate
        unique = {}
        for c in all_customers:
            name = c['company_name'].lower()
            if name not in unique:
                unique[name] = c

        result = list(unique.values())[:30]  # Limit to top 30
        print(f"  ✓ Found {len(result)} customers")
        return result
    
    def _parse_customer_list(self, text: str) -> List[Dict[str, str]]:
        """Parse agent output"""
        customers = []
        for line in text.split('\n'):
            line = line.strip()
            if line.startswith('-') or line.startswith('•'):
                company_name = line.lstrip('-•').strip()
                if len(company_name) > 2:
                    customers.append({
                        'company_name': company_name,
                        'evidence': 'web_search'
                    })
        return customers


class TickerMappingAgent:
    """Maps company names to stock tickers"""
    
    def __init__(self, openai_api_key: str):
        self.ticker_agent = Agent(
            name="TickerMapper",
            tools=[WebSearchTool()],
            instructions="""Find stock ticker for company name.

Search: "[Company Name] stock ticker"
Return: Ticker symbol (e.g., TSLA) or NOT_PUBLIC if private.""",
            model="gpt-4o"
        )
    
    async def get_ticker(self, company_name: str) -> Optional[str]:
        """Get ticker for company"""
        try:
            query = f"Stock ticker for {company_name}? Return ONLY ticker or NOT_PUBLIC"
            result = await Runner.run(self.ticker_agent, query)
            ticker = result.final_output.strip().upper()
            
            if "NOT" in ticker or "PRIVATE" in ticker or len(ticker) > 6:
                return None
            
            if ticker and 1 <= len(ticker) <= 5 and ticker.isalpha():
                return ticker
            
            return None
        except:
            return None
    
    async def map_customers_to_tickers(self, customers: List[Dict]) -> List[EnterpriseCustomer]:
        """Map customers to tickers"""
        
        print(f"\n🎯 Mapping to tickers...")
        
        enterprise_customers = []
        
        for customer in customers:
            company_name = customer['company_name']
            ticker = await self.get_ticker(company_name)
            
            if ticker:
                print(f"  ✓ {company_name} → {ticker}")
                enterprise_customers.append(EnterpriseCustomer(
                    company_name=company_name,
                    ticker=ticker,
                    industry="Unknown",
                    saas_client="",
                    relationship_details=customer
                ))
        
        print(f"\n  Found {len(enterprise_customers)} public companies")
        return enterprise_customers


# ============================================================================
# INTELLIGENCE AGENT
# ============================================================================

class IntelligenceAgent:
    """Analyzes signals in context of SaaS relationship with deep product and persona insights"""

    def __init__(self, openai_api_key: str):
        self.client = AsyncOpenAI(api_key=openai_api_key)

    async def analyze_signal(self, signal: BuyingSignal,
                            enterprise_customer: EnterpriseCustomer,
                            saas_client: SaaSClient) -> CustomerIntelligence:
        """Analyze signal for SaaS client with enhanced product/persona context"""

        # Build rich context from research data
        products_context = self._build_products_context(saas_client)
        pricing_context = self._build_pricing_context(saas_client)
        icp_context = self._build_icp_context(saas_client)
        personas_context = self._build_personas_context(saas_client)

        prompt = f"""Analyze this buying signal for a B2B SaaS account team with DEEP contextual insights.

YOUR CUSTOMER (SaaS company):
{saas_client.name} - {saas_client.product_description}

PRODUCTS & FEATURES:
{products_context}

PRICING TIERS:
{pricing_context}

IDEAL CUSTOMER PROFILES:
{icp_context}

GTM PERSONAS (Decision Makers):
{personas_context}

THEIR CUSTOMER (you're analyzing):
{enterprise_customer.company_name} ({enterprise_customer.ticker})
Industry: {enterprise_customer.industry}

BUYING SIGNAL:
Type: {signal.signal_type}
Date: {signal.filing_date.strftime('%Y-%m-%d')}
Summary: {signal.summary}
Key Details: {json.dumps(signal.key_details, indent=2)}

YOUR TASK:
Analyze this signal with DEEP understanding of products, features, ICP fit, and personas.
For EACH GTM persona, explain WHY this signal matters to THEM specifically.

Return JSON with this EXACT structure:
{{
  "signal_implications": "What this signal means for the business",
  "relationship_impact": "How this impacts the SaaS relationship",
  "opportunity_type": "expansion|retention|cross_sell|renewal|at_risk",
  "urgency_score": 0.0-1.0,
  "estimated_opportunity_value": "$XXk-YYk ARR",

  "relevant_products": ["Product names that fit this signal/situation"],
  "relevant_pricing_tiers": ["Pricing tier names that match the signal"],
  "matching_icp_segments": ["ICP segment names that this customer matches"],

  "persona_insights": [
    {{
      "persona_role": "Role title from GTM personas",
      "relevance_score": 0.0-1.0,
      "why_this_matters": "Why THIS specific signal matters to THIS persona",
      "specific_talking_points": ["Point 1 tailored for this persona", "Point 2"],
      "recommended_products": ["Products to pitch to this persona"],
      "suggested_approach": "How to approach this persona given the signal",
      "key_metrics_to_highlight": ["Metrics this persona cares about"]
    }}
  ],

  "recommended_action": "Specific action for account manager",
  "suggested_products": ["Overall product recommendations"],
  "suggested_email": "Email template for account manager",
  "talking_points": ["General talking points"],
  "confidence_score": 0.0-1.0
}}

CRITICAL: Generate persona_insights for ALL relevant GTM personas. Make each insight HIGHLY specific to:
1. The persona's role and focus areas
2. The specific signal type and details
3. The product features that solve their pain points
4. The buying triggers that match this signal"""

        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an elite B2B SaaS account strategist with deep knowledge of product positioning, ICP targeting, and persona-based selling."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0
            )

            analysis = json.loads(response.choices[0].message.content)

            # Parse persona insights
            persona_insights = []
            for pi in analysis.get('persona_insights', []):
                persona_insights.append(PersonaInsight(
                    persona_role=pi['persona_role'],
                    relevance_score=float(pi['relevance_score']),
                    why_this_matters=pi['why_this_matters'],
                    specific_talking_points=pi['specific_talking_points'],
                    recommended_products=pi['recommended_products'],
                    suggested_approach=pi['suggested_approach'],
                    key_metrics_to_highlight=pi['key_metrics_to_highlight']
                ))

            return CustomerIntelligence(
                signal=signal,
                enterprise_customer=enterprise_customer,
                saas_client=saas_client,
                signal_implications=analysis['signal_implications'],
                relationship_impact=analysis['relationship_impact'],
                opportunity_type=analysis['opportunity_type'],
                urgency_score=float(analysis['urgency_score']),
                estimated_opportunity_value=analysis['estimated_opportunity_value'],
                relevant_products=analysis.get('relevant_products', []),
                relevant_pricing_tiers=analysis.get('relevant_pricing_tiers', []),
                matching_icp_segments=analysis.get('matching_icp_segments', []),
                persona_insights=persona_insights,
                recommended_action=analysis['recommended_action'],
                suggested_products=analysis['suggested_products'],
                suggested_email=analysis['suggested_email'],
                talking_points=analysis['talking_points'],
                generated_at=datetime.now(),
                confidence_score=float(analysis['confidence_score'])
            )

        except Exception as e:
            print(f"Intelligence error: {e}")
            raise

    def _build_products_context(self, saas_client: SaaSClient) -> str:
        """Build rich product context"""
        if not saas_client.products:
            return f"Products: {', '.join(saas_client.key_products)}"

        lines = []
        for product in saas_client.products:
            lines.append(f"• {product.name}: {product.description}")
            lines.append(f"  Features: {', '.join(product.key_features[:5])}")
            lines.append(f"  Use cases: {', '.join(product.use_cases[:3])}")
        return "\n".join(lines) if lines else f"Products: {', '.join(saas_client.key_products)}"

    def _build_pricing_context(self, saas_client: SaaSClient) -> str:
        """Build pricing tier context"""
        if not saas_client.pricing_tiers:
            return f"Pricing: {saas_client.pricing_model}"

        lines = []
        for tier in saas_client.pricing_tiers:
            lines.append(f"• {tier.name} ({tier.price_range}) - Target: {tier.target_segment}")
            lines.append(f"  Features: {', '.join(tier.key_features[:3])}")
        return "\n".join(lines) if lines else f"Pricing: {saas_client.pricing_model}"

    def _build_icp_context(self, saas_client: SaaSClient) -> str:
        """Build ICP context"""
        if not saas_client.ideal_customer_profiles:
            return f"Typical Customer: {saas_client.typical_customer_profile}"

        lines = []
        for icp in saas_client.ideal_customer_profiles:
            lines.append(f"• {icp.segment_name} ({icp.company_size})")
            lines.append(f"  Industries: {', '.join(icp.industry_verticals[:3])}")
            lines.append(f"  Pain points: {', '.join(icp.key_pain_points[:3])}")
            lines.append(f"  Buying triggers: {', '.join(icp.buying_triggers[:3])}")
        return "\n".join(lines) if lines else f"Typical Customer: {saas_client.typical_customer_profile}"

    def _build_personas_context(self, saas_client: SaaSClient) -> str:
        """Build GTM persona context"""
        if not saas_client.gtm_personas:
            return "GTM Personas: Not yet researched"

        lines = []
        for persona in saas_client.gtm_personas:
            lines.append(f"• {persona.role_title} ({persona.department}, {persona.seniority_level})")
            lines.append(f"  Focus areas: {', '.join(persona.core_focus_areas[:3])}")
            lines.append(f"  Key metrics: {', '.join(persona.key_metrics[:3])}")
            lines.append(f"  Cares about signals: {', '.join(persona.buying_signals_they_care_about[:3])}")
        return "\n".join(lines) if lines else "GTM Personas: Not yet researched"


# ============================================================================
# MAIN PLATFORM
# ============================================================================

class CustomerIntelligencePlatform:
    """Complete platform"""
    
    def __init__(self, openai_api_key: str, db_path: str = "customer_intel.db"):
        self.openai_key = openai_api_key
        self.db_path = db_path

        # Initialize components
        self.research_agent = CompanyResearchAgent(openai_api_key)
        self.discovery_agent = CustomerDiscoveryAgent(openai_api_key)
        self.ticker_agent = TickerMappingAgent(openai_api_key)
        self.intelligence_agent = IntelligenceAgent(openai_api_key)
        self.text_extractor = TextExtractor()
        self.signal_detector = SignalDetector(openai_api_key)

        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''CREATE TABLE IF NOT EXISTS saas_clients
                     (name TEXT PRIMARY KEY, config JSON)''')

        c.execute('''CREATE TABLE IF NOT EXISTS enterprise_customers
                     (ticker TEXT, saas_client TEXT, company_name TEXT,
                      last_seen TEXT, config JSON, PRIMARY KEY (ticker, saas_client))''')

        # Add last_seen column if it doesn't exist (migration for existing DBs)
        try:
            c.execute('ALTER TABLE enterprise_customers ADD COLUMN last_seen TEXT')
        except sqlite3.OperationalError:
            pass  # Column already exists

        c.execute('''CREATE TABLE IF NOT EXISTS intelligence
                     (id INTEGER PRIMARY KEY, ticker TEXT, saas_client TEXT,
                      generated_at TEXT, intelligence JSON)''')

        conn.commit()
        conn.close()
    
    async def onboard_saas_client(self, saas_client: SaaSClient, website: str, deep_research: bool = True, progress_tracker=None):
        """Onboard new SaaS client with optional deep research

        Args:
            saas_client: SaaS client to onboard
            website: Company website
            deep_research: Whether to perform deep research
            progress_tracker: Optional ProgressTracker for WebSocket updates
        """

        print(f"\n{'='*80}")
        print(f"ONBOARDING: {saas_client.name}")
        print(f"{'='*80}")

        # STEP 1: Deep company research (if enabled)
        if deep_research:
            research_data = await self.research_agent.research_company(saas_client.name, website, progress_tracker)

            # Populate company metadata fields
            metadata = research_data.get('company_metadata', {})
            if not saas_client.industry:
                saas_client.industry = metadata.get('industry', '')
            if not saas_client.product_description:
                saas_client.product_description = metadata.get('product_description', '')
            if not saas_client.typical_customer_profile:
                saas_client.typical_customer_profile = metadata.get('typical_customer_profile', '')
            if not saas_client.pricing_model:
                saas_client.pricing_model = metadata.get('pricing_model', '')

            # Populate structured research data
            saas_client.products = [Product(**p) for p in research_data.get('products', [])]
            saas_client.pricing_tiers = [PricingTier(**pt) for pt in research_data.get('pricing_tiers', [])]
            saas_client.ideal_customer_profiles = [ICP(**icp) for icp in research_data.get('ideal_customer_profiles', [])]
            saas_client.gtm_personas = [GTMPersona(**gp) for gp in research_data.get('gtm_personas', [])]

            # Populate derived fields
            if not saas_client.key_products:
                saas_client.key_products = [p.name for p in saas_client.products[:5]]
            if not saas_client.expansion_opportunities:
                saas_client.expansion_opportunities = research_data.get('expansion_opportunities', [])
            if not saas_client.churn_indicators:
                saas_client.churn_indicators = research_data.get('churn_indicators', [])

        # STEP 2: Save enriched client to database
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('INSERT OR REPLACE INTO saas_clients VALUES (?, ?)',
                 (saas_client.name, json.dumps(asdict(saas_client))))
        conn.commit()
        conn.close()

        # STEP 3: Discover customers
        customers = await self.discovery_agent.discover_customers(saas_client.name, website, progress_tracker)

        # STEP 4: Map to tickers
        enterprise_customers = await self.ticker_agent.map_customers_to_tickers(customers)

        # STEP 5: Save/update customers with timestamp
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        current_time = datetime.now().isoformat()

        # Insert or update customers with new last_seen timestamp
        for customer in enterprise_customers:
            customer.saas_client = saas_client.name
            customer.last_seen = current_time
            c.execute('''INSERT OR REPLACE INTO enterprise_customers
                         (ticker, saas_client, company_name, last_seen, config)
                         VALUES (?, ?, ?, ?, ?)''',
                     (customer.ticker, customer.saas_client, customer.company_name,
                      customer.last_seen, json.dumps(asdict(customer))))

        conn.commit()
        conn.close()

        print(f"\n✅ Onboarding complete:")
        print(f"   • Industry: {saas_client.industry}")
        print(f"   • {len(saas_client.products)} products researched")
        print(f"   • {len(saas_client.pricing_tiers)} pricing tiers identified")
        print(f"   • {len(saas_client.ideal_customer_profiles)} ICP segments")
        print(f"   • {len(saas_client.gtm_personas)} GTM personas identified")
        print(f"   • {len(enterprise_customers)} customers ready to monitor")
        return enterprise_customers
    
    async def monitor_client_customers(self, saas_client_name: str, lookback_days: int = 30,
                                      customer_age_days: int = 90, progress_tracker=None):
        """Monitor recently seen customers of a SaaS client

        Args:
            saas_client_name: Name of the SaaS client
            lookback_days: How many days back to look for SEC filings
            customer_age_days: Only monitor customers seen in last N days (default: 90)
            progress_tracker: Optional MultiStageProgressTracker for WebSocket updates
        """

        print(f"\n{'='*80}")
        print(f"MONITORING: {saas_client_name}")
        print(f"{'='*80}")

        # Get SaaS client and customers from DB
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('SELECT config FROM saas_clients WHERE name = ?', (saas_client_name,))
        result = c.fetchone()
        if not result:
            print(f"Client {saas_client_name} not found")
            return []

        # Deserialize SaaSClient with nested dataclasses
        client_data = json.loads(result[0])

        # Convert nested lists of dicts back to dataclass instances
        if client_data.get('products'):
            client_data['products'] = [Product(**p) for p in client_data['products']]
        if client_data.get('pricing_tiers'):
            client_data['pricing_tiers'] = [PricingTier(**pt) for pt in client_data['pricing_tiers']]
        if client_data.get('ideal_customer_profiles'):
            client_data['ideal_customer_profiles'] = [ICP(**icp) for icp in client_data['ideal_customer_profiles']]
        if client_data.get('gtm_personas'):
            client_data['gtm_personas'] = [GTMPersona(**gp) for gp in client_data['gtm_personas']]

        saas_client = SaaSClient(**client_data)

        # Only get customers seen recently
        cutoff_date = (datetime.now() - timedelta(days=customer_age_days)).isoformat()
        c.execute('''SELECT config FROM enterprise_customers
                     WHERE saas_client = ? AND last_seen >= ?
                     ORDER BY last_seen DESC''',
                 (saas_client_name, cutoff_date))

        customers = [EnterpriseCustomer(**json.loads(row[0])) for row in c.fetchall()]

        # Get count of stale customers for info
        c.execute('''SELECT COUNT(*) FROM enterprise_customers
                     WHERE saas_client = ? AND last_seen < ?''',
                 (saas_client_name, cutoff_date))
        stale_count = c.fetchone()[0]

        conn.close()

        print(f"Monitoring {len(customers)} active customers (last seen < {customer_age_days} days)")
        if stale_count > 0:
            print(f"  (⚠️  {stale_count} stale customers excluded)")

        # Create monitoring progress tracker if provided
        monitoring_tracker = None
        if progress_tracker:
            if hasattr(progress_tracker, 'stage'):
                monitoring_tracker = progress_tracker.stage("monitoring", total_tasks=len(customers))
            else:
                monitoring_tracker = progress_tracker

        # Monitor each
        all_intelligence = []

        for i, customer in enumerate(customers, 1):
            print(f"\n[{i}/{len(customers)}] {customer.company_name} ({customer.ticker})")

            # Create async task for monitoring this customer
            async def monitor_customer():
                signals = await self._get_signals(customer.ticker, lookback_days)

                if not signals:
                    print(f"  No signals")
                    return []

                results = []
                for signal in signals:
                    intelligence = await self.intelligence_agent.analyze_signal(
                        signal, customer, saas_client
                    )
                    results.append(intelligence)
                    self._save_intelligence(intelligence)
                return results

            # Track progress if tracker is available
            if monitoring_tracker:
                intelligence_list = await monitoring_tracker.track_task(
                    f"{customer.company_name}_{customer.ticker}",
                    monitor_customer()
                )
            else:
                intelligence_list = await monitor_customer()

            all_intelligence.extend(intelligence_list)
        
        print(f"\n✅ Complete: {len(all_intelligence)} reports generated")
        return all_intelligence
    
    async def _get_signals(self, ticker: str, lookback_days: int) -> List[BuyingSignal]:
        """Get signals for ticker"""
        try:
            company = Company(ticker)
            filings = company.get_filings(form='8-K')
            
            signals = []
            # cutoff = datetime.now() - timedelta(days=lookback_days)
            
            for filing in list(filings)[:5]:  # Limit to 5 most recent
                # if filing.filing_date < cutoff:
                #     break
                
                try:
                    text_data = self.text_extractor.extract_from_8k(filing)
                    
                    if text_data['combined_text']:
                        sigs = self.signal_detector.extract_signals(
                            text=text_data['combined_text'],
                            company=filing.company,
                            ticker=ticker,
                            filing_date=filing.filing_date,
                            filing_url=filing.homepage_url,
                            items=text_data['items']
                        )
                        signals.extend(sigs)
                except:
                    continue
            
            return signals
        except:
            return []
    
    def _save_intelligence(self, intelligence: CustomerIntelligence):
        """Save to database"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''INSERT INTO intelligence (ticker, saas_client, generated_at, intelligence)
                     VALUES (?, ?, ?, ?)''',
                 (intelligence.enterprise_customer.ticker,
                  intelligence.saas_client.name,
                  intelligence.generated_at.isoformat(),
                  json.dumps(asdict(intelligence), default=str)))
        conn.commit()
        conn.close()
    
    def get_customer_stats(self, saas_client_name: str) -> Dict[str, Any]:
        """Get statistics about customers for a SaaS client"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        # Total customers
        c.execute('SELECT COUNT(*) FROM enterprise_customers WHERE saas_client = ?',
                 (saas_client_name,))
        total = c.fetchone()[0]

        # Customers by recency
        now = datetime.now()
        stats = {
            'total': total,
            'last_7_days': 0,
            'last_30_days': 0,
            'last_90_days': 0,
            'older': 0
        }

        c.execute('SELECT last_seen FROM enterprise_customers WHERE saas_client = ?',
                 (saas_client_name,))
        for (last_seen,) in c.fetchall():
            if not last_seen:
                stats['older'] += 1
                continue

            last_seen_dt = datetime.fromisoformat(last_seen)
            days_ago = (now - last_seen_dt).days

            if days_ago <= 7:
                stats['last_7_days'] += 1
            elif days_ago <= 30:
                stats['last_30_days'] += 1
            elif days_ago <= 90:
                stats['last_90_days'] += 1
            else:
                stats['older'] += 1

        conn.close()
        return stats

    def generate_report(self, intelligence: CustomerIntelligence) -> str:
        """Generate formatted report with persona insights"""

        sig = intelligence.signal
        cust = intelligence.enterprise_customer

        # Build persona insights section
        persona_section = ""
        if intelligence.persona_insights:
            persona_section = "\n\n" + "="*80 + "\n"
            persona_section += "👥 PERSONA-SPECIFIC INSIGHTS\n"
            persona_section += "="*80 + "\n"

            for insight in intelligence.persona_insights:
                relevance_emoji = "🔥" if insight.relevance_score > 0.8 else "⭐" if insight.relevance_score > 0.6 else "📌"
                persona_section += f"\n{relevance_emoji} {insight.persona_role} (Relevance: {insight.relevance_score:.1f}/1.0)\n"
                persona_section += f"{'-'*80}\n"
                persona_section += f"\nWhy This Matters:\n{insight.why_this_matters}\n"
                persona_section += f"\nTalking Points:\n"
                for i, point in enumerate(insight.specific_talking_points, 1):
                    persona_section += f"  {i}. {point}\n"
                persona_section += f"\nRecommended Products: {', '.join(insight.recommended_products)}\n"
                persona_section += f"\nKey Metrics to Highlight: {', '.join(insight.key_metrics_to_highlight)}\n"
                persona_section += f"\nSuggested Approach:\n{insight.suggested_approach}\n"

        # Build context section
        context_section = ""
        if intelligence.relevant_products or intelligence.matching_icp_segments:
            context_section = "\n\n" + "="*80 + "\n"
            context_section += "🎯 CONTEXT & FIT ANALYSIS\n"
            context_section += "="*80 + "\n"
            if intelligence.relevant_products:
                context_section += f"\nRelevant Products: {', '.join(intelligence.relevant_products)}\n"
            if intelligence.relevant_pricing_tiers:
                context_section += f"Suggested Pricing Tiers: {', '.join(intelligence.relevant_pricing_tiers)}\n"
            if intelligence.matching_icp_segments:
                context_section += f"Matching ICP Segments: {', '.join(intelligence.matching_icp_segments)}\n"

        return f"""
{'='*80}
🎯 CUSTOMER INTELLIGENCE REPORT
For: {intelligence.saas_client.name}
{'='*80}

YOUR CUSTOMER: {cust.company_name} ({cust.ticker})

SIGNAL: {sig.signal_type.upper().replace('_', ' ')}
Date: {sig.filing_date.strftime('%Y-%m-%d')}
Summary: {sig.summary}

ANALYSIS:
{intelligence.signal_implications}

RELATIONSHIP IMPACT:
{intelligence.relationship_impact}

OPPORTUNITY: {intelligence.opportunity_type.upper()}
Urgency: {'🔴 HIGH' if intelligence.urgency_score > 0.7 else '🟡 MEDIUM' if intelligence.urgency_score > 0.4 else '🟢 LOW'}
Value: {intelligence.estimated_opportunity_value}
{context_section}{persona_section}

{'='*80}
📋 RECOMMENDED ACTION
{'='*80}
{intelligence.recommended_action}

SUGGESTED EMAIL:
{intelligence.suggested_email}

GENERAL TALKING POINTS:
{chr(10).join(f'  • {point}' for point in intelligence.talking_points)}

Filing: {sig.filing_url}
Generated: {intelligence.generated_at.strftime('%Y-%m-%d %H:%M')}
Confidence: {intelligence.confidence_score:.0%}
"""


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

async def main():
    """Example: Onboard Salesforce and monitor their customers"""

    # Initialize platform
    import os
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")

    platform = CustomerIntelligencePlatform(
        openai_api_key=openai_api_key,
        db_path="customer_intel.db"
    )

    # Define Salesforce - ONLY name is required, everything else is auto-researched!
    salesforce = SaaSClient(name="Salesforce")

    # Onboard: Research company + discover customers
    # deep_research=True (default) will automatically populate:
    #   - industry, product_description, pricing_model
    #   - products, pricing_tiers, ICPs, GTM personas
    #   - expansion opportunities, churn indicators
    # Returns list of discovered customers (also saved to DB with timestamp)
    discovered_customers = await platform.onboard_saas_client(salesforce, "salesforce.com")
    print(f"\nDiscovered {len(discovered_customers)} enterprise customers")

    # View customer statistics
    stats = platform.get_customer_stats("Salesforce")
    print(f"\nCustomer Database Stats:")
    print(f"  Total: {stats['total']}")
    print(f"  Last 7 days: {stats['last_7_days']}")
    print(f"  Last 30 days: {stats['last_30_days']}")
    print(f"  Last 90 days: {stats['last_90_days']}")
    print(f"  Older than 90 days: {stats['older']}")

    # Monitor: Check for signals
    # Loads RECENT customers from database (last 90 days by default) and analyzes SEC filings
    # Use customer_age_days parameter to adjust the recency window
    intelligence_reports = await platform.monitor_client_customers("Salesforce", lookback_days=30, customer_age_days=90)

    # Generate reports
    for intel in intelligence_reports:
        report = platform.generate_report(intel)
        print(report)

        # Save to file
        filename = f"report_{intel.saas_client.name}_{intel.enterprise_customer.ticker}.txt"
        with open(filename, 'w') as f:
            f.write(report)


if __name__ == "__main__":
    asyncio.run(main())