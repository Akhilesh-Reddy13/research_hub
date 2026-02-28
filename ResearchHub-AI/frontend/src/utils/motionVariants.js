/**
 * Motion Variants Configuration
 * Premium book-style page transitions with Framer Motion
 */

// Custom easing for premium feel
export const premiumEasing = [0.16, 1, 0.3, 1];

// Section animation variants - smooth fade-in
export const sectionVariants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: premiumEasing,
    },
  },
};

// Container variants for stagger children
export const containerVariants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

// Card animation variants
export const cardVariants = {
  hidden: {
    opacity: 0,
    y: 40,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: premiumEasing,
    },
  },
};

// Viewport configuration for whileInView
export const viewportConfig = {
  once: true,
  amount: 0.3,
};

// Section viewport config (triggers earlier)
export const sectionViewportConfig = {
  once: true,
  amount: 0.15,
};
