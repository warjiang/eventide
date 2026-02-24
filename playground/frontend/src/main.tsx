import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <TooltipProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/chat/:sessionId" element={<App />} />
                    <Route path="/" element={<App />} />
                </Routes>
            </BrowserRouter>
        </TooltipProvider>
    </React.StrictMode>,
)
