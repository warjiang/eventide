import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Send, Loader2 } from 'lucide-react'
import { Paperclip, X } from 'lucide-react'
import { FileUploadResult, uploadFile } from '@/api'

interface ChatInputProps {
    onSend: (text: string, files?: FileUploadResult[]) => void;
    disabled: boolean;
    placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
    const [text, setText] = useState('')
    const [files, setFiles] = useState<FileUploadResult[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!disabled) {
            inputRef.current?.focus()
        }
    }, [disabled])

    function handleSend() {
        const trimmed = text.trim()
        if ((!trimmed && files.length === 0) || disabled || isUploading) return
        onSend(trimmed, files.length > 0 ? files : undefined)
        setText('')
        setFiles([])
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files?.length) return

        setIsUploading(true)
        try {
            const uploadedFiles: FileUploadResult[] = []
            for (let i = 0; i < e.target.files.length; i++) {
                const file = e.target.files[i]
                const result = await uploadFile(file)
                uploadedFiles.push(result)
            }
            setFiles(prev => [...prev, ...uploadedFiles])
        } catch (err) {
            console.error('Failed to upload files:', err)
            // You might want to show a toast notification here
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    function removeFile(index: number) {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    return (
        <div className="px-3 pb-3 flex flex-col gap-2">
            {files.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                    {files.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-surface/50 border border-border text-xs rounded-md pl-2 pr-1 py-1">
                            <Paperclip className="w-3 h-3 text-muted-foreground" />
                            <span className="truncate max-w-[150px]">{file.name}</span>
                            <button
                                onClick={() => removeFile(idx)}
                                className="p-0.5 hover:bg-muted-foreground/20 rounded-sm text-muted-foreground transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div className="relative flex items-end gap-2 bg-transparent border border-border/40 rounded-xl px-4 py-3 focus-within:border-primary/40 focus-within:shadow-sm transition-all duration-200">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    multiple
                />
                <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled || isUploading}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-surface/50 transition-colors"
                >
                    <Paperclip className="w-4 h-4" />
                </Button>
                <textarea
                    ref={inputRef}
                    className="flex-1 min-h-[24px] max-h-[160px] bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none leading-relaxed py-0.5"
                    placeholder={placeholder || 'Message the agent...'}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled || isUploading}
                    rows={1}
                />
                <Button
                    onClick={handleSend}
                    disabled={disabled || isUploading || (!text.trim() && files.length === 0)}
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
                >
                    {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : disabled ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
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
