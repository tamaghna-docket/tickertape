"""
Demo script showing how to use OpenAI Traces API with Agents SDK
to visualize reasoning steps and tool calls in real-time
"""

import asyncio
import time
from typing import Optional
from openai import OpenAI
from agents import Agent, Runner, WebSearchTool, ModelSettings
from openai.types.shared import Reasoning

# Initialize OpenAI client for traces
import os
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY environment variable not set")
client = OpenAI(api_key=api_key)


def print_span(span: dict, indent: int = 0):
    """Pretty print a trace span with its children"""
    prefix = "  " * indent

    # Print span header
    span_type = span.get('type', 'unknown')
    name = span.get('name', 'unnamed')

    if span_type == 'reasoning':
        print(f"{prefix}🧠 REASONING: {name}")
    elif 'tool' in name.lower() or 'tool' in span_type.lower():
        tool_name = span.get('tool_name', span.get('metadata', {}).get('tool_name', 'unknown'))
        print(f"{prefix}🔧 TOOL CALL: {tool_name}")
    elif 'model' in name.lower():
        print(f"{prefix}🤖 MODEL: {name}")
    else:
        print(f"{prefix}📋 {name}")

    # Print input/output if available
    if span.get('input'):
        input_str = str(span['input'])[:100]
        print(f"{prefix}   Input: {input_str}...")

    if span.get('output'):
        output_str = str(span['output'])[:100]
        print(f"{prefix}   Output: {output_str}...")

    # Print metadata
    if span.get('metadata'):
        for key, value in span['metadata'].items():
            if key not in ['input', 'output']:
                print(f"{prefix}   {key}: {value}")

    # Print children recursively
    if span.get('children'):
        for child in span['children']:
            print_span(child, indent + 1)

    print()


def monitor_trace(trace_id: str, poll_interval: float = 1.0, max_polls: int = 30):
    """
    Poll the trace API to monitor execution in real-time

    Args:
        trace_id: The trace ID from Runner.run()
        poll_interval: How often to poll (seconds)
        max_polls: Maximum number of polls before giving up
    """
    print(f"\n{'='*80}")
    print(f"🔍 MONITORING TRACE: {trace_id}")
    print(f"{'='*80}\n")

    last_span_count = 0

    for poll_num in range(max_polls):
        try:
            # Retrieve the trace
            trace = client.traces.retrieve(trace_id)

            status = trace.get('status', 'unknown')
            spans = trace.get('spans', [])

            # Check if there are new spans
            if len(spans) > last_span_count:
                print(f"\n📊 Poll #{poll_num + 1} - Status: {status} - Spans: {len(spans)}")
                print("-" * 80)

                # Print only new spans
                for span in spans[last_span_count:]:
                    print_span(span)

                last_span_count = len(spans)

            # If completed, break
            if status == 'completed' or status == 'failed':
                print(f"\n✅ Trace {status.upper()}")
                break

            # Wait before next poll
            time.sleep(poll_interval)

        except Exception as e:
            print(f"❌ Error polling trace: {e}")
            break
    else:
        print(f"\n⚠️  Stopped after {max_polls} polls")


async def run_agent_with_trace_monitoring():
    """Run an agent and monitor its trace in real-time"""

    # Create an agent with web search
    agent = Agent(
        name="ResearchAgent",
        tools=[WebSearchTool()],
        instructions="""You are a research assistant.
        Use web search to find accurate, up-to-date information.
        Provide detailed answers based on your research.""",
        model="gpt-5",
        model_settings=ModelSettings(
            reasoning=Reasoning(effort="high")
        )
    )

    # Run the agent
    query = "Who is the current CEO of OpenAI and what major announcements did they make in 2025?"

    print(f"\n{'='*80}")
    print(f"🚀 RUNNING AGENT")
    print(f"{'='*80}")
    print(f"Query: {query}\n")

    result = await Runner.run(agent, query)

    # Get trace ID
    trace_id = getattr(result, 'trace_id', None)

    if trace_id:
        print(f"\n✅ Run completed! Trace ID: {trace_id}")

        # Monitor the trace
        monitor_trace(trace_id, poll_interval=0.5, max_polls=20)

        # Print final output
        print(f"\n{'='*80}")
        print(f"📝 FINAL OUTPUT")
        print(f"{'='*80}")
        print(result.final_output)

    else:
        print("\n⚠️  No trace_id found in result")
        print("Note: Tracing might not be enabled by default")
        print("\nFinal output:")
        print(result.final_output)


class TraceMonitor:
    """
    Custom class to monitor traces with callbacks
    """

    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.seen_spans = set()

    async def monitor_async(self, trace_id: str,
                           on_new_span=None,
                           on_reasoning=None,
                           on_tool_call=None,
                           poll_interval: float = 0.5,
                           max_polls: int = 60):
        """
        Asynchronously monitor a trace with callbacks

        Args:
            trace_id: Trace ID to monitor
            on_new_span: Callback(span) for any new span
            on_reasoning: Callback(span) for reasoning steps
            on_tool_call: Callback(span) for tool calls
            poll_interval: Poll frequency in seconds
            max_polls: Maximum polls before stopping
        """
        for _ in range(max_polls):
            try:
                trace = self.client.traces.retrieve(trace_id)
                status = trace.get('status', 'unknown')
                spans = trace.get('spans', [])

                # Process new spans
                for span in spans:
                    span_id = span.get('id') or str(span)

                    if span_id not in self.seen_spans:
                        self.seen_spans.add(span_id)

                        # Call generic callback
                        if on_new_span:
                            on_new_span(span)

                        # Call specific callbacks
                        span_type = span.get('type', '')
                        name = span.get('name', '')

                        if 'reasoning' in span_type.lower() and on_reasoning:
                            on_reasoning(span)

                        if 'tool' in name.lower() or 'tool' in span_type.lower():
                            if on_tool_call:
                                on_tool_call(span)

                        # Process children
                        if span.get('children'):
                            for child in span['children']:
                                child_id = child.get('id') or str(child)
                                if child_id not in self.seen_spans:
                                    self.seen_spans.add(child_id)

                                    if on_new_span:
                                        on_new_span(child)

                                    child_type = child.get('type', '')
                                    child_name = child.get('name', '')

                                    if 'reasoning' in child_type.lower() and on_reasoning:
                                        on_reasoning(child)

                                    if 'tool' in child_name.lower() and on_tool_call:
                                        on_tool_call(child)

                # Check if done
                if status in ('completed', 'failed', 'error'):
                    return status

                # Wait before next poll
                await asyncio.sleep(poll_interval)

            except Exception as e:
                print(f"Error monitoring trace: {e}")
                return 'error'

        return 'timeout'


async def demo_custom_monitor():
    """Demo using the custom TraceMonitor class"""

    print(f"\n{'='*80}")
    print(f"🎯 DEMO: Custom Trace Monitor with Callbacks")
    print(f"{'='*80}\n")

    # Create agent
    agent = Agent(
        name="SearchAgent",
        tools=[WebSearchTool()],
        instructions="Use web search to answer questions accurately.",
        model="gpt-5",
        model_settings=ModelSettings(reasoning=Reasoning(effort="high"))
    )

    # Run agent
    query = "What are the top 3 enterprise customers of Salesforce in 2025?"
    print(f"Query: {query}\n")

    result = await Runner.run(agent, query)

    trace_id = getattr(result, 'trace_id', None)

    if not trace_id:
        print("⚠️  No trace ID available")
        return

    print(f"Trace ID: {trace_id}\n")

    # Create monitor with callbacks
    monitor = TraceMonitor(api_key=client.api_key)

    # Define callbacks
    def on_reasoning(span):
        print(f"🧠 Reasoning detected: {span.get('output', '')[:80]}...")

    def on_tool_call(span):
        tool_name = span.get('tool_name', 'unknown')
        tool_input = span.get('input', '')[:60]
        print(f"🔧 Tool call: {tool_name} | Input: {tool_input}...")

    def on_any_span(span):
        print(f"📋 New span: {span.get('name', 'unnamed')} [{span.get('type', 'unknown')}]")

    # Monitor the trace
    final_status = await monitor.monitor_async(
        trace_id,
        on_new_span=on_any_span,
        on_reasoning=on_reasoning,
        on_tool_call=on_tool_call,
        poll_interval=0.5
    )

    print(f"\n✅ Monitoring complete - Status: {final_status}")
    print(f"\n📝 Final output:\n{result.final_output}")


if __name__ == "__main__":
    print("OpenAI Agents SDK - Trace Monitoring Demo\n")

    # Run the basic demo
    asyncio.run(run_agent_with_trace_monitoring())

    print("\n" + "="*80 + "\n")

    # Run the custom monitor demo
    asyncio.run(demo_custom_monitor())
