"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
    router.push('/signup');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-hidden">
      {/* Hero Section */}
      <div className="relative">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-slow" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-float"></div>
        </div>

        <div className="relative z-10 container mx-auto px-4 py-20">
          <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="mb-4">
              <span className="inline-block px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold mb-4">
                🏫 School Transformation Platform
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold gradient-text bg-clip-text text-transparent mb-6">
              Transform Your School Into A
              <span className="block">Digital Learning Hub</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
              Upgrade your traditional school with our comprehensive LMS platform. From chalkboards to smartboards, 
              from paper records to digital dashboards - modernize every aspect of your educational institution.
            </p>
            <div className="flex justify-center items-center">
              <button 
                onClick={handleSignupRedirect}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-semibold text-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300 hover:from-blue-700 hover:to-purple-700 hover-lift"
              >
                Start School Transformation
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transformation Journey Section */}
      <div className="py-20 bg-white/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className={`text-center mb-16 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-4xl font-bold text-gray-800 mb-4">From Traditional to Digital</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See how we're helping schools evolve from paper-based systems to cutting-edge digital learning environments.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-xl">📚</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Traditional School Challenges</h3>
                  <p className="text-gray-600">Paper-based records, manual attendance, limited parent communication</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 text-xl">⚡</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Digital Transformation</h3>
                  <p className="text-gray-600">Cloud-based systems, real-time analytics, seamless communication</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xl">🎯</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Modern Learning Outcomes</h3>
                  <p className="text-gray-600">Enhanced engagement, better performance tracking, improved collaboration</p>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl p-8 shadow-xl">
                <div className="text-center">
                  <div className="text-6xl mb-4">🏫➡️💻</div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">Transformation Timeline</h3>
                  <div className="space-y-3 text-left">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-700">Week 1-2: System Setup & Training</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <span className="text-gray-700">Week 3-4: Data Migration & Testing</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-gray-700">Week 5-6: Full Implementation</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Features Section */}
      <div className="py-20 bg-gradient-to-r from-gray-50 to-blue-50">
        <div className="container mx-auto px-4">
          <div className={`text-center mb-16 transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Advanced School Management Features</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Beyond basic LMS - we provide enterprise-grade tools that modern schools need for comprehensive digital transformation.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "🏢",
                title: "School ERP Integration",
                description: "Complete school management system with student information, finance, HR, and administrative tools all in one platform.",
                color: "from-blue-500 to-blue-600",
                features: ["Student Database", "Financial Management", "HR & Payroll", "Asset Tracking"]
              },
              {
                icon: "📱",
                title: "Multi-Platform Access",
                description: "Access from anywhere - web, mobile apps, tablets. Perfect for teachers, students, parents, and administrators.",
                color: "from-purple-500 to-purple-600",
                features: ["Web Dashboard", "Mobile Apps", "Offline Mode", "Cross-Platform Sync"]
              },
              {
                icon: "🤖",
                title: "AI-Powered Insights",
                description: "Advanced analytics and AI recommendations for personalized learning paths and predictive performance analysis.",
                color: "from-indigo-500 to-indigo-600",
                features: ["Learning Analytics", "Performance Prediction", "Personalized Content", "Smart Assessments"]
              }
            ].map((feature, index) => (
              <div
                key={index}
                className={`group bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-gray-100 transition-all duration-1000 hover-lift ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{transitionDelay: `${700 + index * 200}ms`}}
                onMouseEnter={() => setActiveFeature(index)}
              >
                <div className={`text-6xl mb-4 group-hover:scale-110 transition-transform duration-300 ${activeFeature === index ? 'animate-bounce' : ''}`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed mb-6">{feature.description}</p>
                
                <div className="space-y-2">
                  {feature.features.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
                
                <div className={`mt-6 h-1 bg-gradient-to-r ${feature.color} rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500`}></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* School Success Stories */}
      <div className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className={`text-center mb-16 transition-all duration-1000 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Schools We've Transformed</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Real stories from schools that have successfully modernized their learning environments with our platform.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                school: "Riverside High School",
                location: "California, USA",
                transformation: "Transformed from paper-based to 100% digital in 6 weeks",
                results: "40% improvement in student engagement, 60% reduction in administrative workload",
                avatar: "🏫"
              },
              {
                school: "St. Mary's Academy",
                location: "London, UK",
                transformation: "Modernized 150-year-old institution with cutting-edge technology",
                results: "95% parent satisfaction, streamlined communication across all stakeholders",
                avatar: "⛪"
              },
              {
                school: "Tech Valley School",
                location: "Singapore",
                transformation: "Built a future-ready learning environment from the ground up",
                results: "100% digital adoption, enhanced STEM learning capabilities",
                avatar: "🌆"
              }
            ].map((story, index) => (
              <div
                key={index}
                className={`bg-gradient-to-br from-gray-50 to-blue-50 p-8 rounded-2xl border border-gray-100 transition-all duration-1000 hover-lift ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{transitionDelay: `${900 + index * 200}ms`}}
              >
                <div className="text-4xl mb-4">{story.avatar}</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{story.school}</h3>
                <p className="text-gray-600 text-sm mb-4">{story.location}</p>
                <p className="text-gray-700 mb-4 font-medium">{story.transformation}</p>
                <div className="bg-white p-4 rounded-lg">
                  <p className="text-sm text-gray-600"><strong>Results:</strong> {story.results}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Implementation Process */}
      <div className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className={`text-center mb-16 transition-all duration-1000 delay-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-4xl font-bold text-white mb-4">Simple 4-Step Implementation</h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              We make school transformation simple and stress-free with our proven implementation process.
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Assessment", desc: "We analyze your current systems and create a customized transformation plan", icon: "🔍" },
              { step: "2", title: "Setup", desc: "Our team configures the platform and migrates your existing data", icon: "⚙️" },
              { step: "3", title: "Training", desc: "Comprehensive training for all staff members and administrators", icon: "🎓" },
              { step: "4", title: "Launch", desc: "Go live with full support and ongoing optimization", icon: "🚀" }
            ].map((phase, index) => (
              <div
                key={index}
                className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{transitionDelay: `${1200 + index * 200}ms`}}
              >
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">{phase.icon}</span>
                </div>
                <div className="text-3xl font-bold text-white mb-2">{phase.step}</div>
                <h3 className="text-xl font-bold text-white mb-3">{phase.title}</h3>
                <p className="text-blue-100">{phase.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-r from-gray-900 to-blue-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className={`max-w-4xl mx-auto transition-all duration-1000 delay-1400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Transform Your School?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join hundreds of schools that have already modernized their learning environments. 
              Get started with our platform and transform your institution today.
            </p>
            <div className="flex justify-center">
              <button 
                onClick={handleSignupRedirect}
                className="px-10 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full font-semibold text-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 hover-lift"
              >
                Sign Up Now
              </button>
            </div>
            <p className="text-gray-400 mt-6 text-sm">
              No commitment required • 30-day free trial • Full support included
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <div className="text-2xl font-bold mb-4 gradient-text bg-clip-text text-transparent">
            School LMS Platform
          </div>
          <p className="text-gray-400 mb-6">
            Transforming traditional schools into modern, tech-powered learning institutions
          </p>
          <div className="flex justify-center space-x-6 text-gray-400 mb-6">
            <a href="#" className="hover:text-white transition-colors duration-300">Privacy</a>
            <a href="#" className="hover:text-white transition-colors duration-300">Terms</a>
            <a href="#" className="hover:text-white transition-colors duration-300">Support</a>
            <a href="#" className="hover:text-white transition-colors duration-300">Contact</a>
          </div>
          <div className="text-gray-500 text-sm">
            © 2024 School LMS Platform. Empowering education through digital transformation.
          </div>
        </div>
      </footer>
    </div>
  );
}
