import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Send } from 'lucide-react'

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
        <div>
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-end gap-3 bg-background/80 backdrop-blur-xl border border-border/60 rounded-2xl shadow-lg px-5 py-4 focus-within:border-primary/40 focus-within:shadow-xl transition-all duration-300">
                    <textarea
                        ref={inputRef}
                        className="flex-1 min-h-[28px] max-h-[200px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none leading-relaxed py-1"
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
                        <Send className="w-4 h-4" />
                        <span className="sr-only">Send message</span>
                    </Button>
                </div>
            </div>
        </div>
    )
}
