import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { useThemeStore } from './entities/theme/store'

// Hydrate theme before first render
useThemeStore.getState();

createRoot(document.getElementById('root')!).render(
  // StrictMode disabled during WebRTC dev to prevent double joins
  <RouterProvider router={router} />
)
