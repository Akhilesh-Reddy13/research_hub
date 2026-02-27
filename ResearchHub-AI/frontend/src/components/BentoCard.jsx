import { motion } from 'framer-motion';

/**
 * BentoCard - Glassmorphic card with glow hover effect
 * 
 * Sizes: 'large' (spans 2 cols), 'medium' (1 col), 'small' (1 col, shorter)
 */
export default function BentoCard({ 
  icon: Icon, 
  title, 
  desc, 
  size = 'medium',
  index = 0,
  gradient = 'from-blue-500/20 to-purple-500/20'
}) {
  const sizeClasses = {
    large: 'md:col-span-2 md:row-span-2',
    medium: 'col-span-1 row-span-1',
    small: 'col-span-1 row-span-1',
  };

  const iconSizes = {
    large: 48,
    medium: 32,
    small: 28,
  };

  return (
    <motion.div
      className={`
        relative overflow-hidden rounded-2xl p-6
        bento-card group cursor-pointer
        ${sizeClasses[size]}
        ${size === 'large' ? 'min-h-[280px]' : 'min-h-[160px]'}
      `}
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ 
        duration: 0.6, 
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1]
      }}
      whileHover={{ 
        y: -8,
        transition: { duration: 0.3 }
      }}
    >
      {/* Gradient background on hover */}
      <div className={`
        absolute inset-0 bg-gradient-to-br ${gradient} 
        opacity-0 group-hover:opacity-100 transition-opacity duration-500
      `} />
      
      {/* Glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500" />
      
      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        <motion.div
          className="mb-4"
          whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.5 } }}
        >
          <Icon 
            className="text-blue-400 group-hover:text-blue-300 transition-colors duration-300" 
            size={iconSizes[size]} 
          />
        </motion.div>
        
        <h3 className={`
          font-bold text-white mb-2
          ${size === 'large' ? 'text-2xl' : 'text-lg'}
        `}>
          {title}
        </h3>
        
        <p className={`
          text-gray-400 group-hover:text-gray-300 transition-colors duration-300
          ${size === 'large' ? 'text-base' : 'text-sm'}
        `}>
          {desc}
        </p>

        {/* Shimmer line */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] overflow-hidden">
          <motion.div 
            className="h-full w-1/2 bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </div>

      {/* Corner accent */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full" />
    </motion.div>
  );
}
