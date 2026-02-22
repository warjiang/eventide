import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"

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
        <div className="border-t border-border p-4 bg-background">
            <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 flex gap-3 items-end">
                <textarea
                    ref={inputRef}
                    className="flex-1 min-h-[44px] max-h-[120px] p-3 rounded-xl border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-shadow"
                    placeholder={placeholder || 'Type your prompt...'}
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
                    className="h-[44px] w-[44px] shrink-0 rounded-xl"
                >
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                        <path
                            d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <span className="sr-only">Send message</span>
                </Button>
            </div>
        </div>
    )
}
