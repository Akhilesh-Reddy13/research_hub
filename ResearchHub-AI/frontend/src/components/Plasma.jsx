import { useEffect, useRef } from 'react';

export default function Plasma({
  color = '#ffffff',
  speed = 1,
  direction = 'forward',
  scale = 1,
  opacity = 1,
  mouseInteractive = false,
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const mousePos = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let time = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e) => {
      if (mouseInteractive) {
        const rect = canvas.getBoundingClientRect();
        mousePos.current = {
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        };
      }
    };

    if (mouseInteractive) {
      canvas.addEventListener('mousemove', handleMouseMove);
    }

    const animate = () => {
      const { width, height } = canvas;
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      time += (direction === 'forward' ? speed : -speed) * 0.01;

      const mouseX = mousePos.current.x;
      const mouseY = mousePos.current.y;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          
          const nx = (x / width) * scale;
          const ny = (y / height) * scale;

          // Create plasma effect with multiple sine waves
          const value = Math.sin(nx * 10 + time) +
                       Math.sin(ny * 10 + time) +
                       Math.sin((nx + ny) * 10 + time) +
                       Math.sin(Math.sqrt(nx * nx + ny * ny) * 10 + time);

          // Add mouse interaction
          const mouseDist = mouseInteractive 
            ? Math.sqrt(Math.pow(nx - mouseX, 2) + Math.pow(ny - mouseY, 2))
            : 0;
          
          const colorValue = ((value + mouseDist * 5) / 4 + 1) / 2;

          // Parse hex color
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);

          // Create gradient colors based on plasma value
          data[index] = r * colorValue;
          data[index + 1] = g * colorValue;
          data[index + 2] = b * colorValue;
          data[index + 3] = opacity * 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (mouseInteractive) {
        canvas.removeEventListener('mousemove', handleMouseMove);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [color, speed, direction, scale, opacity, mouseInteractive]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}
    />
  );
}
