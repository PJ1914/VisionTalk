import React, { useEffect, useRef } from 'react';
import './HomePage.css';

function HomePage() {
  const canvasRef = useRef(null);
  const heroRef = useRef(null);
  const mouse = { x: null, y: null };
  const ripples = [];

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Set canvas size to full viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Particle system
    const particles = [];
    const particleCount = 200;

    // Particle class
    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 5 + 1;
        this.speedX = Math.random() * 2 - 1;
        this.speedY = Math.random() * 2 - 1;
        this.opacity = Math.random() * 0.5 + 0.3;
        this.color = Math.random() > 0.5 ? '#38BDF8' : '#EC4899';
        this.glow = Math.random() * 0.5 + 0.5;
      }

      update() {
        // Stronger attraction to mouse
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 250) {
            const force = (250 - distance) / 250;
            this.x += (dx / distance) * force * 3;
            this.y += (dy / distance) * force * 3;
          }
        }

        // Normal movement
        this.x += this.speedX;
        this.y += this.speedY;

        // Bounce off edges
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;

        // Twinkling effect
        this.opacity = Math.random() * 0.5 + 0.3;
        this.glow = Math.random() * 0.5 + 0.5;
      }

      draw() {
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = `rgba(${this.color === '#38BDF8' ? '56, 189, 248' : '236, 72, 153'}, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Ripple class for click effect
    class Ripple {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 100;
        this.speed = 2;
        this.opacity = 1;
      }

      update() {
        this.radius += this.speed;
        this.opacity = 1 - this.radius / this.maxRadius;
        if (this.radius >= this.maxRadius) {
          const index = ripples.indexOf(this);
          if (index !== -1) ripples.splice(index, 1);
        }
      }

      draw() {
        ctx.strokeStyle = `rgba(56, 189, 248, ${this.opacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    // Connect particles with lines
    const connectParticles = () => {
      const maxDistance = 100;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            const opacity = 1 - distance / maxDistance;
            ctx.strokeStyle = `rgba(203, 213, 225, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    // Animation loop
    const animate = () => {
      // Draw gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0D1117');
      gradient.addColorStop(1, '#1E2A3C');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      // Update and draw ripples
      ripples.forEach((ripple) => {
        ripple.update();
        ripple.draw();
      });

      // Draw connections
      connectParticles();

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Mouse move event
    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Mouse click event for ripples
    const handleMouseClick = (e) => {
      ripples.push(new Ripple(e.clientX, e.clientY));
    };
    window.addEventListener('click', handleMouseClick);

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles.forEach((particle) => {
        if (particle.x > canvas.width) particle.x = canvas.width;
        if (particle.y > canvas.height) particle.y = canvas.height;
      });
    };
    window.addEventListener('resize', handleResize);

    // Text animation with fallback
    const hero = heroRef.current;
    const h1 = hero.querySelector('h1');
    if (h1) {
      h1.style.opacity = '0';
      h1.style.transform = 'scale(0.95)';
      setTimeout(() => {
        h1.style.transition = 'opacity 1s ease, transform 1s ease';
        h1.style.opacity = '1';
        h1.style.transform = 'scale(1)';
      }, 500);

      // Fallback to ensure h1 visibility
      setTimeout(() => {
        if (h1.style.opacity !== '1') {
          h1.style.opacity = '1';
          h1.style.transform = 'scale(1)';
        }
      }, 2000);
    }

    // Parallax effect on scroll
    const handleScroll = () => {
      const scrollY = window.scrollY;
      hero.style.transform = `scale(1) translateY(${scrollY * 0.3}px)`;
    };
    window.addEventListener('scroll', handleScroll);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleMouseClick);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="home" role="main" aria-label="Welcome to Vision Talk homepage">
      <canvas
        ref={canvasRef}
        className="particle-canvas"
        aria-label="Dynamic particle animation in the background with floating particles, connecting lines, and ripple effects that react to mouse movement and clicks."
      ></canvas>
      <div className="hero" ref={heroRef}>
        <h1>
          Welcome to <span className="highlight">Vision Talk</span>
        </h1>
        <p>Your AI-powered assistant for the visually impaired.</p>
      </div>
    </div>
  );
}

export default HomePage;