import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'

createRoot(document.getElementById('root')!).render(
  // StrictMode disabled during WebRTC dev to prevent double joins
  <RouterProvider router={router} />
)
