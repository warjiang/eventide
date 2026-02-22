import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Send, Sparkles } from 'lucide-react'

interface ChatInputProps {
    onSend: (text: string) => void;
    disabled: boolean;
    placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
    const [text, setText] = useState('')
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (!disabled) {
            inputRef.current?.focus()
        }
    }, [disabled])

    function handleSend() {
        const trimmed = text.trim()
        if (!trimmed || disabled) return
        onSend(trimmed)
        setText('')
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="px-3 pb-3">
            <div className="relative flex items-end gap-2 bg-transparent border border-border/40 rounded-xl px-4 py-3 focus-within:border-primary/40 focus-within:shadow-sm transition-all duration-200">
                <textarea
                    ref={inputRef}
                    className="flex-1 min-h-[24px] max-h-[160px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none leading-relaxed py-0.5"
                    placeholder={placeholder || 'Message the agent...'}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    rows={1}
                />
                <Button
                    onClick={handleSend}
                    disabled={disabled || !text.trim()}
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
                >
                    {disabled ? (
                        <Sparkles className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                    <span className="sr-only">Send message</span>
                </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5">
                Press <kbd className="px-1 py-0.5 rounded bg-surface/50 font-mono text-[9px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-surface/50 font-mono text-[9px]">Shift + Enter</kbd> for new line
            </p>
        </div>
    )
}
