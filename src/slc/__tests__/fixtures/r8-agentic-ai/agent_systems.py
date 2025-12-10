# R8 - Agentic AI Systems
# AutoGPT, CrewAI, LangGraph, OpenAI Assistants, Anthropic Tools

from openai import OpenAI
from anthropic import Anthropic
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor
from crewai import Agent, Task, Crew, Process
from typing import TypedDict, Annotated
import operator

# Initialize clients
openai_client = OpenAI()
anthropic_client = Anthropic()

# LangGraph state
class AgentState(TypedDict):
    messages: Annotated[list, operator.add]
    next: str

# OpenAI Assistants API - Agentic
def create_openai_assistant(name: str, instructions: str) -> str:
    """Create an OpenAI Assistant for agentic tasks"""
    assistant = openai_client.beta.assistants.create(
        name=name,
        instructions=instructions,
        model="gpt-4o",
        tools=[
            {"type": "code_interpreter"},
            {"type": "file_search"}
        ]
    )
    return assistant.id

def run_assistant_thread(assistant_id: str, message: str) -> str:
    """Run an assistant thread"""
    thread = openai_client.beta.threads.create()

    openai_client.beta.threads.messages.create(
        thread_id=thread.id,
        role="user",
        content=message
    )

    run = openai_client.beta.threads.runs.create_and_poll(
        thread_id=thread.id,
        assistant_id=assistant_id
    )

    messages = openai_client.beta.threads.messages.list(thread_id=thread.id)
    return messages.data[0].content[0].text.value

# Anthropic Tool Use - Agentic
def anthropic_tool_agent(query: str) -> str:
    """Anthropic agent with tool use"""
    tools = [
        {
            "name": "search_database",
            "description": "Search the internal database",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"}
                },
                "required": ["query"]
            }
        }
    ]

    response = anthropic_client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=4096,
        tools=tools,
        messages=[{"role": "user", "content": query}]
    )
    return response.content[0].text

# CrewAI Multi-Agent System
def crewai_research_team(topic: str) -> str:
    """CrewAI research team with multiple agents"""
    researcher = Agent(
        role='Senior Researcher',
        goal=f'Research {topic} thoroughly',
        backstory='Expert researcher with 20 years experience',
        llm=ChatOpenAI(model="gpt-4o", temperature=0.7)
    )

    analyst = Agent(
        role='Data Analyst',
        goal='Analyze research findings',
        backstory='Expert analyst specializing in data synthesis',
        llm=ChatAnthropic(model="claude-3-5-sonnet-20241022")
    )

    writer = Agent(
        role='Technical Writer',
        goal='Write clear technical documentation',
        backstory='Expert technical writer',
        llm=ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    )

    research_task = Task(
        description=f'Research {topic}',
        agent=researcher,
        expected_output='Comprehensive research findings'
    )

    analysis_task = Task(
        description='Analyze research findings',
        agent=analyst,
        expected_output='Data analysis report'
    )

    writing_task = Task(
        description='Write technical documentation',
        agent=writer,
        expected_output='Technical document'
    )

    crew = Crew(
        agents=[researcher, analyst, writer],
        tasks=[research_task, analysis_task, writing_task],
        process=Process.sequential
    )

    return crew.kickoff()

# LangGraph Agentic Workflow
def langgraph_agent(query: str) -> dict:
    """LangGraph multi-step agent workflow"""
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    def research_node(state: AgentState) -> dict:
        response = llm.invoke(state["messages"])
        return {"messages": [response], "next": "analyze"}

    def analyze_node(state: AgentState) -> dict:
        response = llm.invoke(state["messages"])
        return {"messages": [response], "next": "respond"}

    def respond_node(state: AgentState) -> dict:
        response = llm.invoke(state["messages"])
        return {"messages": [response], "next": END}

    workflow = StateGraph(AgentState)
    workflow.add_node("research", research_node)
    workflow.add_node("analyze", analyze_node)
    workflow.add_node("respond", respond_node)

    workflow.set_entry_point("research")
    workflow.add_edge("research", "analyze")
    workflow.add_edge("analyze", "respond")
    workflow.add_edge("respond", END)

    app = workflow.compile()
    result = app.invoke({"messages": [query], "next": "research"})
    return result

# OpenAI Function Calling - Agentic Loop
def openai_function_agent(query: str) -> str:
    """OpenAI agent with function calling loop"""
    functions = [
        {
            "name": "execute_code",
            "description": "Execute Python code",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string"}
                },
                "required": ["code"]
            }
        }
    ]

    messages = [{"role": "user", "content": query}]

    # Agentic loop
    while True:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            functions=functions,
            function_call="auto"
        )

        if response.choices[0].finish_reason == "stop":
            return response.choices[0].message.content

        # Handle function call
        func_call = response.choices[0].message.function_call
        if func_call:
            # Execute function and continue loop
            result = f"Executed: {func_call.arguments}"
            messages.append({"role": "function", "name": func_call.name, "content": result})
