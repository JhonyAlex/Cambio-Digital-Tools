import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleEnterApp = () => {
    navigate('/app/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-blue-500/30 font-sans overflow-x-hidden">
      
      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 w-full z-50 bg-[#020617]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              CD
            </div>
            <span className="font-bold text-lg tracking-tight text-white">CambioDigital Suite</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Características</a>
            <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
            <a href="#" className="hover:text-white transition-colors">Docs</a>
          </div>

          <button 
            onClick={handleEnterApp}
            className="group flex items-center gap-2 bg-white text-slate-950 hover:bg-slate-200 px-5 py-2.5 rounded-full text-sm font-semibold transition-all"
          >
            Launch App
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 group-hover:translate-x-1 transition-transform">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        {/* Ambient Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 rounded-[100%] blur-[120px] -z-10 pointer-events-none opacity-50" />
        
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            Nuevo: Chronos Audio Intelligence v1.0
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            Automatización Inteligente para <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">Empresas del Futuro</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            Potencia tu productividad con nuestra suite de herramientas de IA. 
            Desde transcripción y análisis de audio hasta gestión automatizada de flujos de trabajo.
          </p>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <button 
              onClick={handleEnterApp}
              className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1"
            >
              Comenzar Prueba Gratuita
            </button>
            <button className="w-full md:w-auto px-8 py-4 bg-slate-800/50 hover:bg-slate-800 text-white border border-white/5 rounded-full font-semibold transition-all hover:-translate-y-1">
              Ver Demo Interactiva
            </button>
          </div>
        </div>
      </section>

      {/* --- FEATURES (BENTO GRID) --- */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Todo lo que necesitas en un solo lugar</h2>
          <p className="text-slate-400">Herramientas diseñadas para escalar contigo.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(250px,auto)]">
          
          {/* Card 1: Chronos (Featured) */}
          <div className="md:col-span-2 md:row-span-2 group relative overflow-hidden rounded-3xl bg-slate-900 border border-white/5 p-8 flex flex-col justify-between hover:border-blue-500/30 transition-all duration-500">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-blue-600/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-blue-600/30 transition-all duration-500" />
            
            <div className="relative z-10">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6 text-blue-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-white mb-4">Audio Intelligence</h3>
              <p className="text-slate-400 text-lg max-w-md">
                Transforma horas de reuniones y notas de voz de WhatsApp en insights accionables en segundos. 
                Transcripción, resumen y detección de tareas automática.
              </p>
            </div>

            {/* Visual Abstract Representation of Audio */}
            <div className="mt-8 flex gap-2 opacity-50 group-hover:opacity-80 transition-opacity">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="w-3 bg-blue-500 rounded-full animate-pulse" style={{ height: Math.max(20, Math.random() * 80) + 'px', animationDelay: `${i * 0.1}s` }}></div>
              ))}
            </div>
            
            <button onClick={handleEnterApp} className="absolute bottom-8 right-8 flex items-center gap-2 text-blue-400 font-semibold group-hover:text-blue-300 transition-colors">
              Probar ahora <span className="text-xl">→</span>
            </button>
          </div>

          {/* Card 2: Chatbots */}
          <div className="group relative overflow-hidden rounded-3xl bg-slate-900 border border-white/5 p-8 flex flex-col justify-between hover:border-violet-500/30 transition-all">
            <div>
              <div className="flex justify-between items-start mb-4">
                 <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center text-violet-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12.375m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                 </div>
                 <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-xs font-mono border border-slate-700">Pronto</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">AI Chatbots Custom</h3>
              <p className="text-slate-400 text-sm">Asistentes 24/7 entrenados específicamente con la data y tono de tu empresa.</p>
            </div>
          </div>

          {/* Card 3: Reports */}
          <div className="group relative overflow-hidden rounded-3xl bg-slate-900 border border-white/5 p-8 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
             <div>
              <div className="flex justify-between items-start mb-4">
                 <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                 </div>
                 <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-xs font-mono border border-slate-700">Pronto</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Smart Reports</h3>
              <p className="text-slate-400 text-sm">Generación automática de informes ejecutivos y análisis de KPIs en tiempo real.</p>
            </div>
          </div>

          {/* Card 4: Luma */}
          <div className="md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-3xl bg-slate-900 border border-white/5 p-8 flex flex-col justify-between hover:border-pink-500/30 transition-all">
             <div>
              <div className="flex justify-between items-start mb-4">
                 <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center text-pink-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                 </div>
                 <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-xs font-mono border border-slate-700">Pronto</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Luma</h3>
              <p className="text-slate-400 text-sm">Gestor de instrucciones y automatizaciones para los clientes finales de la IA.</p>
            </div>
          </div>

        </div>
      </section>

      {/* --- PRICING --- */}
      <section id="pricing" className="py-20 px-6 border-t border-white/5 bg-[#020617]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-12">Planes simples para resultados complejos</h2>
          
          <div className="relative p-1 rounded-3xl bg-gradient-to-b from-blue-500/20 to-violet-500/20">
            <div className="bg-slate-900 rounded-[22px] p-8 md:p-12 border border-white/5">
              <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-sm font-semibold mb-6">
                Early Adopter Access
              </div>
              
              <div className="flex items-baseline justify-center gap-2 mb-6">
                <span className="text-5xl font-bold text-white">$50</span>
                <span className="text-slate-400">/ mes</span>
              </div>
              
              <p className="text-slate-400 mb-8 max-w-md mx-auto">
                Obtén acceso ilimitado a Audio Intelligence hoy y sé el primero en probar nuestras nuevas herramientas.
              </p>

              <div className="flex flex-col gap-4 text-left max-w-xs mx-auto mb-10">
                {['Acceso ilimitado a Chronos KB', 'Acceso Beta a nuevas herramientas', 'Soporte prioritario por email', 'Exportación de datos avanzada'].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-slate-300">
                    <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {item}
                  </div>
                ))}
              </div>

              <button className="w-full bg-white text-slate-900 hover:bg-slate-200 font-bold py-4 rounded-xl transition-all">
                Suscribirse Ahora
              </button>
              <p className="text-xs text-slate-500 mt-4">Sin compromiso. Cancela cuando quieras.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-12 px-6 border-t border-white/5 text-center md:text-left">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
               <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-white text-xs font-bold">CD</div>
               <span className="text-white font-bold">CambioDigital</span>
            </div>
            <p className="text-slate-500 text-sm">© 2024 CambioDigital Suite. Todos los derechos reservados.</p>
          </div>
          
          <div className="flex gap-6 text-slate-400 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacidad</a>
            <a href="#" className="hover:text-white transition-colors">Términos</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;