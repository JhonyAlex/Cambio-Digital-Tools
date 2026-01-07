
import React from 'react';
import { AppPermissions } from './types';

export type ToolGroup = 'productivity' | 'communication' | 'finance';

export interface ToolDef {
    id: string;
    label: string;
    shortLabel: string;
    path: string;
    perm: keyof AppPermissions;
    description: string;
    color: string; // Tailwind color class name (e.g., 'blue')
    group: ToolGroup;
    letter: string; // Avatar letters
    iconPath: React.ReactNode;
}

export const TOOLS: ToolDef[] = [
    {
        id: 'chronos',
        label: 'Chronos Audio Intelligence',
        shortLabel: 'Chronos KB',
        path: '/app/chronos',
        perm: 'canAccessChronos',
        description: 'Transforma horas de notas de voz de WhatsApp y archivos de audio en conocimiento estructurado.',
        color: 'blue',
        group: 'productivity',
        letter: 'Ch',
        iconPath: <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    },
    {
        id: 'meetings',
        label: 'Analista de Reuniones',
        shortLabel: 'Analista Reuniones',
        path: '/app/meetings',
        perm: 'canAccessMeetings',
        description: 'Extrae insights, tareas y decisiones de tus transcripciones de reuniones.',
        color: 'indigo',
        group: 'communication',
        letter: 'MA',
        iconPath: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    },
    {
        id: 'polisher',
        label: 'Redactor Inteligente',
        shortLabel: 'Redactor Textos',
        path: '/app/polisher',
        perm: 'canAccessPolisher',
        description: 'Mejora la calidad de tus textos al instante. Genera versiones para WhatsApp, Email y Documentos.',
        color: 'fuchsia',
        group: 'communication',
        letter: 'TP',
        iconPath: <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 00-1.423 1.423z" />
    },
    {
        id: 'budgets',
        label: 'Gestor de Presupuestos',
        shortLabel: 'Presupuestos',
        path: '/app/budgets',
        perm: 'canAccessBudgets',
        description: 'Crea cotizaciones profesionales, gestiona productos y analiza márgenes de ganancia.',
        color: 'cyan',
        group: 'finance',
        letter: 'P',
        iconPath: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    },
    {
        id: 'payroll',
        label: 'Nómina Ejecutiva',
        shortLabel: 'Nómina',
        path: '/app/payroll',
        perm: 'canAccessPayroll',
        description: 'Gestión financiera de personal, control presupuestal y reportes ejecutivos.',
        color: 'amber',
        group: 'finance',
        letter: '$$',
        iconPath: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    },
    {
        id: 'revenue',
        label: 'Control de Ingresos',
        shortLabel: 'Control Flujo',
        path: '/app/revenue',
        perm: 'canAccessRevenue',
        description: 'Gestión de flujo de caja, control de proyectos y análisis de rentabilidad.',
        color: 'emerald',
        group: 'finance',
        letter: 'IN',
        iconPath: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    },
    {
        id: 'wallet',
        label: 'Tesorería y Activos',
        shortLabel: 'Tesorería',
        path: '/app/wallet',
        perm: 'canAccessWallet',
        description: 'Control de disponibilidad bancaria, efectivo y billeteras digitales.',
        color: 'violet',
        group: 'finance',
        letter: 'W',
        iconPath: <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
    }
];

export const GROUPS = [
    { id: 'productivity', label: 'Archivos & IA', gradient: 'from-blue-500 to-cyan-500' },
    { id: 'communication', label: 'Comunicación', gradient: 'from-indigo-500 to-fuchsia-500' },
    { id: 'finance', label: 'Suite Financiera', gradient: 'from-amber-500 to-emerald-500' },
] as const;
