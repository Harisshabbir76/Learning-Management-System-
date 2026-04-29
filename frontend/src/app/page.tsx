"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const router = useRouter();

  useEffect(() => {
    setIsVisible(true);

    // Auto-rotate features
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 3);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleSignupRedirect = () => {
    router.push("/signup");
  };

  const handleLoginRedirect = () => {
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-hidden font-sans">
      {/* Permanent Toast Message */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3 backdrop-blur-sm border border-white/20">
          <i className="fas fa-lock"></i>
          <span className="font-medium text-sm">
            Go to{" "}
            <button
              onClick={handleLoginRedirect}
              className="font-bold underline underline-offset-2 hover:text-amber-100 transition-colors"
            >
              Login Page
            </button>{" "}
            - Use credentials: demo@school.com / demo123
          </span>
          <i className="fas fa-sparkles animate-pulse"></i>
        </div>
      </div>

      {/* Header with Auth Buttons */}
      <div className="relative z-20">
        <div className="container mx-auto px-4 py-6 flex justify-end items-center space-x-4">
          <button
            onClick={handleLoginRedirect}
            className="px-6 py-2.5 bg-white/80 backdrop-blur-sm text-gray-700 rounded-full font-semibold shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 border border-gray-200"
          >
            <i className="fas fa-key mr-2 opacity-50"></i> Login
          </button>
          <button
            onClick={handleSignupRedirect}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-semibold shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Sign Up
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow"></div>
          <div
            className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow"
            style={{ animationDelay: "2s" }}
          ></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-float"></div>
        </div>

        <div className="relative z-10 container mx-auto px-4 py-16">
          <div
            className={`text-center transition-all duration-1000 ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            <div className="mb-4">
              <span className="inline-block px-4 py-2 bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-800 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 shadow-md">
                School Transformation Platform
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Transform Your School
              </span>
              <span className="block bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                Into A Digital Hub
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-4xl mx-auto leading-relaxed">
              Upgrade your traditional school with our comprehensive LMS
              platform. From chalkboards to smartboards, modernize every aspect of your educational
              institution.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <button
                onClick={handleSignupRedirect}
                className="px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-bold text-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 hover-lift"
              >
                Get Started
              </button>
              <button
                onClick={handleLoginRedirect}
                className="px-10 py-4 bg-white text-gray-700 rounded-full font-bold text-lg shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border border-gray-200 hover:border-blue-300"
              >
                Explore Demo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white/50 backdrop-blur-sm relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Advanced Management Features</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Enterprise-grade tools for comprehensive digital transformation</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon="fas fa-building-columns"
              title="ERP Integration"
              desc="Complete management system with student info, finance, and HR tools."
            />
            <FeatureCard 
              icon="fas fa-mobile-screen-button"
              title="Multi-Platform"
              desc="Access from anywhere via web, tablets, or mobile applications."
            />
            <FeatureCard 
              icon="fas fa-brain"
              title="AI Insights"
              desc="Advanced analytics for personalized learning and performance analysis."
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-16 bg-gray-900 text-white relative z-10">
        <div className="container mx-auto px-4 text-center">
          <div className="text-2xl font-bold mb-6">
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent uppercase tracking-tighter">
              Antigravity LMS
            </span>
          </div>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Empowering educational institutions through seamless digital transformation.
          </p>
          <div className="flex justify-center space-x-8 text-gray-500 text-xs font-bold uppercase tracking-widest mb-8">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em]">
            &copy; 2024 Antigravity Systems. All Rights Reserved.
          </div>
        </div>
      </footer>

      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

      <style jsx>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-20px); }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateX(-50%) translateY(-100%); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .animate-pulse-slow { animation: pulse-slow 6s ease-in-out infinite; }
        .animate-float { animation: float 8s ease-in-out infinite; }
        .animate-slide-down { animation: slide-down 0.5s ease-out forwards; }
        .hover-lift { transition: all 0.3s ease; }
        .hover-lift:hover { transform: translateY(-4px); shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
      `}</style>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <div className="p-10 rounded-3xl bg-white border border-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 group">
      <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:bg-primary group-hover:text-white transition-all">
        <i className={icon}></i>
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
