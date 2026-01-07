
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
            <a href="#features" className="hover:text-white transition-colors">Herramientas</a>
            <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
            <a href="#" className="hover:text-white transition-colors">Contacto</a>
          </div>

          <button 
            onClick={handleEnterApp}
            className="group flex items-center gap-2 bg-white text-slate-950 hover:bg-slate-200 px-5 py-2.5 rounded-full text-sm font-semibold transition-all"
          >
            Ingresar
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            Nuevas Herramientas: Reuniones y Redacción AI
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            Automatización 360° para <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">Tu Empresa</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            Desde gestionar nóminas complejas hasta <span className="text-slate-200 font-semibold">generar actas de reunión automáticamente</span>. 
            Todas las herramientas que necesitas para escalar, impulsadas por Inteligencia Artificial.
          </p>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <button 
              onClick={handleEnterApp}
              className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1"
            >
              Probar Herramientas
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
          <p className="text-slate-400">Una suite completa dividida en Productividad, Comunicación y Finanzas.</p>
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
              <h3 className="text-3xl font-bold text-white mb-4">Chronos Audio Intelligence</h3>
              <p className="text-slate-400 text-lg max-w-md">
                Transforma horas de notas de voz de WhatsApp y archivos de audio en conocimiento estructurado. 
                Transcripción masiva, resúmenes ejecutivos y búsqueda inteligente.
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

          {/* Card 2: Meeting Analyst */}
          <div className="group relative overflow-hidden rounded-3xl bg-slate-900 border border-white/5 p-8 flex flex-col justify-between hover:border-indigo-500/30 transition-all">
            <div>
              <div className="flex justify-between items-start mb-4">
                 <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                 </div>
                 <span className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-300 text-xs font-mono border border-indigo-500/20">Nuevo</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Analista de Reuniones</h3>
              <p className="text-slate-400 text-sm">Deja de perder tiempo haciendo actas. Obtén resumen, tareas y decisiones clave al instante.</p>
            </div>
          </div>

          {/* Card 3: Smart Redactor */}
          <div className="group relative overflow-hidden rounded-3xl bg-slate-900 border border-white/5 p-8 flex flex-col justify-between hover:border-fuchsia-500/30 transition-all">
             <div>
              <div className="flex justify-between items-start mb-4">
                 <div className="w-10 h-10 bg-fuchsia-500/20 rounded-lg flex items-center justify-center text-fuchsia-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                 </div>
                 <span className="px-2 py-1 rounded bg-fuchsia-500/10 text-fuchsia-300 text-xs font-mono border border-fuchsia-500/20">Nuevo</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Redactor Inteligente</h3>
              <p className="text-slate-400 text-sm">Convierte notas rápidas en emails profesionales o mensajes de WhatsApp perfectos en segundos.</p>
            </div>
          </div>

          {/* Card 4: Financial Suite */}
          <div className="md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-3xl bg-slate-900 border border-white/5 p-8 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
             <div>
              <div className="flex justify-between items-start mb-4">
                 <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                 </div>
                 <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-xs font-mono border border-slate-700">Suite</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Finanzas</h3>
              <p className="text-slate-400 text-sm">Control total de Nómina, Presupuestos, Ingresos y Flujo de Caja en una sola plataforma.</p>
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
                Obtén acceso ilimitado a todas las herramientas de IA hoy y sé el primero en probar nuestras nuevas funciones.
              </p>

              <div className="flex flex-col gap-4 text-left max-w-xs mx-auto mb-10">
                {['Acceso ilimitado a Chronos KB', 'Analista de Reuniones Pro', 'Redactor Inteligente', 'Suite Financiera Completa', 'Soporte Prioritario'].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-slate-300">
                    <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {item}
                  </div>
                ))}
              </div>

              <button 
                onClick={handleEnterApp}
                className="w-full bg-white text-slate-950 hover:bg-slate-200 font-bold py-4 rounded-xl transition-all"
              >
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
