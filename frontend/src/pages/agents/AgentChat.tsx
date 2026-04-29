import { useState, useRef, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Send, Bot, User, Loader2, Wrench } from "lucide-react"
import { agentsApi } from "@/api/agents"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import type { Agent, ChatMessage } from "@/types"

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user"
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-blue-600" : "bg-slate-700"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-white border text-slate-800 shadow-sm"
        }`}
      >
        {msg.isStreaming && !msg.content ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
        )}
      </div>
    </div>
  )
}

export function AgentChat() {
  const { name: agentNameParam } = useParams<{ name?: string }>()
  const navigate = useNavigate()

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: agentsApi.getAll,
  })

  const [selectedAgent, setSelectedAgent] = useState<string>(agentNameParam ?? "")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedAgent && agents.length > 0) {
      setSelectedAgent(agents[0].name)
    }
  }, [agents, selectedAgent])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !selectedAgent || isStreaming) return

    setInput("")
    setIsStreaming(true)
    setCurrentTool(null)

    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    const userMsg: ChatMessage = { role: "user", content: text }
    const assistantMsg: ChatMessage = { role: "assistant", content: "", isStreaming: true }

    setMessages((prev) => [...prev, userMsg, assistantMsg])

    await agentsApi.streamRun(
      selectedAgent,
      text,
      history,
      (type, content) => {
        if (type === "text") {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + content,
                isStreaming: true,
              }
            }
            return updated
          })
        } else if (type === "tool_call") {
          setCurrentTool(content)
        }
      },
      () => {
        setIsStreaming(false)
        setCurrentTool(null)
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, isStreaming: false }
          }
          return updated
        })
      },
      (error) => {
        setIsStreaming(false)
        setCurrentTool(null)
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: `Ошибка: ${error}` },
        ])
      }
    )
  }

  const agentInfo: Agent | undefined = agents.find((a) => a.name === selectedAgent)

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">AI Агенты</h1>
      </div>

      {/* Agent selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {agentsLoading ? (
          <p className="text-slate-400 text-sm">Загрузка агентов...</p>
        ) : (
          agents.map((agent) => (
            <Button
              key={agent.name}
              variant={selectedAgent === agent.name ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedAgent(agent.name)
                setMessages([])
              }}
            >
              <Bot className="h-3.5 w-3.5 mr-1.5" />
              {agent.display_name}
            </Button>
          ))
        )}
      </div>

      {agentInfo && (
        <p className="text-sm text-slate-500 mb-3">{agentInfo.description}</p>
      )}

      {/* Messages */}
      <Card className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Bot className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Начните диалог с агентом</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {currentTool && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pl-11">
            <Wrench className="h-3.5 w-3.5 animate-pulse" />
            Использую инструмент: {currentTool}
          </div>
        )}
        <div ref={bottomRef} />
      </Card>

      {/* Input */}
      <div className="flex gap-2 mt-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Напишите сообщение агенту..."
          disabled={isStreaming || !selectedAgent}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming || !selectedAgent}
          size="icon"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
