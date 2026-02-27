import { motion } from 'framer-motion';
import { cardVariants } from '../utils/motionVariants';

/**
 * FeatureCard - Animated feature card with stagger support
 * 
 * Features:
 * - Inherits stagger timing from parent container
 * - GPU-optimized transforms
 * - Preserves existing hover effects
 */
export default function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <motion.div
      className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow will-change-transform"
      variants={cardVariants}
    >
      <Icon className="text-blue-600 mb-3" size={28} />
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        {title}
      </h3>
      <p className="text-sm text-gray-500">{desc}</p>
    </motion.div>
  );
}
