import { Streamdown } from 'streamdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    return (
        <div className={`prose prose-sm dark:prose-invert max-w-none [&_li>p]:my-0 [&_li>p]:inline [&_ul]:my-1 [&_ol]:my-1 leading-relaxed ${className}`}>
            <Streamdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Custom styling for code blocks
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                            <div className="not-prose my-4 rounded-lg border border-border bg-[#f6f8fa] dark:bg-[#0d1117] overflow-hidden shadow-sm">
                                <div className="flex items-center px-4 py-2 bg-muted/50 border-b border-border text-xs text-muted-foreground font-sans uppercase tracking-wider">
                                    {match[1]}
                                </div>
                                <div className="overflow-x-auto p-4">
                                    <pre className="text-[13px] leading-relaxed font-mono text-gray-900 dark:text-gray-100 bg-transparent m-0 p-0">
                                        <code className={className} {...props}>
                                            {String(children).replace(/\n$/, '')}
                                        </code>
                                    </pre>
                                </div>
                            </div>
                        ) : (
                            <code
                                className="px-1.5 py-0.5 rounded-md bg-muted text-[13px] font-mono text-foreground"
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
                            <ul className="list-disc list-inside space-y-0.5 my-1 ml-1" {...props}>
                                {children}
                            </ul>
                        )
                    },
                    ol({ children, ...props }: any) {
                        return (
                            <ol className="list-decimal list-outside space-y-0.5 my-1 ml-4" {...props}>
                                {children}
                            </ol>
                        )
                    },
                    li({ children, ...props }: any) {
                        return (
                            <li className="leading-relaxed my-0.5" {...props}>
                                {children}
                            </li>
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
                            <p className="leading-relaxed my-1" {...props}>
                                {children}
                            </p>
                        )
                    },
                    // Custom styling for blockquotes
                    blockquote({ children, ...props }: any) {
                        return (
                            <blockquote
                                className="border-l-2 border-border pl-3 italic text-muted-foreground my-1"
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
            </Streamdown>
        </div>
    )
}
