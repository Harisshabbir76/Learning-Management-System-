"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    const loadingToast = toast.loading("Verifying credentials...");

    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success(`Welcome back, ${result.user.name}`, { id: loadingToast });
        const schoolId = typeof result.user.school === "string" ? result.user.school : result.user.school?._id;
        router.push(`/${schoolId}/${result.user.userId}/dashboard`);
      } else {
        toast.error(result.message || "Invalid credentials", { id: loadingToast });
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred", { id: loadingToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-background">
      {/* Animated Background Decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[100px] animate-blob animation-delay-2000"></div>

      <div className="w-full max-w-[1100px] grid lg:grid-cols-2 glass rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 animate-fade-in-up">
        {/* Left Side: Illustration & Branding */}
        <div className="hidden lg:flex flex-col justify-center p-12 bg-gradient-to-br from-primary to-purple-700 text-white relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10">
            <Link href="/" className="inline-flex items-center space-x-3 mb-12 group">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary text-2xl shadow-lg group-hover:scale-110 transition-transform">
                <i className="fas fa-graduation-cap"></i>
              </div>
              <span className="text-2xl font-bold tracking-tight">Antigravity LMS</span>
            </Link>

            <h2 className="text-4xl font-bold mb-6 leading-tight">
              Elevate Your Learning <br />
              <span className="text-purple-200 font-medium text-3xl">Experience to the Next Level</span>
            </h2>
            
            <p className="text-white/80 text-lg mb-12 max-w-md leading-relaxed">
              Join thousands of students and teachers already transforming their educational journey with our modern platform.
            </p>

            <div className="grid grid-cols-2 gap-6">
              <div className="glass p-4 rounded-2xl border-white/10 bg-white/5">
                <div className="text-2xl mb-1 text-white">
                  <i className="fas fa-bolt"></i>
                </div>
                <div className="font-bold">Fast Performance</div>
                <div className="text-xs text-white/60">Turbopack Powered</div>
              </div>
              <div className="glass p-4 rounded-2xl border-white/10 bg-white/5">
                <div className="text-2xl mb-1 text-white">
                  <i className="fas fa-shield-halved"></i>
                </div>
                <div className="font-bold">Secure Access</div>
                <div className="text-xs text-white/60">JWT Encrypted</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="p-8 lg:p-16 flex flex-col justify-center bg-white/50 dark:bg-black/20 backdrop-blur-sm">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-10 lg:hidden">
               <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg mb-4">
                <i className="fas fa-graduation-cap"></i>
              </div>
              <h2 className="text-3xl font-bold">Welcome Back</h2>
              <p className="text-muted-foreground mt-2">Log in to your account</p>
            </div>

            <h1 className="hidden lg:block text-3xl font-bold mb-2">Welcome Back</h1>
            <p className="hidden lg:block text-muted-foreground mb-10">Please enter your details to sign in.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium ml-1">Email Address</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                    <i className="fas fa-envelope"></i>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border border-input bg-white/50 dark:bg-white/5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/50 text-foreground"
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-medium">Password</label>
                  <Link href="/forgot-password" size="sm" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                    <i className="fas fa-lock"></i>
                  </span>
                  <input
                    type={passwordVisible ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 rounded-2xl border border-input bg-white/50 dark:bg-white/5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/50 text-foreground"
                    placeholder="password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible(!passwordVisible)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <i className={`fas ${passwordVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-1">
                <input type="checkbox" id="remember" className="w-4 h-4 rounded border-input text-primary focus:ring-primary" />
                <label htmlFor="remember" className="text-sm text-muted-foreground">Remember for 30 days</label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Sign In</span>
                    <i className="fas fa-arrow-right ml-2 text-sm"></i>
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 pt-10 border-t border-border text-center">
              <p className="text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/signup" className="text-primary font-bold hover:underline">
                  Join our community
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
    </div>
  );
}
