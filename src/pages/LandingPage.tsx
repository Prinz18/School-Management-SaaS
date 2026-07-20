// src/pages/LandingPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Shield, Users, BookOpen } from 'lucide-react';

const LandingPage: React.FC = () => {
  // Navigation removed as it was unused


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-6 md:px-12 py-6 bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <BookOpen className="text-white w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tighter text-slate-900 leading-none">LIBERIA</span>
            <span className="text-[10px] font-black tracking-[0.2em] text-blue-600">SCHOOLS PORTAL</span>
          </div>
        </div>
        <div className="flex gap-4">
          <Link to="/login" className="hidden md:block px-6 py-2.5 font-bold text-slate-500 hover:text-indigo-600 transition text-sm">Sign In</Link>
          <Link to="/login" className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition text-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 md:px-12 py-24 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black tracking-widest uppercase mb-8 border border-indigo-100">
          <Zap className="w-3 h-3" /> v2.0 Released
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-8 text-slate-900">
          The operating system for <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">modern education.</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-500 font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
          Streamline administration, empower teachers, and engage students with a beautiful, all-in-one SaaS platform designed for the future of learning.
        </p>
        
        <div className="flex flex-col md:flex-row justify-center gap-4 mb-24">
          <Link 
            to="/login"
            className="flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition md:w-auto w-full"
          >
            Launch Your Dashboard <Shield className="w-4 h-4 ml-1 text-slate-400" />
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="p-10 bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-100 hover:border-indigo-100 transition duration-300">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
              <Shield className="text-indigo-600 w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900">Enterprise Security</h3>
            <p className="text-slate-500 leading-relaxed text-sm font-medium">Bank-grade data isolation ensures that every school's sensitive records remain private, secure, and compliant.</p>
          </div>
          <div className="p-10 bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-100 hover:border-emerald-100 transition duration-300">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
              <Zap className="text-emerald-600 w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900">Real-time Sync</h3>
            <p className="text-slate-500 leading-relaxed text-sm font-medium">Instant grade uploads, attendance tracking, and automated report cards generated in milliseconds.</p>
          </div>
          <div className="p-10 bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-100 hover:border-purple-100 transition duration-300">
            <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mb-6">
              <Users className="text-purple-600 w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900">Role-Based Access</h3>
            <p className="text-slate-500 leading-relaxed text-sm font-medium">Granular permissions for Super Admins, School Admins, Teachers, and Students out of the box.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 text-center bg-white">
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
          © 2026 EduCore SaaS Inc. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
