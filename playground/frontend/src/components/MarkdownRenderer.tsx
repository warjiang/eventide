import { Streamdown } from 'streamdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    return (
        <div className={`prose prose-sm dark:prose-invert max-w-none [&_li>p]:my-0 [&_li>p]:inline [&_ul]:my-1 [&_ol]:my-1 leading-relaxed [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:text-[13px] [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-foreground [&_code::before]:hidden [&_code::after]:hidden ${className}`}>
            <Streamdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Custom styling for code block containers
                    pre({ children, ...props }: any) {
                        let languageMatch = null;
                        if (children && children.props && children.props.className) {
                            languageMatch = /language-(\w+)/.exec(children.props.className || '');
                        } else if (Array.isArray(children)) {
                            const codeChild = children.find((c: any) => c?.props?.className?.includes('language-'));
                            if (codeChild) {
                                languageMatch = /language-(\w+)/.exec(codeChild.props.className || '');
                            }
                        }

                        return (
                            <div className="not-prose my-4 rounded-lg border border-border bg-[#f6f8fa] dark:bg-[#0d1117] overflow-hidden shadow-sm">
                                {languageMatch && (
                                    <div className="flex items-center px-4 py-2 bg-muted/50 border-b border-border text-xs text-muted-foreground font-sans uppercase tracking-wider">
                                        {languageMatch[1]}
                                    </div>
                                )}
                                <div className="overflow-x-auto p-4">
                                    <pre className="text-[13px] leading-relaxed font-mono text-gray-900 dark:text-gray-100 bg-transparent m-0 p-0" {...props}>
                                        {children}
                                    </pre>
                                </div>
                            </div>
                        )
                    },
                    // Custom styling for code text
                    code({ node, inline, className, children, ...props }: any) {
                        return (
                            <code className={className} {...props}>
                                {typeof children === 'string' ? children.replace(/\n$/, '') : children}
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
