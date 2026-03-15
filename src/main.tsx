import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App';
import './styles/globals.css' // Verifica que esta ruta a tu CSS global sea correcta

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)