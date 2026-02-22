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
        <div className="px-4 pb-4">
            <div className="relative group">

                <div className="relative flex items-end gap-3 bg-transparent backdrop-blur-xl border border-border/40 rounded-2xl shadow-lg px-5 py-4 focus-within:border-primary/40 focus-within:shadow-xl focus-within:shadow-primary/5 transition-all duration-300">
                    <textarea
                        ref={inputRef}
                        className="flex-1 min-h-[28px] max-h-[200px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none leading-relaxed py-1"
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
                        className="h-9 w-9 shrink-0 rounded-xl cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                    >
                        {disabled ? (
                            <Sparkles className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        <span className="sr-only">Send message</span>
                    </Button>
                </div>
            </div>
            <p className="text-[11px] text-muted-foreground/50 text-center mt-2">
                Press <kbd className="px-1.5 py-0.5 rounded bg-surface/50 font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-surface/50 font-mono text-[10px]">Shift + Enter</kbd> for new line
            </p>
        </div>
    )
}
