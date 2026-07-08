import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthProvider";
import { motion, useMotionValue, useSpring, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Magnetic({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const mouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { width, height, left, top } = ref.current.getBoundingClientRect();
    const xVal = (clientX - (left + width / 2)) * 0.8; // 80% pull factor - much stronger!
    const yVal = (clientY - (top + height / 2)) * 0.8;
    x.set(xVal);
    y.set(yVal);
  }
  
  const mouseLeave = () => {
    x.set(0);
    y.set(0);
  }
  
  const springConfig = { damping: 10, stiffness: 120, mass: 0.2 }; // more bouncy
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  return (
    <motion.div ref={ref} onMouseMove={mouseMove} onMouseLeave={mouseLeave} style={{ x: smoothX, y: smoothY, display: 'inline-block' }}>
      {children}
    </motion.div>
  );
}

function NeuronParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const particles: { x: number, y: number, vx: number, vy: number }[] = [];
    const numParticles = 80;
    
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5
      });
    }

    const mouse = { x: -1000, y: -1000 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    let animationFrameId: number;
    
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        // Magnetic attraction to cursor
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distToMouse = Math.sqrt(dx * dx + dy * dy);
        
        if (distToMouse < 250) {
          // Pull strength increases as it gets closer
          const pull = (250 - distToMouse) / 250;
          p.vx += dx * pull * 0.0004;
          p.vy += dy * pull * 0.0004;
        }

        // Friction to prevent infinite acceleration
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Apply base wandering speed if too slow
        if (Math.abs(p.vx) < 0.2) p.vx += (Math.random() - 0.5) * 0.1;
        if (Math.abs(p.vy) < 0.2) p.vy += (Math.random() - 0.5) * 0.1;

        // Move particle
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off walls softly
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > width) { p.x = width; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > height) { p.y = height; p.vy *= -1; }

        // Draw particle dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fill();

        // Draw neuron connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(0, 0, 0, ${0.15 * (1 - dist2 / 120)})`;
            ctx.stroke();
          }
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-70" />;
}

function Landing() {
  const { user } = useAuth();
  
  // Parallax Scroll
  const { scrollYProgress } = useScroll();
  const yHero = useTransform(scrollYProgress, [0, 1], [0, 250]);
  const opacityHero = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const containerVars = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.4 }
    }
  };
  
  const textRevealVars = {
    hidden: { opacity: 0, y: 40, filter: "blur(10px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-[#050505] relative font-sans selection:bg-black selection:text-white overflow-hidden">
      
      {/* Neuron Network Particles */}
  <NeuronParticles />

      {/* Dynamic Noise Grain Texture */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      {/* Strict Editorial Navbar */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 bg-[#fcfcfc]/80 backdrop-blur-md border-b border-black/5"
      >
        <div className="mx-auto flex max-w-[90%] items-center justify-between py-8">
          <div className="font-bold text-sm tracking-[0.3em] uppercase">
            Electricwisers
          </div>
          <nav className="flex items-center gap-8 font-medium text-xs tracking-widest uppercase">
            {user ? (
              <Magnetic>
                <Link to="/dashboard" className="hover:opacity-50 transition-opacity block p-2">
                  Dashboard
                </Link>
              </Magnetic>
            ) : (
              <>
                <Magnetic>
                  <Link to="/auth" className="hover:opacity-50 transition-opacity block p-2">
                    Sign In
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link to="/auth" search={{ mode: "signup" }} className="relative group block p-2">
                    <span className="relative z-10">Get Started</span>
                    <span className="absolute -bottom-0 left-2 w-[calc(100%-16px)] h-[1px] bg-black transform origin-right scale-x-0 group-hover:scale-x-100 group-hover:origin-left transition-transform duration-500 ease-out"></span>
                  </Link>
                </Magnetic>
              </>
            )}
          </nav>
        </div>
      </motion.header>

      <main className="relative z-10 mx-auto px-6 pt-56 pb-32">
        {/* Architectural Grid Pattern */}
        <div 
          className="pointer-events-none absolute inset-0 z-0 opacity-20"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
            maskImage: 'linear-gradient(to bottom, black 20%, transparent 80%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 20%, transparent 80%)'
          }}
        />

        {/* Luxury Typographic Hero */}
        <motion.div 
          style={{ y: yHero, opacity: opacityHero }}
          variants={containerVars}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center text-center max-w-5xl mx-auto space-y-10"
        >
          <motion.div 
            variants={textRevealVars}
            className="text-[10px] font-bold uppercase tracking-[0.4em] text-black/50"
          >
            The New Standard
          </motion.div>
          
          <motion.h1 
            variants={textRevealVars}
            className="text-6xl md:text-7xl lg:text-[5.5rem] font-black tracking-[-0.02em] leading-[1.05] max-w-5xl"
          >
            AI-POWERED QUIZZES.
            <br />
            <span className="text-black/40">BUILT FROM SYLLABUS.</span>
          </motion.h1>
          
          <motion.p 
            variants={textRevealVars}
            className="text-lg md:text-xl text-black/60 font-medium leading-relaxed max-w-xl mx-auto tracking-wide"
          >
            Upload your syllabus tree. Generate rigorous questions. Enforce absolute exam integrity. Pure efficiency.
          </motion.p>
          
          <motion.div 
            variants={textRevealVars}
            className="flex items-center justify-center gap-8 pt-12"
          >
            <Magnetic>
              <Link to="/auth" search={{ mode: "signup" }} className="group relative px-8 py-4 bg-black text-white text-sm font-bold tracking-[0.2em] uppercase overflow-hidden block">
                <span className="relative z-10 group-hover:text-black transition-colors duration-500">Start Building</span>
                <div className="absolute inset-0 h-full w-full bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[0.16,1,0.3,1]"></div>
              </Link>
            </Magnetic>
          </motion.div>
        </motion.div>

        {/* Minimalist Grid Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.2 }}
          className="mt-56 max-w-[90%] mx-auto"
        >
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-black/20 to-transparent mb-24" />
          
          <div className="grid gap-12 md:grid-cols-3">
            {[
              {
                title: "RAG GENERATION",
                desc: "Upload a syllabus PDF. Isolate topics. Generate rigorous questions grounded exclusively in your source material.",
              },
              {
                title: "REAL-TIME ENGINE",
                desc: "Timer, palette navigation, auto-save, and mark-for-review capabilities synchronized seamlessly.",
              },
              {
                title: "ANTI-CHEAT PROTOCOL",
                desc: "Copy/paste prevention, tab focus tracking, and ML-powered facial detection enforcing exam integrity.",
              },
            ].map((f, i) => (
              <motion.div 
                key={f.title} 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="group relative flex flex-col space-y-6 p-8 hover:bg-[#f0f0f0] transition-colors duration-500"
              >
                <div className="text-[10px] font-bold tracking-[0.3em] text-black/30 group-hover:text-black transition-colors duration-500">
                  0{i + 1}
                </div>
                <h3 className="text-xl font-bold tracking-tight">{f.title}</h3>
                <p className="text-sm font-medium leading-loose text-black/50 group-hover:text-black/80 transition-colors duration-500">{f.desc}</p>
                <div className="h-[1px] w-0 bg-black group-hover:w-full transition-all duration-700 ease-[0.16,1,0.3,1] mt-auto pt-4"></div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
      
      {/* Brutalist Footer */}
      <footer className="py-12 border-t border-black/5 relative z-10 bg-[#fcfcfc]">
        <div className="mx-auto max-w-[90%] flex flex-col md:flex-row items-center justify-between text-black/30 text-[10px] font-bold uppercase tracking-[0.3em]">
          <div>ELECTRICWISERS &copy; {new Date().getFullYear()}</div>
          <div className="flex gap-12 mt-6 md:mt-0">
            <a href="#" className="hover:text-black transition-colors">Privacy</a>
            <a href="#" className="hover:text-black transition-colors">Terms</a>
            <a href="#" className="hover:text-black transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
