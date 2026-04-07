// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { UserProvider } from './context/UserContextApi.jsx'
import {process} from 'process';
import { Buffer } from 'buffer'

window.Buffer = Buffer
window.process = process;
window.global = window;
createRoot(document.getElementById('root')).render(
  // <StrictMode>
  <UserProvider>
    <App />
    </UserProvider>
  // </StrictMode>,
)
