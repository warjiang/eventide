import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    return (
        <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Custom styling for code blocks
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                            <div className="rounded-md bg-muted/50 p-3 my-2 overflow-x-auto">
                                <pre className="text-xs font-mono">
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                </pre>
                            </div>
                        ) : (
                            <code
                                className="px-1.5 py-0.5 rounded bg-muted/50 text-xs font-mono"
                                {...props}
                            >
                                {children}
                            </code>
                        )
                    },
                    // Custom styling for links
                    a({ children, ...props }: any) {
                        return (
                            <a
                                className="text-primary hover:underline cursor-pointer"
                                target="_blank"
                                rel="noopener noreferrer"
                                {...props}
                            >
                                {children}
                            </a>
                        )
                    },
                    // Custom styling for lists
                    ul({ children, ...props }: any) {
                        return (
                            <ul className="list-disc list-inside space-y-1 my-2" {...props}>
                                {children}
                            </ul>
                        )
                    },
                    ol({ children, ...props }: any) {
                        return (
                            <ol className="list-decimal list-inside space-y-1 my-2" {...props}>
                                {children}
                            </ol>
                        )
                    },
                    // Custom styling for headings
                    h1({ children, ...props }: any) {
                        return (
                            <h1 className="text-lg font-semibold my-3" {...props}>
                                {children}
                            </h1>
                        )
                    },
                    h2({ children, ...props }: any) {
                        return (
                            <h2 className="text-base font-semibold my-2" {...props}>
                                {children}
                            </h2>
                        )
                    },
                    h3({ children, ...props }: any) {
                        return (
                            <h3 className="text-sm font-semibold my-2" {...props}>
                                {children}
                            </h3>
                        )
                    },
                    // Custom styling for paragraphs
                    p({ children, ...props }: any) {
                        return (
                            <p className="leading-relaxed my-2" {...props}>
                                {children}
                            </p>
                        )
                    },
                    // Custom styling for blockquotes
                    blockquote({ children, ...props }: any) {
                        return (
                            <blockquote
                                className="border-l-2 border-border pl-3 italic text-muted-foreground my-2"
                                {...props}
                            >
                                {children}
                            </blockquote>
                        )
                    },
                    // Custom styling for tables
                    table({ children, ...props }: any) {
                        return (
                            <div className="overflow-x-auto my-2">
                                <table
                                    className="w-full text-xs border-collapse border border-border"
                                    {...props}
                                >
                                    {children}
                                </table>
                            </div>
                        )
                    },
                    thead({ children, ...props }: any) {
                        return (
                            <thead className="bg-muted/50" {...props}>
                                {children}
                            </thead>
                        )
                    },
                    th({ children, ...props }: any) {
                        return (
                            <th
                                className="border border-border px-2 py-1 text-left font-semibold"
                                {...props}
                            >
                                {children}
                            </th>
                        )
                    },
                    td({ children, ...props }: any) {
                        return (
                            <td className="border border-border px-2 py-1" {...props}>
                                {children}
                            </td>
                        )
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
