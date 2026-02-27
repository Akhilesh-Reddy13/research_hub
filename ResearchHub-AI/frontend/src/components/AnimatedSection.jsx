import { motion } from 'framer-motion';
import { sectionVariants, sectionViewportConfig } from '../utils/motionVariants';

/**
 * AnimatedSection - Reusable full-page scroll section with book-style animations
 * 
 * Features:
 * - 100vh height with scroll-snap alignment
 * - Book-style entry/exit animations
 * - GPU-optimized transforms
 * - 3D perspective for depth illusion
 */
export default function AnimatedSection({ 
  children, 
  className = '', 
  style = {},
  id 
}) {
  return (
    <motion.section
      id={id}
      className={`scroll-section min-h-screen w-full will-change-transform ${className}`}
      style={{
        perspective: 1000,
        transformStyle: 'preserve-3d',
        ...style,
      }}
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={sectionViewportConfig}
    >
      {/* Page shadow overlay for depth illusion */}
      <div className="page-shadow" />
      
      {/* Content wrapper */}
      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </motion.section>
  );
}
